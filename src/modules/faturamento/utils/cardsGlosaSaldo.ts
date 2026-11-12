// Dashboard do Contas a Receber: cards "Glosa recuperada" e "Saldo pendente"
// (.scratch/faturamento-comparativos/issues/10-cards-glosa-recuperada-e-saldo-pendente.md).
//
// Função pura sobre as mesmas linhas do funil de glosa da aba Comparativos (funilGlosa.ts),
// compartilhada pela rota e pelos testes. Os valores são somados em centavos inteiros.
//
// - Saldo pendente = Faturado − Recebido − Acatado dos títulos emitidos no período, com a
//   acatada do apLIS (`notas.valor_glosa_acatada`): é o `valor_saldo` do título, a mesma conta
//   do Saldo por operadora.
// - Recuperada (e a glosa total, base do "% do glosado") segue a data da glosa no funil
//   (`dataDaGlosaNoFunil`): num mês inteiro, bate com a linha "da qual, glosa recuperada".

import { dataDaGlosaNoFunil, type GlosaFunil, type TituloFunil } from './funilGlosa.js';

export interface CardsGlosaSaldo {
  faturado: number;
  recebido: number;
  /** Acatada do apLIS dos títulos do período (status 18 e 8). */
  acatado: number;
  /** faturado − recebido − acatado. */
  saldoPendente: number;
  recuperada: number;
  /** recuperada + acatada + em disputa da foto do apLIS, no mesmo recorte da recuperada. */
  glosaTotal: number;
}

const paraCentavos = (valor: number) => Math.round(valor * 100);
const emReais = (centavos: number) => centavos / 100 + 0; // + 0 evita -0

/** Meses (YYYY-MM) que o período `desde`..`ate` (YYYY-MM-DD) toca, em ordem. */
export function mesesDoPeriodo(desde: string, ate: string): string[] {
  const meses: string[] = [];
  let [ano, mes] = desde.slice(0, 7).split('-').map(Number);
  const ultimo = ate.slice(0, 7);
  for (;;) {
    const atual = `${ano}-${String(mes).padStart(2, '0')}`;
    if (atual > ultimo) return meses;
    meses.push(atual);
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
}

export function cardsGlosaSaldo({
  desde,
  ate,
  titulos,
  glosas,
  primeiraEmissaoDoLote = new Map(),
}: {
  /** YYYY-MM-DD, inclusivo. */
  desde: string;
  /** YYYY-MM-DD, inclusivo. */
  ate: string;
  titulos: TituloFunil[];
  glosas: GlosaFunil[];
  primeiraEmissaoDoLote?: ReadonlyMap<string, string>;
}): CardsGlosaSaldo {
  let faturado = 0;
  let recebido = 0;
  let acatado = 0;
  for (const t of titulos) {
    if (!t.dataEmissao || t.dataEmissao < desde || t.dataEmissao > ate) continue;
    faturado += paraCentavos(t.valorTotal);
    recebido += paraCentavos(t.valorRecebido);
    acatado += paraCentavos(t.valorGlosaAcatada ?? 0);
  }

  // Glosa sem título só tem o mês do lote no apLIS: entra se o mês cai no período.
  const meses = new Set(mesesDoPeriodo(desde, ate));
  const noPeriodo = (data: string) => (data.length === 7 ? meses.has(data) : data >= desde && data <= ate);
  const dataDaGlosa = dataDaGlosaNoFunil(titulos, primeiraEmissaoDoLote);
  let recuperada = 0;
  let glosaTotal = 0;
  for (const g of glosas) {
    if (!noPeriodo(dataDaGlosa(g))) continue;
    const valor = paraCentavos(g.valor);
    glosaTotal += valor;
    if (g.classe === 'recuperada') recuperada += valor;
  }

  return {
    faturado: emReais(faturado),
    recebido: emReais(recebido),
    acatado: emReais(acatado),
    saldoPendente: emReais(faturado - recebido - acatado),
    recuperada: emReais(recuperada),
    glosaTotal: emReais(glosaTotal),
  };
}
