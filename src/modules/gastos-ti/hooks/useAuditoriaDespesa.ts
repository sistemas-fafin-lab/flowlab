import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { EntradaAuditoria } from '../domain/auditoria';

interface AuditoriaRow {
  id: number;
  tabela: string;
  acao: EntradaAuditoria['acao'];
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  created_at: string;
  autor: { name: string } | null;
}

const LIMITE = 200;

/**
 * Histórico de uma despesa: as linhas dela em ti_auditoria e as das tabelas
 * filhas (reajustes; lançamentos a partir da issue 06), achadas pelo
 * despesa_id gravado no antes/depois. Só busca quando `ativo` (seção aberta).
 */
export function useAuditoriaDespesa(despesaId: string, ativo: boolean) {
  const [entradas, setEntradas] = useState<EntradaAuditoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: erro } = await supabase
      .from('ti_auditoria')
      .select('id, tabela, acao, antes, depois, created_at, autor:user_profiles!autor_id(name)')
      .or(
        `and(tabela.eq.ti_despesas,registro_id.eq.${despesaId}),depois->>despesa_id.eq.${despesaId},antes->>despesa_id.eq.${despesaId}`,
      )
      .order('created_at', { ascending: false })
      .limit(LIMITE);
    if (erro) {
      console.error('Erro ao carregar o histórico da despesa:', erro);
      setError('Não foi possível carregar o histórico.');
    } else {
      setEntradas(
        // O supabase-js infere o embed `autor` como lista; pela FK (autor_id → user_profiles) é um objeto só.
        ((data as unknown as AuditoriaRow[] | null) ?? []).map((r) => ({
          id: r.id,
          tabela: r.tabela,
          acao: r.acao,
          antes: r.antes,
          depois: r.depois,
          autorNome: r.autor?.name ?? null,
          createdAt: r.created_at,
        })),
      );
    }
    setLoading(false);
  }, [despesaId]);

  useEffect(() => {
    if (ativo) buscar();
  }, [ativo, buscar]);

  return { entradas, loading, error, recarregar: buscar };
}
