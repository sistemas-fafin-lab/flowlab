// Aba Contas a Receber → Comparativos, bloco "Conversão de requisições" (faturamento-comparativos,
// issue 07): aptas × faturadas por convênio nos 3 meses. Funções puras, compartilhadas pela
// rota (api/) e pela tela, como comparativos.ts — por isso não importam nada do navegador.
//
// Recorte: a requisição entra no mês da DATA DE SOLICITAÇÃO, o mesmo das Pendências.
// "Convênio cobrável" usa as mesmas constantes do SQL de "Sem lote" (regrasCobranca.ts).

import type { PeriodoComparativo } from './comparativos.js';
import {
  EVENTOS_NAO_COBRAVEIS,
  ID_FONTE_PAGADORA_CORTESIA,
  ID_FONTE_PAGADORA_PARTICULAR,
  STATUS_LOTE_NAO_FATURADO,
} from './regrasCobranca.js';

/** Uma requisição solicitada no período, como a consulta devolve. */
export interface LinhaConversaoRequisicao {
  idRequisicao: number;
  /** 'YYYY-MM' da data de solicitação. */
  mes: string;
  /** Fonte pagadora da requisição. */
  fontePagadoraId: number | null;
  nome: string | null;
  codEvento: number | null;
  /** Tem ao menos um procedimento em `fatrequisicaoprocedimento`. */
  temProcedimento: boolean;
  /** `requisicao.Lote` preenchido hoje. */
  temLote: boolean;
  /** `fatlote.Status` do lote; `null` sem lote. */
  statusLote: number | null;
  /** RPS não cancelado lançado direto na requisição. */
  temRpsAtivo: boolean;
}

export interface ConversaoMes {
  mes: string;
  aptas: number;
  faturadas: number;
  /** aptas − faturadas. */
  semLote: number;
  /** faturadas ÷ aptas, em %, 1 casa (100 só sem nenhuma apta sem lote); `null` sem aptas (a tela mostra "—"). */
  percentual: number | null;
}

export interface ConversaoConvenio {
  fontePagadoraId: number | null;
  nome: string | null;
  /** Um item por período, na ordem de `periodos` (referência, M-1, M-2). */
  meses: ConversaoMes[];
}

export interface ConversaoRequisicoes {
  totais: ConversaoMes[];
  /** Mais aptas no mês de referência primeiro; no empate, mais aptas nos 3 meses e o nome. */
  convenios: ConversaoConvenio[];
}

/** Apta a faturar: convênio cobrável (fora Particular e Cortesia), evento cobrável e com procedimento. */
function ehApta(linha: LinhaConversaoRequisicao): boolean {
  return (
    linha.fontePagadoraId !== ID_FONTE_PAGADORA_PARTICULAR &&
    linha.fontePagadoraId !== ID_FONTE_PAGADORA_CORTESIA &&
    (linha.codEvento === null || !EVENTOS_NAO_COBRAVEIS.includes(linha.codEvento)) &&
    linha.temProcedimento
  );
}

/**
 * Faturada: está hoje em lote que não é cancelado nem prejuízo, mesmo que o lote seja de um mês
 * posterior. A apta sem lote já cobrada por RPS avulso também conta, porque a sub-aba
 * "Sem lote" não a lista; assim "aptas sem lote" bate com ela num mês fechado.
 */
function ehFaturada(linha: LinhaConversaoRequisicao): boolean {
  if (linha.temLote) return linha.statusLote === null || !STATUS_LOTE_NAO_FATURADO.includes(linha.statusLote);
  return linha.temRpsAtivo;
}

function mesVazio(mes: string): ConversaoMes {
  return { mes, aptas: 0, faturadas: 0, semLote: 0, percentual: null };
}

function calcularSemLoteEPercentual(m: ConversaoMes): void {
  m.semLote = m.aptas - m.faturadas;
  if (m.aptas === 0) {
    m.percentual = null;
    return;
  }
  const arredondado = Math.round((m.faturadas / m.aptas) * 1000) / 10;
  // 3.173 de 3.174 arredondaria para 100% com uma apta ainda sem lote.
  m.percentual = m.semLote > 0 ? Math.min(arredondado, 99.9) : arredondado;
}

/** Totais por mês e uma linha por convênio com aptas em algum dos 3 meses. */
export function montarConversaoRequisicoes(
  periodos: PeriodoComparativo[],
  linhas: LinhaConversaoRequisicao[],
): ConversaoRequisicoes {
  const totais = periodos.map((p) => mesVazio(p.mes));
  const porConvenio = new Map<string, ConversaoConvenio>();

  for (const linha of linhas) {
    const indice = periodos.findIndex((p) => p.mes === linha.mes);
    if (indice < 0 || !ehApta(linha)) continue;

    const chave = linha.fontePagadoraId === null ? `sem-id|${linha.nome ?? ''}` : String(linha.fontePagadoraId);
    let convenio = porConvenio.get(chave);
    if (!convenio) {
      convenio = { fontePagadoraId: linha.fontePagadoraId, nome: linha.nome, meses: periodos.map((p) => mesVazio(p.mes)) };
      porConvenio.set(chave, convenio);
    }

    const faturada = ehFaturada(linha);
    for (const alvo of [totais[indice], convenio.meses[indice]]) {
      alvo.aptas += 1;
      if (faturada) alvo.faturadas += 1;
    }
  }

  totais.forEach(calcularSemLoteEPercentual);
  const convenios = [...porConvenio.values()];
  convenios.forEach((c) => c.meses.forEach(calcularSemLoteEPercentual));

  const aptasNos3 = (c: ConversaoConvenio) => c.meses.reduce((soma, m) => soma + m.aptas, 0);
  convenios.sort(
    (a, b) =>
      (b.meses[0]?.aptas ?? 0) - (a.meses[0]?.aptas ?? 0) ||
      aptasNos3(b) - aptasNos3(a) ||
      (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'),
  );

  return { totais, convenios };
}
