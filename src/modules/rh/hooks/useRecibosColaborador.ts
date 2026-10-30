import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { BUCKET_HOLERITES, gerarSignedUrlHolerite } from '../holeritesStorage';

export interface ReciboPagamento {
  id: string;
  /** "YYYY-MM-DD", sempre dia 1. */
  competencia: string;
  arquivoPath: string;
  /** Quando o holerite foi enviado pelo RH (created_at). */
  disponibilizadoEm: string;
  /** true quando o arquivo não está mais no bucket — ações ficam desabilitadas. */
  indisponivel: boolean;
}

interface UseRecibosColaboradorResult {
  recibos: ReciboPagamento[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  gerarLink: (arquivoPath: string) => Promise<string | null>;
}

const separarCaminho = (path: string): { pasta: string; arquivo: string } => {
  const i = path.lastIndexOf('/');
  return i < 0 ? { pasta: '', arquivo: path } : { pasta: path.slice(0, i), arquivo: path.slice(i + 1) };
};

/**
 * Arquivos que existem no bucket, por pasta. Um `list` por pasta (não por
 * holerite): quase todos ficam em `<colaborador_id>/`, mas os que vieram de
 * holerites_pendentes podem continuar em `_pendentes/<cpf>/`.
 */
async function arquivosExistentes(paths: string[]): Promise<Set<string>> {
  const pastas = [...new Set(paths.map((p) => separarCaminho(p).pasta))];
  const existentes = new Set<string>();
  await Promise.all(
    pastas.map(async (pasta) => {
      const { data, error } = await supabase.storage.from(BUCKET_HOLERITES).list(pasta, { limit: 1000 });
      if (error) throw error;
      for (const item of data ?? []) existentes.add(pasta ? `${pasta}/${item.name}` : item.name);
    }),
  );
  return existentes;
}

/** Recibos de pagamento de um colaborador, na visão do RH (RLS: canManageHolerites / canViewAllHolerites). */
export function useRecibosColaborador(colaboradorId: string, habilitado = true): UseRecibosColaboradorResult {
  const [recibos, setRecibos] = useState<ReciboPagamento[]>([]);
  const [loading, setLoading] = useState(habilitado);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const carregar = useCallback(async () => {
    if (!habilitado) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: erro } = await supabase
        .from('colaborador_holerites')
        .select('id, competencia, arquivo_path, created_at')
        .eq('colaborador_id', colaboradorId)
        .order('competencia', { ascending: false });
      if (erro) throw erro;

      const linhas = data ?? [];
      // Se a checagem do storage falhar, não marca nada como indisponível:
      // melhor um clique que dá erro do que esconder um recibo que existe.
      let existentes: Set<string> | null = null;
      try {
        existentes = await arquivosExistentes(linhas.map((l) => l.arquivo_path));
      } catch (errStorage) {
        console.error('Erro ao conferir arquivos de holerite no storage:', errStorage);
      }
      if (requestIdRef.current !== requestId) return;

      setRecibos(
        linhas.map((l) => ({
          id: l.id,
          competencia: l.competencia,
          arquivoPath: l.arquivo_path,
          disponibilizadoEm: l.created_at,
          indisponivel: existentes ? !existentes.has(l.arquivo_path) : false,
        })),
      );
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Erro ao carregar recibos do colaborador:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os recibos.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [colaboradorId, habilitado]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { recibos, loading, error, refetch: carregar, gerarLink: gerarSignedUrlHolerite };
}
