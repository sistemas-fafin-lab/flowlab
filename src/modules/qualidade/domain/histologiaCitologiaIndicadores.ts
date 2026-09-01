// Seção "Histologia / Citologia" da aba Indicadores — requisições com
// `secao_lis = 'histologia_citologia'` (Citopatologia, ver
// bdLabQualidade.ts). Cálculo em si é o compartilhado de
// requisicoesIndicadores.ts — ver o cabeçalho de lá para o racional.

import type { IndicadorSecaoRequisicaoResposta } from '../types';
import { agregarIndicadorSecao, type LinhaIndicadorSecaoRequisicao } from './requisicoesIndicadores.js';

export type { LinhaIndicadorSecaoRequisicao };

export function agregarHistologiaCitologia(
  periodo: { inicio: string; fim: string },
  linhas: readonly LinhaIndicadorSecaoRequisicao[],
): IndicadorSecaoRequisicaoResposta {
  return agregarIndicadorSecao(periodo, 'histologia_citologia', linhas);
}
