// Seção "IHQ / Parceiro" da aba Indicadores — envio/retorno de material para
// um LABORATÓRIO PARCEIRO externo (requisições com `cod_exame IN (6,12,13)`,
// ver bdLabQualidade.ts). Issue 10
// (.scratch/qualidade-riscos-indicadores/issues/10-indicadores-ihq-parceiro-metricas.md):
// substitui os 4 KPIs genéricos de `agregarIndicadorSecao` por uma tabela com
// 1 linha por tipo de exame — resposta bespoke, mesmo racional de
// patologiaIndicadores.ts/histologiaCitologiaIndicadores.ts.
//
// Distinto do worklist de IHQ já existente (qa_ihq_solicitacoes/ihq.ts), que
// resolve o vínculo de uma requisição de IHQ com a biópsia/peça original do
// mesmo paciente — nenhum código é reaproveitado entre os dois, mesmo com a
// mesma sigla.
//
// `CodExame`/`CodEvento` reconferidos ao vivo contra o MySQL de backup em
// 2026-09-01 (ver cabeçalho da migration 20260901150000):
//   - Escopo: codExame IN (6 "Interna", 12 "Externa Bloco", 13 "Externa
//     Bloco+Lâmina") — os 3 SEMPRE mostrados separados na tabela, nunca
//     somados num total único.
//   - "Recebidos de volta" combina DOIS sinais distintos (dtaRetornoLaudoFotos,
//     evento 56; dtaRetornoAmostraDevolvida, evento 64), mantidos em
//     contadores separados na resposta — não colapsados.
//   - TAT Parceiro = envio até o PRIMEIRO dos dois sinais de retorno.
//   - TAT Interno = primeiro sinal de retorno até `dta_liberacao`, em DIAS
//     (não horas) — `dta_liberacao` é `date`, sem hora (ver
//     calcularTatInternoDias). TAT Parceiro fica em horas porque os dois
//     lados (envio/retorno) são `timestamptz` com hora real.
//   - Pendências são DOIS números separados: aguardando retorno do parceiro
//     (enviado, nenhum dos dois sinais de retorno) e aguardando laudo (sem
//     dta_liberacao, independente do retorno).
//   - Volume real é baixo (24 requisições nos últimos 90 dias, todas
//     cod_exame=13 no período conferido) — decisão do usuário: mostrar o
//     dado real mesmo assim, linhas zeradas incluídas.

import type { IndicadorIhqParceiroPorTipo, IndicadorIhqParceiroResposta } from '../types';
import { diasEntre, mediaTatDias } from './requisicoesIndicadores.js';

export const COD_EXAME_IHQ_INTERNA = 6;
export const COD_EXAME_IHQ_EXTERNA_BLOCO = 12;
export const COD_EXAME_IHQ_EXTERNA_BLOCO_LAMINA = 13;

export const CODS_EXAME_IHQ_PARCEIRO = [
  COD_EXAME_IHQ_INTERNA,
  COD_EXAME_IHQ_EXTERNA_BLOCO,
  COD_EXAME_IHQ_EXTERNA_BLOCO_LAMINA,
] as const;

/** Nomes fixos do catálogo `exame` do LIS — não muda sem uma nova requisição de negócio. */
const NOMES_EXAME_IHQ_PARCEIRO: Record<number, string> = {
  [COD_EXAME_IHQ_INTERNA]: 'Imuno-histoquímica Interna',
  [COD_EXAME_IHQ_EXTERNA_BLOCO]: 'Imuno-histoquímica Externa (Bloco)',
  [COD_EXAME_IHQ_EXTERNA_BLOCO_LAMINA]: 'Imuno-histoquímica Externa (Bloco+Lâmina)',
};

export interface LinhaIndicadorIhqParceiro {
  codExame: number | null;
  dtaPrevista: string | null;
  dtaLiberacao: string | null;
  dtaEnvioParceiro: string | null;
  dtaRetornoLaudoFotos: string | null;
  dtaRetornoAmostraDevolvida: string | null;
}

export function filtrarPorCodExame(
  linhas: readonly LinhaIndicadorIhqParceiro[],
  codExame: number,
): LinhaIndicadorIhqParceiro[] {
  return linhas.filter((l) => l.codExame === codExame);
}

export function contarLaudosLiberados(linhas: readonly LinhaIndicadorIhqParceiro[]): number {
  return linhas.filter((l) => l.dtaLiberacao !== null).length;
}

export function contarLaudosForaDoPrazo(linhas: readonly LinhaIndicadorIhqParceiro[]): number {
  return linhas.filter((l) => l.dtaPrevista !== null && l.dtaLiberacao !== null && diasEntre(l.dtaPrevista, l.dtaLiberacao) > 0).length;
}

export function contarEnviadosParceiro(linhas: readonly LinhaIndicadorIhqParceiro[]): number {
  return linhas.filter((l) => l.dtaEnvioParceiro !== null).length;
}

export function contarRecebidosViaLaudoFotos(linhas: readonly LinhaIndicadorIhqParceiro[]): number {
  return linhas.filter((l) => l.dtaRetornoLaudoFotos !== null).length;
}

export function contarRecebidosViaAmostraDevolvida(linhas: readonly LinhaIndicadorIhqParceiro[]): number {
  return linhas.filter((l) => l.dtaRetornoAmostraDevolvida !== null).length;
}

/** Uma requisição só é contada uma vez mesmo se tiver os dois sinais de retorno. */
export function contarRecebidosVoltaTotal(linhas: readonly LinhaIndicadorIhqParceiro[]): number {
  return linhas.filter((l) => l.dtaRetornoLaudoFotos !== null || l.dtaRetornoAmostraDevolvida !== null).length;
}

function primeiroRetorno(l: LinhaIndicadorIhqParceiro): string | null {
  const datas = [l.dtaRetornoLaudoFotos, l.dtaRetornoAmostraDevolvida].filter((d): d is string => d !== null);
  if (datas.length === 0) return null;
  return datas.reduce((min, d) => (new Date(d).getTime() < new Date(min).getTime() ? d : min));
}

/** Horas corridas entre dois timestamps do LIS — `null` quando alguma das duas datas falta, não é parseável, ou o fim vem antes do início. */
function horasEntre(inicio: string, fim: string): number | null {
  const msInicio = new Date(inicio).getTime();
  const msFim = new Date(fim).getTime();
  if (Number.isNaN(msInicio) || Number.isNaN(msFim) || msFim < msInicio) return null;
  return (msFim - msInicio) / (1000 * 60 * 60);
}

function mediaHoras(duracoes: readonly number[]): number | null {
  if (duracoes.length === 0) return null;
  return Math.round((duracoes.reduce((soma, h) => soma + h, 0) / duracoes.length) * 10) / 10;
}

/** TAT médio do parceiro, em horas — de envio até o primeiro sinal de retorno (R4 — nunca vira 0, vira `null`). */
export function calcularTatParceiroHoras(linhas: readonly LinhaIndicadorIhqParceiro[]): number | null {
  const duracoes: number[] = [];
  for (const l of linhas) {
    const retorno = primeiroRetorno(l);
    if (l.dtaEnvioParceiro === null || retorno === null) continue;
    const horas = horasEntre(l.dtaEnvioParceiro, retorno);
    if (horas !== null) duracoes.push(horas);
  }
  return mediaHoras(duracoes);
}

/**
 * TAT médio interno, em DIAS (não horas) — do primeiro sinal de retorno até
 * `dta_liberacao`. `dta_liberacao` é `date`, sem hora (achado de code
 * review: misturar timestamp de retorno com uma coluna sem hora numa conta
 * em horas descartava silenciosamente todo caso liberado no mesmo dia do
 * retorno — `fim < início` por causa da meia-noite — e subestimava os
 * demais). `diasEntre` já trunca ambos os lados para `YYYY-MM-DD` antes de
 * comparar, mesmo padrão usado por `calcularTatProcessamentoDias`
 * (histologiaCitologiaIndicadores.ts) para a mesma limitação de fonte.
 */
export function calcularTatInternoDias(linhas: readonly LinhaIndicadorIhqParceiro[]): number | null {
  let somaDias = 0;
  let contagemDias = 0;
  for (const l of linhas) {
    const retorno = primeiroRetorno(l);
    if (retorno === null || l.dtaLiberacao === null) continue;
    somaDias += diasEntre(retorno, l.dtaLiberacao);
    contagemDias++;
  }
  return mediaTatDias(somaDias, contagemDias);
}

/** Enviado ao parceiro, sem nenhum dos dois sinais de retorno ainda. */
export function contarPendenciaAguardandoParceiro(linhas: readonly LinhaIndicadorIhqParceiro[]): number {
  return linhas.filter((l) => l.dtaEnvioParceiro !== null && primeiroRetorno(l) === null).length;
}

/** Sem `dta_liberacao`, independente do estado do retorno do parceiro. */
export function contarPendenciaAguardandoLaudo(linhas: readonly LinhaIndicadorIhqParceiro[]): number {
  return linhas.filter((l) => l.dtaLiberacao === null).length;
}

function agregarPorTipo(codExame: number, linhas: readonly LinhaIndicadorIhqParceiro[]): IndicadorIhqParceiroPorTipo {
  const doTipo = filtrarPorCodExame(linhas, codExame);
  return {
    codExame,
    nomExame: NOMES_EXAME_IHQ_PARCEIRO[codExame] ?? `Exame ${codExame}`,
    laudosLiberados: contarLaudosLiberados(doTipo),
    laudosForaDoPrazo: contarLaudosForaDoPrazo(doTipo),
    enviadosParceiro: contarEnviadosParceiro(doTipo),
    recebidosVolta: {
      viaLaudoFotos: contarRecebidosViaLaudoFotos(doTipo),
      viaAmostraDevolvida: contarRecebidosViaAmostraDevolvida(doTipo),
      total: contarRecebidosVoltaTotal(doTipo),
    },
    tatParceiroHoras: calcularTatParceiroHoras(doTipo),
    tatInternoDias: calcularTatInternoDias(doTipo),
    pendenciaAguardandoParceiro: contarPendenciaAguardandoParceiro(doTipo),
    pendenciaAguardandoLaudo: contarPendenciaAguardandoLaudo(doTipo),
  };
}

export function agregarIhqParceiro(
  periodo: { inicio: string; fim: string },
  linhas: readonly LinhaIndicadorIhqParceiro[],
): IndicadorIhqParceiroResposta {
  return {
    periodo,
    secao: 'ihq_parceiro',
    porTipo: CODS_EXAME_IHQ_PARCEIRO.map((codExame) => agregarPorTipo(codExame, linhas)),
  };
}
