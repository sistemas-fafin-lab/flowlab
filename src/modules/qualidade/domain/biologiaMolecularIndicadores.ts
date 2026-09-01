// Seção "Biologia Molecular" da aba Indicadores — requisições com
// `secao_lis = 'biologia_molecular'` (PCR/Captura Híbrida/Painel de
// Hibridização, ver bdLabQualidade.ts). Cálculo em si é o compartilhado de
// requisicoesIndicadores.ts — ver o cabeçalho de lá para o racional.

import type { IndicadorSecaoRequisicaoResposta } from '../types';
import { agregarIndicadorSecao, type LinhaIndicadorSecaoRequisicao } from './requisicoesIndicadores.js';

export type { LinhaIndicadorSecaoRequisicao };

export function agregarBiologiaMolecular(
  periodo: { inicio: string; fim: string },
  linhas: readonly LinhaIndicadorSecaoRequisicao[],
): IndicadorSecaoRequisicaoResposta {
  return agregarIndicadorSecao(periodo, 'biologia_molecular', linhas);
}
