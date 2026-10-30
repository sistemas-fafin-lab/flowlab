import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { enviarArquivoDocumento, gerarSignedUrlDocumento, removerArquivoDocumento } from '../documentosStorage';
import type { DocumentoAssinado, TipoDocumento } from '../types';

interface DocumentoRow {
  id: string;
  colaborador_id: string;
  tipo: TipoDocumento;
  nome_outro: string | null;
  data_assinatura: string;
  arquivo_path: string;
  nome_arquivo: string;
  created_at: string;
}

const mapDocumento = (row: DocumentoRow): DocumentoAssinado => ({
  id: row.id,
  colaboradorId: row.colaborador_id,
  tipo: row.tipo,
  nomeOutro: row.nome_outro,
  dataAssinatura: row.data_assinatura,
  arquivoPath: row.arquivo_path,
  nomeArquivo: row.nome_arquivo,
  createdAt: row.created_at,
});

export interface EnviarDocumentoInput {
  arquivo: File;
  tipo: TipoDocumento;
  nomeOutro: string | null;
  dataAssinatura: string;
}

interface UseDocumentosColaboradorResult {
  documentos: DocumentoAssinado[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Upload + insert; devolve a mensagem de erro ou null. */
  enviar: (dados: EnviarDocumentoInput) => Promise<string | null>;
  /** Storage + delete; devolve a mensagem de erro ou null. */
  excluir: (documento: DocumentoAssinado) => Promise<string | null>;
  gerarLink: (arquivoPath: string, download?: boolean) => Promise<string | null>;
}

/** Documentos assinados de um colaborador (RLS: canViewColaboradores / canManageColaboradores / o próprio). */
export function useDocumentosColaborador(colaboradorId: string): UseDocumentosColaboradorResult {
  const [documentos, setDocumentos] = useState<DocumentoAssinado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const carregar = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: erro } = await supabase
        .from('colaborador_documentos')
        .select('id, colaborador_id, tipo, nome_outro, data_assinatura, arquivo_path, nome_arquivo, created_at')
        .eq('colaborador_id', colaboradorId)
        .order('data_assinatura', { ascending: false })
        .order('created_at', { ascending: false });
      if (erro) throw erro;
      if (requestIdRef.current !== requestId) return;
      setDocumentos(((data ?? []) as DocumentoRow[]).map(mapDocumento));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Erro ao carregar documentos do colaborador:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os documentos.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [colaboradorId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const enviar = useCallback(
    async ({ arquivo, tipo, nomeOutro, dataAssinatura }: EnviarDocumentoInput): Promise<string | null> => {
      const { path, erro: erroUpload } = await enviarArquivoDocumento(colaboradorId, arquivo);
      if (!path) return `Não foi possível enviar o arquivo: ${erroUpload}`;

      const { error: erroInsert } = await supabase.from('colaborador_documentos').insert({
        colaborador_id: colaboradorId,
        tipo,
        nome_outro: tipo === 'outro' ? nomeOutro?.trim() || null : null,
        data_assinatura: dataAssinatura,
        arquivo_path: path,
        nome_arquivo: arquivo.name,
      });
      if (erroInsert) {
        console.error('Erro ao registrar documento:', erroInsert);
        // Compensação: sem registro, o arquivo ficaria órfão no bucket.
        await removerArquivoDocumento(path);
        return `Não foi possível registrar o documento: ${erroInsert.message}`;
      }
      await carregar();
      return null;
    },
    [colaboradorId, carregar],
  );

  const excluir = useCallback(
    async (documento: DocumentoAssinado): Promise<string | null> => {
      // Arquivo primeiro: se o storage falhar, o registro fica (nunca aponta para nada).
      const erroStorage = await removerArquivoDocumento(documento.arquivoPath);
      if (erroStorage) return `Não foi possível excluir o arquivo: ${erroStorage}`;

      const { error: erroDelete } = await supabase.from('colaborador_documentos').delete().eq('id', documento.id);
      if (erroDelete) {
        console.error('Erro ao excluir registro do documento:', erroDelete);
        return `Não foi possível excluir o documento: ${erroDelete.message}`;
      }
      setDocumentos((atuais) => atuais.filter((d) => d.id !== documento.id));
      return null;
    },
    [],
  );

  return { documentos, loading, error, refetch: carregar, enviar, excluir, gerarLink: gerarSignedUrlDocumento };
}
