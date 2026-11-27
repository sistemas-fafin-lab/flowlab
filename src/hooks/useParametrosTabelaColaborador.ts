import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ConfiguracaoTabelaColaborador } from '../modules/gerador-orcamento/domain/tabelaColaborador';

// Linha única de public.custo_tabela_colaborador_parametros (migration
// 20261127140000). RLS: lê com canViewControleCustos/canManageControleCustos,
// grava só com canManageControleCustos. updated_by/updated_at vêm do trigger.

export interface ParametrosTabelaColaboradorGravados extends ConfiguracaoTabelaColaborador {
  alteradoEm: string;
  /** Nome de quem alterou por último; null na linha criada pela migration. */
  alteradoPor: string | null;
}

const TABELA = 'custo_tabela_colaborador_parametros';
const COLUNAS =
  'parcela_a, parcela_b, limite_pouca_vantagem, rotulo_parcela_a, rotulo_parcela_b, updated_at, autor:user_profiles(name)';

interface Linha {
  parcela_a: number | string;
  parcela_b: number | string;
  limite_pouca_vantagem: number | string;
  rotulo_parcela_a: string;
  rotulo_parcela_b: string;
  updated_at: string;
  autor: { name: string | null } | { name: string | null }[] | null;
}

function deLinha(linha: Linha): ParametrosTabelaColaboradorGravados {
  const autor = Array.isArray(linha.autor) ? linha.autor[0] : linha.autor;
  return {
    parcelaA: Number(linha.parcela_a),
    parcelaB: Number(linha.parcela_b),
    limitePoucaVantagem: Number(linha.limite_pouca_vantagem),
    rotuloParcelaA: linha.rotulo_parcela_a,
    rotuloParcelaB: linha.rotulo_parcela_b,
    alteradoEm: linha.updated_at,
    alteradoPor: autor?.name ?? null,
  };
}

export function useParametrosTabelaColaborador() {
  const [parametros, setParametros] = useState<ParametrosTabelaColaboradorGravados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data, error } = await supabase.from(TABELA).select(COLUNAS).eq('id', true).single();
      if (!ativo) return;
      if (error) setErro(error.message);
      else setParametros(deLinha(data as unknown as Linha));
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  /** Grava e devolve a linha nova. Sem permissão a RLS não acha a linha e dá erro. */
  const salvar = useCallback(async (config: ConfiguracaoTabelaColaborador) => {
    const { data, error } = await supabase
      .from(TABELA)
      .update({
        parcela_a: config.parcelaA,
        parcela_b: config.parcelaB,
        limite_pouca_vantagem: config.limitePoucaVantagem,
        rotulo_parcela_a: config.rotuloParcelaA.trim(),
        rotulo_parcela_b: config.rotuloParcelaB.trim(),
      })
      .eq('id', true)
      .select(COLUNAS)
      .single();
    if (error) throw new Error(error.message);
    const gravados = deLinha(data as unknown as Linha);
    setParametros(gravados);
    return gravados;
  }, []);

  return { parametros, carregando, erro, salvar };
}
