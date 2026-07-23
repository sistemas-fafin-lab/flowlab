import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { transferirParaAlvaro } from '../apoioApi';
import type {
  ApoioExameExtraido,
  ApoioFilaItem,
  ApoioMedico,
  ApoioPaciente,
  ApoioTransferResultado,
} from '../types';

// Dados de um item novo salvo na fila (após revisão do OCR).
export interface FilaItemInput {
  numero_requisicao?: string | null;
  filename?: string | null;
  paciente?: ApoioPaciente | null;
  medico?: ApoioMedico | null;
  exames?: ApoioExameExtraido[] | null;
  xml_envio?: string | null;
  resumo?: Record<string, unknown> | null;
}

interface UseApoioFilaResult {
  fila: ApoioFilaItem[];       // aguardando / enviando
  historico: ApoioFilaItem[];  // enviado / erro
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  salvarNaFila: (input: FilaItemInput) => Promise<string | null>;
  excluirItem: (id: string) => Promise<string | null>;
  reenviarParaFila: (id: string) => Promise<string | null>;
  enviarAoAlvaro: (ids: string[]) => Promise<ApoioTransferResultado[]>;
}

// Fila de envio ao apoio (ac_apoio_fila). Leitura e escrita simples direto pelo
// supabase-js (RLS permissiva, padrão do módulo); o ENVIO real passa pela API
// (apoio-transferir) porque as credenciais AOL são server-side.
export function useApoioFila(): UseApoioFilaResult {
  const [fila, setFila] = useState<ApoioFilaItem[]>([]);
  const [historico, setHistorico] = useState<ApoioFilaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('ac_apoio_fila')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      setFila([]);
      setHistorico([]);
    } else {
      const itens = (data ?? []) as ApoioFilaItem[];
      setFila(itens.filter((i) => i.status === 'aguardando' || i.status === 'enviando'));
      setHistorico(itens.filter((i) => i.status === 'enviado' || i.status === 'erro'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const salvarNaFila: UseApoioFilaResult['salvarNaFila'] = useCallback(
    async (input) => {
      const { error: err } = await supabase.from('ac_apoio_fila').insert({
        status: 'aguardando',
        numero_requisicao: input.numero_requisicao ?? null,
        filename: input.filename ?? null,
        paciente: input.paciente ?? null,
        medico: input.medico ?? null,
        exames: input.exames ?? null,
        xml_envio: input.xml_envio ?? null,
        resumo: input.resumo ?? null,
      });
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const excluirItem: UseApoioFilaResult['excluirItem'] = useCallback(
    async (id) => {
      const { error: err } = await supabase.from('ac_apoio_fila').delete().eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  // Volta um item com erro para a fila (limpa o desfecho da tentativa anterior).
  const reenviarParaFila: UseApoioFilaResult['reenviarParaFila'] = useCallback(
    async (id) => {
      const { error: err } = await supabase
        .from('ac_apoio_fila')
        .update({ status: 'aguardando', erro_mensagem: null, alvaro_response: null })
        .eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const enviarAoAlvaro: UseApoioFilaResult['enviarAoAlvaro'] = useCallback(
    async (ids) => {
      try {
        return await transferirParaAlvaro(ids);
      } finally {
        await refetch(); // reflete enviado/erro mesmo quando a chamada falha no meio
      }
    },
    [refetch],
  );

  return {
    fila,
    historico,
    loading,
    error,
    refetch,
    salvarNaFila,
    excluirItem,
    reenviarParaFila,
    enviarAoAlvaro,
  };
}
