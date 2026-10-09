import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Orcamento } from '../types';

interface OrcamentoRow {
  id: string;
  ano: number;
  categoria_id: string;
  valor_anual: number | string;
  observacao: string | null;
}

export interface ItemOrcamento {
  categoriaId: string;
  /** null = tirar o orçamento da categoria naquele ano (apaga a linha). */
  valorAnual: number | null;
}

/** Todos os orçamentos (tabela pequena: um valor por categoria e ano). */
export function useOrcamentosTI() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: erro } = await supabase.from('ti_orcamentos').select('id, ano, categoria_id, valor_anual, observacao').order('ano');
    if (erro) {
      console.error('Erro ao carregar orçamentos de Gastos de TI:', erro);
      setError('Não foi possível carregar os orçamentos.');
    } else {
      setOrcamentos(
        ((data as OrcamentoRow[] | null) ?? []).map((r) => ({
          id: r.id,
          ano: r.ano,
          categoriaId: r.categoria_id,
          valorAnual: Number(r.valor_anual),
          observacao: r.observacao,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  /**
   * Grava o orçamento do ano: upsert por (ano, categoria) dos valores
   * preenchidos e remoção dos que ficaram vazios. Devolve a mensagem de erro ou null.
   */
  const salvarAno = useCallback(
    async (ano: number, itens: ItemOrcamento[]): Promise<string | null> => {
      const preenchidos = itens.filter((i) => i.valorAnual !== null);
      const vazios = new Set(itens.filter((i) => i.valorAnual === null).map((i) => i.categoriaId));
      const remover = orcamentos.filter((o) => o.ano === ano && vazios.has(o.categoriaId)).map((o) => o.id);

      if (preenchidos.length > 0) {
        const { error: erro } = await supabase
          .from('ti_orcamentos')
          .upsert(preenchidos.map((i) => ({ ano, categoria_id: i.categoriaId, valor_anual: i.valorAnual })), { onConflict: 'ano,categoria_id' });
        if (erro) return erro.code === '42501' ? 'Você não tem permissão para alterar o orçamento.' : erro.message || 'Não foi possível salvar o orçamento.';
      }
      if (remover.length > 0) {
        const { error: erro } = await supabase.from('ti_orcamentos').delete().in('id', remover);
        if (erro) return erro.message || 'Não foi possível tirar o orçamento das categorias esvaziadas.';
      }
      await buscar();
      return null;
    },
    [orcamentos, buscar],
  );

  return { orcamentos, loading, error, salvarAno };
}
