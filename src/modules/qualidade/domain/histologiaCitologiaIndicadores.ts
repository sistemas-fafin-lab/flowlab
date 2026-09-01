// Agregação pura para a seção "Histologia / Citologia" de Indicadores —
// requisições com `secao_lis = 'histologia_citologia'` (Citopatologia, ver
// bdLabQualidade.ts). Issue 09
// (.scratch/qualidade-riscos-indicadores/issues/09-indicadores-histologia-citologia-metricas.md):
// substitui os 4 KPIs genéricos de `agregarIndicadorSecao` por métricas
// próprias desta seção — resposta bespoke, mesmo racional de
// patologiaIndicadores.ts.
//
// `CodEvento`/`CodProblema` reconferidos ao vivo contra o MySQL de backup em
// 2026-09-01 (ver cabeçalho da migration 20260901140000):
//   - Microscopia Aguardando: `CodEvento=1000`, realocado de Patologia/AP
//     para cá — no LIS, quase exclusivo de CITOPATOLOGIA.
//   - Tempo de Processamento: `dtaAmostraRecebida` (evento 20, já usado por
//     Indicadores Gerais) → `dtaPrimeiraLaminaPronta` (MIN(lamina.DtaCriacao)) —
//     não usa `lotehistotecnica` (99,6% Anátomo Patológico no LIS,
//     irrelevante para o escopo desta seção).
//   - Amostras Não Recebidas (CodProblema=4) e Material Devolvido Não
//     Conforme (CodProblema=27) são indicadores SEPARADOS, não um "amostras
//     rejeitadas" combinado — conceitos diferentes no LIS (nunca chegou vs.
//     chegou e foi devolvida).
// "Lâminas Inadequadas"/"Amostras Insatisfatórias" NÃO foram implementadas
// nesta fase — decisão registrada no cabeçalho da migration 20260901140000
// (sinal quase inexistente no LIS: 3 dos 5 CodProblema envolvidos nunca
// foram usados, o quarto tem 1 registro em ~2 anos).

import type { IndicadorHistologiaCitologiaResposta } from '../types';
import { diasEntre, mediaTatDias } from './requisicoesIndicadores.js';

export interface LinhaIndicadorHistologiaCitologia {
  dtaAmostraRecebida: string | null;
  dtaPrimeiraLaminaPronta: string | null;
  numBlocos: number;
  numLaminas: number;
  microscopiaAguardando: boolean;
  amostraNaoRecebida: boolean;
  materialDevolvidoNaoConforme: boolean;
}

/** Soma, não contagem de linhas — `numBlocos`/`numLaminas` já vêm agregados por requisição do sync. */
export function somarBlocosProduzidos(linhas: readonly LinhaIndicadorHistologiaCitologia[]): number {
  return linhas.reduce((soma, l) => soma + l.numBlocos, 0);
}

export function somarLaminasProduzidas(linhas: readonly LinhaIndicadorHistologiaCitologia[]): number {
  return linhas.reduce((soma, l) => soma + l.numLaminas, 0);
}

/** TAT médio, em dias — de `dtaAmostraRecebida` até `dtaPrimeiraLaminaPronta`, mesmo `diasEntre`/`mediaTatDias` de requisicoesIndicadores.ts (R4 — nunca vira 0, vira `null`). */
export function calcularTatProcessamentoDias(linhas: readonly LinhaIndicadorHistologiaCitologia[]): number | null {
  let somaDias = 0;
  let contagem = 0;
  for (const l of linhas) {
    if (l.dtaAmostraRecebida === null || l.dtaPrimeiraLaminaPronta === null) continue;
    somaDias += diasEntre(l.dtaAmostraRecebida, l.dtaPrimeiraLaminaPronta);
    contagem++;
  }
  return mediaTatDias(somaDias, contagem);
}

export function contarMicroscopiaAguardando(linhas: readonly LinhaIndicadorHistologiaCitologia[]): number {
  return linhas.filter((l) => l.microscopiaAguardando).length;
}

export function contarAmostrasNaoRecebidas(linhas: readonly LinhaIndicadorHistologiaCitologia[]): number {
  return linhas.filter((l) => l.amostraNaoRecebida).length;
}

export function contarMaterialDevolvidoNaoConforme(linhas: readonly LinhaIndicadorHistologiaCitologia[]): number {
  return linhas.filter((l) => l.materialDevolvidoNaoConforme).length;
}

export function agregarHistologiaCitologia(
  periodo: { inicio: string; fim: string },
  linhas: readonly LinhaIndicadorHistologiaCitologia[],
): IndicadorHistologiaCitologiaResposta {
  return {
    periodo,
    secao: 'histologia_citologia',
    totalRequisicoes: linhas.length,
    blocosProduzidos: somarBlocosProduzidos(linhas),
    laminasProduzidas: somarLaminasProduzidas(linhas),
    tatProcessamentoDias: calcularTatProcessamentoDias(linhas),
    microscopiaAguardando: contarMicroscopiaAguardando(linhas),
    amostrasNaoRecebidas: contarAmostrasNaoRecebidas(linhas),
    materialDevolvidoNaoConforme: contarMaterialDevolvidoNaoConforme(linhas),
  };
}
