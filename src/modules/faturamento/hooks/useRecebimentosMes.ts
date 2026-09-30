import { useMemo } from 'react';
import type { OperadoraResumo } from '../types';
import { useLegadoListagem } from './legado/useLegadoListagem';

// Widget "Recebido no mês" do Dashboard de Contas a Receber: o que o apLIS
// registra como recebido no mês escolhido — "Data Rec. / Valor Rec." da tela de
// recebimento de lá, pelo recebimento MAIS NOVO de cada requisição (regra e
// fonte em listarRecebidosMes, api/_lib/faturamento/bdLab.ts).
//
// Pedido do setor: as baixas lançadas no FlowLab ficam muito atrás do apLIS
// (setembro/2026: ~R$ 50 mil em baixas contra ~R$ 900 mil no apLIS), então o
// card lê direto do MySQL de backup, pela rota /api/faturamento/recebidos-mes.
//
// O servidor devolve todas as fontes pagadoras; o recorte pela whitelist da
// meta e pelo filtro de operadora acontece aqui, por `operadoras.aplis_id`.

export interface RecebidoLoteMes {
  fontePagadoraId: number | null;
  fontePagadoraNome: string | null;
  idLote: number | null;
  qtdRequisicoes: number;
  valorRecebido: number;
  ultimoRecebimento: string | null;
}

/** Linha já recortada e com o nome da operadora do FlowLab. */
export interface RecebidoLote extends RecebidoLoteMes {
  operadoraNome: string;
}

export interface RecebidoPorOperadora {
  chave: string;
  nome: string;
  valor: number;
  qtdRequisicoes: number;
}

interface MetaRecebidosMes {
  competencia: string;
  desde: string;
  ate: string;
}

interface RespostaRecebidosMes {
  success?: boolean;
  error?: string;
  meta?: MetaRecebidosMes;
  lotes?: RecebidoLoteMes[];
}

const cacheSessao = new Map<string, { itens: RecebidoLoteMes[]; meta: MetaRecebidosMes }>();

interface UseRecebimentosMesResult {
  lotes: RecebidoLote[];
  total: number;
  qtdRequisicoes: number;
  porOperadora: RecebidoPorOperadora[];
  loading: boolean;
  error: string | null;
}

/**
 * @param competencia  "YYYY-MM" do mês de recebimento.
 * @param operadoras   Operadoras que entram no card (whitelist da meta ∩ filtro
 *                     da tela), já resolvidas pelo chamador.
 */
export function useRecebimentosMes(competencia: string, operadoras: OperadoraResumo[]): UseRecebimentosMesResult {
  const filtros = useMemo(() => ({ competencia }), [competencia]);
  const { itens, loading, error } = useLegadoListagem<
    RecebidoLoteMes,
    { competencia: string },
    MetaRecebidosMes,
    RespostaRecebidosMes
  >({
    filtros,
    rota: 'recebidos-mes',
    cache: cacheSessao,
    chaveCache: (f) => f.competencia,
    montarParams: (f, force) => {
      const params = new URLSearchParams({ competencia: f.competencia });
      if (force) params.set('semCache', '1');
      return params;
    },
    extrairItens: (body) => body.lotes ?? [],
    extrairMeta: (body) => body.meta ?? null,
    mensagemErroPadrao: 'Não foi possível consultar os recebimentos do mês no apLIS.',
  });

  const resumo = useMemo(() => {
    const nomePorAplisId = new Map(
      operadoras.filter((o) => o.aplisId).map((o) => [o.aplisId as string, o.nome]),
    );

    const lotes: RecebidoLote[] = [];
    const porOperadora = new Map<string, RecebidoPorOperadora>();
    let total = 0;
    let qtdRequisicoes = 0;

    for (const item of itens) {
      const chave = item.fontePagadoraId === null ? null : String(item.fontePagadoraId);
      const operadoraNome = chave ? nomePorAplisId.get(chave) : undefined;
      if (!chave || operadoraNome === undefined) continue;

      lotes.push({ ...item, operadoraNome });
      total += item.valorRecebido;
      qtdRequisicoes += item.qtdRequisicoes;

      const atual = porOperadora.get(chave) ?? { chave, nome: operadoraNome, valor: 0, qtdRequisicoes: 0 };
      atual.valor += item.valorRecebido;
      atual.qtdRequisicoes += item.qtdRequisicoes;
      porOperadora.set(chave, atual);
    }

    return {
      lotes,
      // Arredonda só no fim: somar centavos em float acumula resíduo.
      total: Math.round(total * 100) / 100,
      qtdRequisicoes,
      porOperadora: [...porOperadora.values()].sort((a, b) => b.valor - a.valor),
    };
  }, [itens, operadoras]);

  return { ...resumo, loading, error };
}
