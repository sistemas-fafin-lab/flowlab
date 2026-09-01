// Seção "Patologia / Anatomia Patológica" da aba Indicadores — requisições
// com `secao_lis = 'patologia_ap'` (Anátomo Patológico/Histopatológico/
// Biópsia Simples/Fragmentos Múltiplos/Margens Peças/PAAF, ver
// bdLabQualidade.ts). Issue 08
// (.scratch/qualidade-riscos-indicadores/issues/08-indicadores-patologia-ap-metricas.md):
// substitui os 4 KPIs genéricos de `agregarIndicadorSecao` por métricas
// próprias desta seção — resposta bespoke, não estende
// `IndicadorSecaoRequisicaoResposta`.
//
// `CodEvento`/`CodProblema` reconferidos ao vivo contra o MySQL de backup em
// 2026-09-01 (ver cabeçalho da migration 20260901130000):
//   - Casos Atrasados: `dtaPrevistaSetor` (prazo OPERACIONAL do setor), não
//     `dtaPrevista` (prazo ao cliente, usado por "Fora do Prazo" em
//     Indicadores Gerais) — mesmo racional de diasEntre > 0 pós-liberação.
//   - Blocos Refeitos: só 1 registro em ~4 anos de histórico neste LIS —
//     esperado ficar zerado quase sempre (decisão: mostrar o dado real, não
//     omitir o indicador).

import type { IndicadorPatologiaApResposta } from '../types';
import { diasEntre } from './requisicoesIndicadores.js';

export interface LinhaIndicadorPatologiaAp {
  dtaPrevistaSetor: string | null;
  dtaLiberacao: string | null;
  recorteColoracao: boolean;
  consensoPendente: boolean;
  blocoDanificado: boolean;
}

/** Laudo liberado depois do prazo OPERACIONAL do setor — nunca conta requisição ainda sem liberação (R4/P4, sem `new Date()` "agora"). */
export function contarCasosAtrasados(linhas: readonly LinhaIndicadorPatologiaAp[]): number {
  return linhas.filter(
    (l) => l.dtaPrevistaSetor !== null && l.dtaLiberacao !== null && diasEntre(l.dtaPrevistaSetor, l.dtaLiberacao) > 0,
  ).length;
}

export function contarRecorteColoracao(linhas: readonly LinhaIndicadorPatologiaAp[]): number {
  return linhas.filter((l) => l.recorteColoracao).length;
}

export function contarConsensoPendente(linhas: readonly LinhaIndicadorPatologiaAp[]): number {
  return linhas.filter((l) => l.consensoPendente).length;
}

/** Quase sempre 0 neste LIS (CodProblema=19 praticamente morto) — dado real, não omitido (ver cabeçalho). */
export function contarBlocosRefeitos(linhas: readonly LinhaIndicadorPatologiaAp[]): number {
  return linhas.filter((l) => l.blocoDanificado).length;
}

export function agregarPatologiaAp(
  periodo: { inicio: string; fim: string },
  linhas: readonly LinhaIndicadorPatologiaAp[],
): IndicadorPatologiaApResposta {
  return {
    periodo,
    secao: 'patologia_ap',
    totalRequisicoes: linhas.length,
    casosAtrasados: contarCasosAtrasados(linhas),
    recorteColoracao: contarRecorteColoracao(linhas),
    consensoPendente: contarConsensoPendente(linhas),
    blocosRefeitos: contarBlocosRefeitos(linhas),
  };
}
