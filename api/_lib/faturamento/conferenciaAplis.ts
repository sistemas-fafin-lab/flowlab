// api/_lib/faturamento/conferenciaAplis.ts
// Conferência das baixas dos títulos com o apLIS
// (.scratch/faturamento-conferencia-baixas-aplis/spec.md): compara o recebido
// no sistema (`notas.valor_recebido`) com o recebido no apLIS dos lotes do título
// (`recebidosDosLotes` em bdLab.ts). Puro — o handler busca os dois lados.
//
// Glosa fica fora da regra: o apLIS não tem o mesmo conceito por lote. O
// `glosadoSistema` só vai junto para o operador avaliar um `sistema-maior`.

import type { RecebidoLoteAplis } from './bdLab.js';

export type { RecebidoLoteAplis };

export type TipoDivergenciaAplis = 'so-no-aplis' | 'aplis-maior' | 'sistema-maior' | 'lote-ausente';

/** Diferença mínima, em centavos, para contar como divergência (R$ 1,00). */
const TOLERANCIA_CENTAVOS = 100;

/** Título não cancelado, com os `aplis_id` dos seus lotes. */
export interface TituloConferencia {
  idNota: string;
  numeroNota: string | null;
  operadora: string;
  status: string;
  dataEmissao: string | null;
  valorTotal: number;
  recebidoSistema: number;
  glosadoSistema: number;
  idsLote: number[];
}

export interface DivergenciaAplis extends Omit<TituloConferencia, 'idsLote'> {
  /** null quando algum lote não existe no MySQL (`lote-ausente`). */
  recebidoAplis: number | null;
  primeiroRecebimentoAplis: string | null;
  ultimoRecebimentoAplis: string | null;
  lotes: { aplisId: number; statusAplis: string | null; recebidoAplis: number | null }[];
  tipo: TipoDivergenciaAplis;
}

/** Real → centavos inteiros: régua de comparação sem erro de ponto flutuante. */
export function centavos(valor: number): number {
  return Math.round(valor * 100);
}

/** Soma dos valores em centavos inteiros. */
export function somaCentavos(itens: { valor: number }[]): number {
  return itens.reduce((soma, item) => soma + centavos(item.valor), 0);
}

/**
 * Tipo da divergência entre os dois recebidos, ou null quando a diferença fica
 * abaixo de R$ 1,00 (arredondamento). Comparado em centavos: em float,
 * 101.1 − 100.1 dá 0,99999…
 */
export function classificarDivergencia(recebidoSistema: number, recebidoAplis: number): TipoDivergenciaAplis | null {
  const sistema = centavos(recebidoSistema);
  const aplis = centavos(recebidoAplis);
  if (aplis - sistema >= TOLERANCIA_CENTAVOS) return sistema === 0 ? 'so-no-aplis' : 'aplis-maior';
  if (sistema - aplis >= TOLERANCIA_CENTAVOS) return 'sistema-maior';
  return null;
}

function menorData(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function maiorData(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Confere um título contra o recebido dos seus lotes no apLIS. Devolve a
 * divergência, ou null quando os dois lados batem (ou o título não tem lote do
 * apLIS). Lote ausente do mapa = não existe no MySQL → `lote-ausente`, sem valor.
 */
export function conferirTitulo(
  titulo: TituloConferencia,
  recebidosPorLote: Record<number, RecebidoLoteAplis>,
): DivergenciaAplis | null {
  if (titulo.idsLote.length === 0) return null;

  const idsLote = [...titulo.idsLote].sort((a, b) => a - b);
  const lotes = idsLote.map((aplisId) => {
    const lote = recebidosPorLote[aplisId];
    return { aplisId, statusAplis: lote?.statusLabel ?? null, recebidoAplis: lote?.recebido ?? null };
  });
  const dadosTitulo = {
    idNota: titulo.idNota,
    numeroNota: titulo.numeroNota,
    operadora: titulo.operadora,
    status: titulo.status,
    dataEmissao: titulo.dataEmissao,
    valorTotal: titulo.valorTotal,
    recebidoSistema: titulo.recebidoSistema,
    glosadoSistema: titulo.glosadoSistema,
  };

  if (idsLote.some((id) => !recebidosPorLote[id])) {
    return {
      ...dadosTitulo,
      recebidoAplis: null,
      primeiroRecebimentoAplis: null,
      ultimoRecebimentoAplis: null,
      lotes,
      tipo: 'lote-ausente',
    };
  }

  let somaCentavos = 0;
  let primeiro: string | null = null;
  let ultimo: string | null = null;
  for (const id of idsLote) {
    const lote = recebidosPorLote[id];
    somaCentavos += centavos(lote.recebido);
    primeiro = menorData(primeiro, lote.primeiroRecebimento);
    ultimo = maiorData(ultimo, lote.ultimoRecebimento);
  }
  const recebidoAplis = somaCentavos / 100;

  const tipo = classificarDivergencia(titulo.recebidoSistema, recebidoAplis);
  if (!tipo) return null;
  return {
    ...dadosTitulo,
    recebidoAplis,
    primeiroRecebimentoAplis: primeiro,
    ultimoRecebimentoAplis: ultimo,
    lotes,
    tipo,
  };
}
