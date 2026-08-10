import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Glosa, GlosaRecursoInput, GlosaStatus } from '../../billing/types';

// Glosas lançadas contra os títulos a receber.
//
// Leitura achatada por status — diferente de useContasReceber, que pagina
// títulos por período. É um recorte diferente do mesmo domínio (glosas.status
// em vez de notas.data_emissao), por isso um hook irmão em vez de inchar
// aquele com dois modos de filtro que raramente seriam usados juntos.
//
// A escrita (`atualizarStatusGlosa`) faz UPDATE direto, como `lancarGlosas` e
// `cancelarTitulo` em useContasReceber: é uma linha só, a RLS já exige
// canManageBilling, e a trigger `update_nota_valores` recalcula o título a
// partir desta própria linha — não há nada a tornar atômico.

// Formato cru devolvido pelo PostgREST.
interface LinhaGlosa {
  id_glosa: string;
  recebimento_id: string | null;
  nota_id: string | null;
  requisicao_id: string | null;
  lote_id: string | null;
  valor: number | string;
  motivo: string;
  codigo_glosa: string | null;
  status: GlosaStatus;
  recurso: boolean;
  data_recurso: string | null;
  resultado_recurso: string | null;
  responsavel: string | null;
  created_at: string;
  updated_at: string;
  nota: { numero_nota: string } | null;
  recebimento: { nota: { numero_nota: string; operadora: { nome: string } | null } | null } | null;
}

const num = (bruto: number | string | null | undefined): number => {
  const n = Number(bruto ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function normalizar(linha: LinhaGlosa): Glosa {
  return {
    id_glosa: linha.id_glosa,
    recebimento_id: linha.recebimento_id,
    nota_id: linha.nota_id,
    requisicao_id: linha.requisicao_id,
    lote_id: linha.lote_id,
    valor: num(linha.valor),
    motivo: linha.motivo,
    codigo_glosa: linha.codigo_glosa,
    status: linha.status,
    recurso: linha.recurso,
    data_recurso: linha.data_recurso,
    resultado_recurso: linha.resultado_recurso,
    responsavel: linha.responsavel,
    created_at: linha.created_at,
    updated_at: linha.updated_at,
    nota: linha.nota,
    recebimento: linha.recebimento,
  };
}

export interface GlosasFiltros {
  status?: GlosaStatus;
  /** Omitidos, busca tudo que casa com o status — não há paginação na tela
   *  hoje. Presentes, recortam a página como em useContasReceber. */
  pagina?: number;
  tamanho?: number;
}

interface UseGlosasResult {
  glosas: Glosa[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  atualizarStatusGlosa: (glosaId: string, dados: GlosaRecursoInput) => Promise<string | null>;
  limparErro: () => void;
}

export function useGlosas(filtros: GlosasFiltros): UseGlosasResult {
  const [glosas, setGlosas] = useState<Glosa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { status, pagina, tamanho } = filtros;

  // Descarta respostas de buscas antigas — mesma guarda de useContasReceber.
  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('glosas')
        .select(
          `id_glosa, recebimento_id, nota_id, requisicao_id, lote_id, valor, motivo,
           codigo_glosa, status, recurso, data_recurso, resultado_recurso, responsavel,
           created_at, updated_at,
           nota:notas(numero_nota),
           recebimento:recebimentos(nota:notas(numero_nota, operadora:operadoras(nome)))`,
        )
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (pagina && tamanho) {
        const inicio = (pagina - 1) * tamanho;
        query = query.range(inicio, inicio + tamanho - 1);
      }

      const { data, error: erro } = await query;
      if (reqId !== buscaAtual.current) return;
      if (erro) throw new Error(erro.message);

      setGlosas((data as unknown as LinhaGlosa[] ?? []).map(normalizar));
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as glosas.');
      setGlosas([]);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [status, pagina, tamanho]);

  useEffect(() => {
    void refetch();
    // Invalida a busca em voo no unmount (mesma guarda de useContasReceber).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  const atualizarStatusGlosa = useCallback(async (
    glosaId: string,
    dados: GlosaRecursoInput,
  ): Promise<string | null> => {
    setError(null);
    try {
      const update: Record<string, unknown> = { status: dados.status };

      if (dados.status === 'em_recurso') {
        update.recurso = true;
        update.data_recurso = dados.data_recurso || new Date().toISOString().split('T')[0];
        if (dados.responsavel !== undefined) update.responsavel = dados.responsavel;
      }
      if (dados.resultado_recurso) {
        update.resultado_recurso = dados.resultado_recurso;
      }
      // updated_at é da trigger_glosas_updated_at (BEFORE UPDATE), não precisa
      // ser setado aqui.

      const { error: erro } = await supabase.from('glosas').update(update).eq('id_glosa', glosaId);
      if (erro) throw new Error(erro.message);

      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível atualizar a glosa.';
      setError(msg);
      return msg;
    }
  }, [refetch]);

  const limparErro = useCallback(() => setError(null), []);

  return { glosas, loading, error, refetch, atualizarStatusGlosa, limparErro };
}

export default useGlosas;
