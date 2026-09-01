// Seção "Imuno-histoquímica / parceiro" da aba Indicadores — requisições com
// `secao_lis = 'ihq_parceiro'` (Imunoistoquímica/Exames Realizados por
// Parceiros, ver bdLabQualidade.ts). Distinto do worklist de IHQ
// (qa_ihq_solicitacoes/ihq.ts): aqui é só o indicador agregado desta seção,
// mesmo cálculo compartilhado de requisicoesIndicadores.ts.

import type { IndicadorSecaoRequisicaoResposta } from '../types';
import { agregarIndicadorSecao, type LinhaIndicadorSecaoRequisicao } from './requisicoesIndicadores.js';

export type { LinhaIndicadorSecaoRequisicao };

export function agregarIhqParceiro(
  periodo: { inicio: string; fim: string },
  linhas: readonly LinhaIndicadorSecaoRequisicao[],
): IndicadorSecaoRequisicaoResposta {
  return agregarIndicadorSecao(periodo, 'ihq_parceiro', linhas);
}
