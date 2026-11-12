// Regras de "convênio cobrável" do Faturamento, compartilhadas pelo SQL das Pendências
// (api/_lib/faturamento/bdLab.ts) e pela conversão da aba Comparativos
// (conversaoRequisicoes.ts), para as telas não terem duas verdades. Os motivos de cada
// código estão comentados em bdLab.ts, junto das listas que os usam.

/** Fonte pagadora PARTICULAR ativa (a 101 é a mesma razão social, inativa no apLIS). */
export const ID_FONTE_PAGADORA_PARTICULAR = 1102;

/** Fonte pagadora Cortesia: não é cobrada (investigação no MySQL da issue 21, 27/08). */
export const ID_FONTE_PAGADORA_CORTESIA = 100;

/** `requisicao.CodEvento` em estado final não cobrável. */
export const EVENTOS_NAO_COBRAVEIS = [8, 58, 64, 1015, 1020, 1023, 1037, 1040];

/** `fatlote.Status` cancelado (5) e prejuízo (8): o lote não conta como faturado. */
export const STATUS_LOTE_NAO_FATURADO = [5, 8];
