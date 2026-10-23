import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  ChaveRegraPrazo,
  FontePagadoraRegra,
  RegraPrazoCadastro,
  RegrasPrazoConvenio,
  TipoRegraPrazo,
} from '../utils/regraPrazo';
import { REGRAS_PRAZO } from '../utils/regraPrazo';

// Regras de prazo por convênio (tabelas glosa_prazo_regras e
// glosa_prazo_regra_fontes, migration 20261023160000), cadastradas em
// Acompanhamento dos recursos → "Regras de prazo". Leitura e escrita vão direto
// no Supabase com o cliente da sessão: a RLS é o gate (leitura
// canViewBilling/canManageBilling, escrita só canManageBilling). Um convênio é
// gravado pela RPC glosa_prazo_salvar_regra, que grava a regra e as fontes
// ligadas numa transação.

/** Coluna de cada regra em glosa_prazo_regras (`<coluna>_tipo`, `_n`, `_texto`). */
const COLUNA: Record<ChaveRegraPrazo, string> = {
  pagamentoFatura: 'pagamento_fatura',
  glosaRecurso: 'glosa_recurso',
  glosaAnalise: 'glosa_analise',
  glosaPagamento: 'glosa_pagamento',
};

type LinhaRegras = Record<string, unknown> & {
  id: string;
  convenio: string;
  atualizado_em: string;
  glosa_prazo_regra_fontes: { id_fonte_pagadora: number; fonte_pagadora_nome: string }[] | null;
};

interface LinhaFonteSemRegra {
  id_fonte_pagadora: number;
  fonte_pagadora_nome: string | null;
  ocorrencias: number;
}

export interface FonteSemRegra extends FontePagadoraRegra {
  /** Requisições + lotes de recurso da fonte na foto. */
  ocorrencias: number;
}

export interface DadosRegrasPrazo {
  /** null: convênio novo. */
  id: string | null;
  convenio: string;
  regras: Record<ChaveRegraPrazo, RegraPrazoCadastro>;
  fontes: FontePagadoraRegra[];
}

function deLinha(linha: LinhaRegras): RegrasPrazoConvenio {
  const regras = {} as Record<ChaveRegraPrazo, RegraPrazoCadastro>;
  for (const { chave } of REGRAS_PRAZO) {
    const coluna = COLUNA[chave];
    regras[chave] = {
      tipo: linha[`${coluna}_tipo`] as TipoRegraPrazo,
      n: (linha[`${coluna}_n`] as number | null) ?? null,
      texto: (linha[`${coluna}_texto`] as string | null) ?? null,
    };
  }
  return {
    id: linha.id,
    convenio: linha.convenio,
    regras,
    fontes: (linha.glosa_prazo_regra_fontes ?? [])
      .map((f) => ({ id: f.id_fonte_pagadora, nome: f.fonte_pagadora_nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    atualizadoEm: linha.atualizado_em,
  };
}

function paraLinha(dados: DadosRegrasPrazo): Record<string, unknown> {
  const linha: Record<string, unknown> = { convenio: dados.convenio.trim() };
  for (const { chave } of REGRAS_PRAZO) {
    const coluna = COLUNA[chave];
    const regra = dados.regras[chave];
    linha[`${coluna}_tipo`] = regra.tipo;
    linha[`${coluna}_n`] = regra.n;
    linha[`${coluna}_texto`] = regra.texto?.trim() || null;
  }
  return linha;
}

function mensagemErro(erro: { code?: string; message: string }): string {
  if (erro.code === '23505') return 'Já existe um convênio com esse nome.';
  if (erro.code === '42501') return 'Sem permissão para alterar as regras de prazo.';
  if (erro.code === '23514') return 'Regra de prazo inválida.';
  return erro.message;
}

async function usuarioAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

interface UseRegrasPrazoResult {
  regras: RegrasPrazoConvenio[];
  fontesSemRegra: FonteSemRegra[];
  loading: boolean;
  error: string | null;
  /** Devolvem a mensagem de erro, ou null quando gravou. */
  salvar: (dados: DadosRegrasPrazo) => Promise<string | null>;
  excluir: (id: string) => Promise<string | null>;
  ligarFonte: (fonte: FontePagadoraRegra, regraId: string) => Promise<string | null>;
}

export function useRegrasPrazo(versao: number): UseRegrasPrazoResult {
  const [regras, setRegras] = useState<RegrasPrazoConvenio[]>([]);
  const [fontesSemRegra, setFontesSemRegra] = useState<FonteSemRegra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Descarta respostas fora de ordem quando a foto muda durante uma leitura.
  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);
    const [resRegras, resSemRegra] = await Promise.all([
      supabase
        .from('glosa_prazo_regras')
        .select('*, glosa_prazo_regra_fontes(id_fonte_pagadora, fonte_pagadora_nome)')
        .order('convenio'),
      supabase
        .from('glosa_recurso_fontes_sem_regra')
        .select('id_fonte_pagadora, fonte_pagadora_nome, ocorrencias')
        .order('ocorrencias', { ascending: false }),
    ]);
    if (reqId !== buscaAtual.current) return;
    const erro = resRegras.error ?? resSemRegra.error;
    if (erro) {
      setError(erro.message);
      setRegras([]);
      setFontesSemRegra([]);
    } else {
      setRegras(((resRegras.data ?? []) as LinhaRegras[]).map(deLinha));
      setFontesSemRegra(((resSemRegra.data ?? []) as LinhaFonteSemRegra[]).map((f) => ({
        id: f.id_fonte_pagadora,
        nome: f.fonte_pagadora_nome ?? `Fonte pagadora ${f.id_fonte_pagadora}`,
        ocorrencias: f.ocorrencias,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
    // Invalida a leitura em voo no unmount (contador, não nó do DOM).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch, versao]);

  const salvar = useCallback(async (dados: DadosRegrasPrazo): Promise<string | null> => {
    const { error: erro } = await supabase.rpc('glosa_prazo_salvar_regra', {
      p_id: dados.id,
      p_regra: paraLinha(dados),
      p_fontes: dados.fontes.map((f) => ({ id: f.id, nome: f.nome })),
    });
    if (erro) return mensagemErro(erro);
    await refetch();
    return null;
  }, [refetch]);

  const excluir = useCallback(async (id: string): Promise<string | null> => {
    const { data, error: erro } = await supabase.from('glosa_prazo_regras').delete().eq('id', id).select('id');
    if (erro) return mensagemErro(erro);
    if (!data || data.length === 0) return 'Não foi possível excluir: sem permissão ou o convênio já tinha sido excluído.';
    await refetch();
    return null;
  }, [refetch]);

  const ligarFonte = useCallback(async (fonte: FontePagadoraRegra, regraId: string): Promise<string | null> => {
    const { error: erro } = await supabase
      .from('glosa_prazo_regra_fontes')
      .upsert(
        {
          id_fonte_pagadora: fonte.id,
          regra_id: regraId,
          fonte_pagadora_nome: fonte.nome,
          ligado_em: new Date().toISOString(),
          ligado_por: await usuarioAtual(),
        },
        { onConflict: 'id_fonte_pagadora' },
      );
    if (erro) return mensagemErro(erro);
    await refetch();
    return null;
  }, [refetch]);

  return { regras, fontesSemRegra, loading, error, salvar, excluir, ligarFonte };
}
