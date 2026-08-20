// Agregação pura de indicadores de IHQ — portada verbatim de
// apps/backend/src/modules/ihq/indicadores.ts (agregarIhq), sem I/O.

import type { IndicadorIhqResposta } from '../types';
import { calcularTAT } from './ihqRegras.js';

export interface LinhaIndicadorIhq {
  codRequisicaoIhq: string;
  dtaSolicitacaoBloco: string | null;
  dtaEnvioBloco: string | null;
  dtaRetornoBloco: string | null;
}

/**
 * Uma requisição de IHQ é uma solicitação de exame — nunca conta 1 vez por
 * bloco. Escolhe, por `codRequisicaoIhq`, o bloco com `dtaSolicitacaoBloco`
 * mais recente como representante — mesmo critério da worklist — antes de
 * contar "em aberto"/"atrasados"/"retornados".
 */
function representantesPorRequisicao(linhas: readonly LinhaIndicadorIhq[]): LinhaIndicadorIhq[] {
  const porRequisicao = new Map<string, LinhaIndicadorIhq>();
  for (const linha of linhas) {
    const atual = porRequisicao.get(linha.codRequisicaoIhq);
    if (!atual || (linha.dtaSolicitacaoBloco ?? '') > (atual.dtaSolicitacaoBloco ?? '')) {
      porRequisicao.set(linha.codRequisicaoIhq, linha);
    }
  }
  return [...porRequisicao.values()];
}

/**
 * R5: "em aberto" conta itens com envio detectado e sem retorno; "atrasados"
 * usa `calcularTAT` (`dataReferencia` sempre explícita, P4); "retornados" é
 * só informativo (R4 nunca vira indicador crítico).
 */
export function agregarIhq(
  periodo: { inicio: string; fim: string },
  dataReferencia: string,
  linhas: readonly LinhaIndicadorIhq[],
  tatAlertaDias: number,
): IndicadorIhqResposta {
  let emAberto = 0;
  let atrasados = 0;
  let retornados = 0;

  for (const linha of representantesPorRequisicao(linhas)) {
    if (linha.dtaRetornoBloco) retornados++;
    if (!linha.dtaEnvioBloco) continue;

    const { atrasado } = calcularTAT(linha.dtaEnvioBloco, linha.dtaRetornoBloco, dataReferencia, tatAlertaDias);
    if (!linha.dtaRetornoBloco) emAberto++;
    if (atrasado) atrasados++;
  }

  return { periodo, dataReferencia, emAberto, atrasados, retornados };
}
