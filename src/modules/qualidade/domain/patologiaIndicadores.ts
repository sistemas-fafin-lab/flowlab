// Seção "Patologia / Anatomia Patológica" da aba Indicadores — requisições
// com `secao_lis = 'patologia_ap'` (Anátomo Patológico/Histopatológico/
// Biópsia Simples/Fragmentos Múltiplos/Margens Peças/PAAF, ver
// bdLabQualidade.ts). Cálculo em si é o compartilhado de
// requisicoesIndicadores.ts — ver o cabeçalho de lá para o racional.

import type { IndicadorSecaoRequisicaoResposta } from '../types';
import { agregarIndicadorSecao, type LinhaIndicadorSecaoRequisicao } from './requisicoesIndicadores.js';

export type { LinhaIndicadorSecaoRequisicao };

export function agregarPatologiaAp(
  periodo: { inicio: string; fim: string },
  linhas: readonly LinhaIndicadorSecaoRequisicao[],
): IndicadorSecaoRequisicaoResposta {
  return agregarIndicadorSecao(periodo, 'patologia_ap', linhas);
}
