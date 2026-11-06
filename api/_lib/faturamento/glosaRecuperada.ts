// api/_lib/faturamento/glosaRecuperada.ts
// "Glosa recuperada" do funil da aba Comparativos
// (.scratch/faturamento-comparativos/issues/04-funil-de-glosa-por-competencia.md).
//
// MAPEAMENTO PROPOSTO — a usuária confirma antes de ir para produção:
//   Recuperada = glosa que entrou em recurso e depois teve valor recebido, calculada
//   a partir da foto de recursos do apLIS (a tabela `glosas` do Supabase não serve:
//   não tem registros `revertida` vindos do apLIS).
//
//   status do apLIS (requisicao.CodEventoFatur)     entra como recuperada?
//   34 Glosa recebida                                sim — deferido total (STATUS_APLIS_RECUPERADA)
//   17 Recurso pago                                  sim — deferido total (STATUS_APLIS_RECUPERADA)
//   7 / 16 1º e 2º recurso, 33 Em tratativas         sim, só o que já voltou: ΔRec > 0 e a
//                                                    requisição está em lote de recurso enviado
//   15 Recurso não acatado                           não (indeferido)
//   18 / 8 Acatada (recebido a menor / definitiva)   não (é a Acatada do funil)
//   6 Glosado sem recurso                            não
//
//   Valor = ΔRec (recebido atual − recebido na fixação), ou o corrigido pelo lápis.
//
// Reaproveita a classificação de recursoGlosa.ts (a mesma do Acompanhamento dos recursos);
// aqui fica só o recorte "revertida" e a constante revisável.

import {
  classificarRequisicao,
  STATUS_GLOSA,
  statusDashboard,
  valorRecebidoGlosa,
  type RequisicaoClassificavel,
} from './recursoGlosa.js';
import type { ClasseGlosaFunil } from '../../../src/modules/faturamento/utils/funilGlosa.js';

/** Status que o apLIS já marca como recurso ganho (deferido total). Revisável pela usuária. */
export const STATUS_APLIS_RECUPERADA: number[] = [STATUS_GLOSA.glosaRecebida, STATUS_GLOSA.recursoPago];

/** Valor recuperado da requisição; 0 quando ela não é uma glosa recuperada. */
export function valorRecuperado(requisicao: RequisicaoClassificavel): number {
  const { foto, edicoes = {} } = requisicao;
  if (statusDashboard(foto, edicoes) !== 'revertida') return 0;
  // "Entrou em recurso": lote de recurso, ou um dos status que o apLIS já dá como recurso ganho.
  const emRecurso = foto.emLoteRecurso || (foto.status !== null && STATUS_APLIS_RECUPERADA.includes(foto.status));
  if (!emRecurso) return 0;
  return Math.max(valorRecebidoGlosa(foto, edicoes) ?? 0, 0);
}

/**
 * Classe e valor da requisição no funil, ou null quando ela não entra (indeferida, em
 * tratativas sem retorno, lote de recurso ainda não enviado...). Cada requisição cai em
 * uma classe só:
 *  - acatada: status 18 e 8, valor líquido − recebido (a mesma regra que abate o saldo);
 *  - em disputa: glosa aberta (6) ou em recurso (7, 16), valor = glosa fixada;
 *  - recuperada: ver `valorRecuperado`.
 */
export function classificarParaFunil(
  requisicao: RequisicaoClassificavel,
  glosaFixada: number | null,
): { classe: ClasseGlosaFunil; valor: number } | null {
  const { foto, edicoes = {} } = requisicao;
  const classificacao = classificarRequisicao(foto, edicoes);
  if (classificacao?.classe === 'acatada') return { classe: 'acatada', valor: classificacao.valor };

  const status = statusDashboard(foto, edicoes);
  if (status === 'aberta' || status === 'em-recurso') return { classe: 'em-disputa', valor: glosaFixada ?? 0 };
  if (status === 'revertida') {
    const valor = valorRecuperado(requisicao);
    return valor > 0 ? { classe: 'recuperada', valor } : null;
  }
  return null;
}
