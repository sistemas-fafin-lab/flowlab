// api/_lib/faturamento/recebidosAplis.ts
// Recebido do apLIS por lote, juntando as duas fontes
// (.scratch/faturamento-recebidos-aplis-site/spec.md): o retrato lido no site
// (principal) e o MySQL de backup (reserva). Puro — quem busca as duas é
// recebidosAplisFontes.ts.
//
// Por lote: usa o retrato quando ele foi capturado num dia (Brasília) depois do
// `dadoAte` do banco, ou quando o banco não tem o lote (ou está fora do ar).
// Status e fechamento do lote vêm sempre do banco — o site não traz.

import { centavos } from './conferenciaAplis.js';
import type { RecebidoLoteAplis, RecebidoLoteNaData } from './bdLab.js';

/** Uma requisição do lote como a tela de Baixa do apLIS mostrou. */
export interface RequisicaoRetrato {
  liquido: number;
  recebido: number;
  /** YYYY-MM-DD de `DtaRecebido`; null sem recebimento. */
  data: string | null;
}

export interface RetratoLote {
  /** ISO 8601 (timestamptz). */
  capturadoEm: string;
  requisicoes: RequisicaoRetrato[];
}

/** Lote do retrato sem dado do banco: o site não traz o status do lote. */
const STATUS_SEM_BANCO = { status: 0, statusLabel: '—' } as const;

/** YYYY-MM-DD do instante em America/Sao_Paulo. */
export function diaEmBrasilia(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * O retrato vale para o lote? Sim quando o banco não tem o lote, ou quando a
 * captura é de um dia depois do `dadoAte` do banco. Mesmo dia: o banco é o dump
 * da noite e pode ter o que entrou depois da captura — fica com o banco.
 */
export function retratoVale(retrato: RetratoLote, dadoAte: string | null, bancoTemLote: boolean): boolean {
  if (!bancoTemLote || !dadoAte) return true;
  return diaEmBrasilia(retrato.capturadoEm) > dadoAte;
}

/** Recebido do lote pelo retrato, com status e fechamento do banco quando houver. */
export function recebidoDoRetrato(retrato: RetratoLote, doBanco: RecebidoLoteAplis | undefined): RecebidoLoteAplis {
  let soma = 0;
  let primeiro: string | null = null;
  let ultimo: string | null = null;
  for (const { recebido, data } of retrato.requisicoes) {
    soma += centavos(recebido);
    if (!data || centavos(recebido) <= 0) continue;
    if (!primeiro || data < primeiro) primeiro = data;
    if (!ultimo || data > ultimo) ultimo = data;
  }
  return {
    status: doBanco?.status ?? STATUS_SEM_BANCO.status,
    statusLabel: doBanco?.statusLabel ?? STATUS_SEM_BANCO.statusLabel,
    recebido: soma / 100,
    primeiroRecebimento: primeiro,
    ultimoRecebimento: ultimo,
    fechamento: doBanco?.fechamento ?? null,
  };
}

/** Recebido do lote por data, pelo retrato: só valor positivo e com data, como no banco. */
export function porDataDoRetrato(retrato: RetratoLote): RecebidoLoteNaData[] {
  const porData = new Map<string, number>();
  for (const { recebido, data } of retrato.requisicoes) {
    if (!data || centavos(recebido) <= 0) continue;
    porData.set(data, (porData.get(data) ?? 0) + centavos(recebido));
  }
  return [...porData]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, c]) => ({ data, valor: c / 100 }));
}

export interface EntradaCombinar {
  idsLote: number[];
  /** null: o banco está fora do ar. */
  banco: { porLote: Record<number, RecebidoLoteAplis>; dadoAte: string | null } | null;
  retratos: Map<number, RetratoLote>;
}

export interface RecebidosCombinados {
  porLote: Record<number, RecebidoLoteAplis>;
  /** Lotes cujo recebido veio do retrato do site. */
  doSite: Set<number>;
  /** Lotes sem nenhuma fonte (banco fora do ar e sem retrato): o título fica fora. */
  semFonte: Set<number>;
}

/**
 * O recebido de cada lote pela fonte que vale. Com o banco no ar, lote que não
 * existe em nenhuma das duas fica fora do mapa (é o `lote-ausente` da
 * conferência). Com o banco fora, lote sem retrato vai para `semFonte`.
 */
export function combinarRecebidos({ idsLote, banco, retratos }: EntradaCombinar): RecebidosCombinados {
  const porLote: Record<number, RecebidoLoteAplis> = {};
  const doSite = new Set<number>();
  const semFonte = new Set<number>();
  for (const id of new Set(idsLote)) {
    const doBanco = banco?.porLote[id];
    const retrato = retratos.get(id);
    if (retrato && retratoVale(retrato, banco?.dadoAte ?? null, Boolean(doBanco))) {
      porLote[id] = recebidoDoRetrato(retrato, doBanco);
      doSite.add(id);
    } else if (doBanco) {
      porLote[id] = doBanco;
    } else if (!banco) {
      semFonte.add(id);
    }
  }
  return { porLote, doSite, semFonte };
}
