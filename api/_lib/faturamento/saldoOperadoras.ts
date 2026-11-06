// api/_lib/faturamento/saldoOperadoras.ts
// Saldo por operadora do Dashboard do Contas a Receber: o saldo do sistema
// (`notas.valor_saldo` = total − recebido − glosa acatada) ao lado do saldo no
// apLIS (valor líquido − recebido, por lote)
// (.scratch/faturamento-comparativos/issues/02-saldo-por-operadora.md).
//
// Puro: o handler lê os títulos do Supabase e os totais por lote do apLIS. A
// diferença é só informativa — não corrige o saldo nem dá baixa.

import { centavos } from './conferenciaAplis.js';

/** Diferença mínima, em centavos, para sinalizar (R$ 1,00), como na conferência de baixas. */
const TOLERANCIA_CENTAVOS = 100;

export interface LoteDoTitulo {
  /** `lotes.aplis_id`; null para lote criado fora do apLIS. */
  aplisId: number | null;
  /** `lotes.codigo_lote`, para o filtro de lote da tela. */
  codigo: string | null;
}

export interface TituloSaldo {
  idNota: string;
  numeroNota: string | null;
  operadoraId: string;
  operadora: string;
  /** `operadoras.is_considerada_meta`: o Dashboard só olha estas. */
  consideradaMeta: boolean;
  /** YYYY-MM-DD. */
  dataEmissao: string | null;
  /** `notas.valor_saldo`. */
  saldoSistema: number;
  lotes: LoteDoTitulo[];
}

/** Totais de um lote no apLIS: soma dos procedimentos das requisições do lote. */
export interface SaldoAplisDoLote {
  liquido: number;
  recebido: number;
}

export type SituacaoComparacao = 'igual' | 'sistema-menor' | 'sistema-maior' | 'sem-comparacao';

export interface ComparacaoOperadora {
  operadoraId: string;
  nome: string;
  /** Saldo do sistema só dos títulos comparáveis — a mesma base do apLIS. */
  saldoSistema: number;
  /** null quando nenhum título da operadora é comparável. */
  saldoAplis: number | null;
  /** saldoSistema − saldoAplis: negativo = o sistema está abaixo do apLIS. */
  diferenca: number | null;
  situacao: SituacaoComparacao;
  titulosComparados: number;
  /** Títulos com lote fora do apLIS, sem lote ou ausente no MySQL. */
  titulosForaDaComparacao: number;
}

export interface FiltrosSaldo {
  /** YYYY-MM-DD, sobre a data de emissão. */
  desde: string;
  ate: string;
  /** true = "Só emitidas no período"; false = carteira total (padrão). */
  somentePeriodo: boolean;
  operadoraIds: string[];
  /** Busca parcial no código ou no `aplis_id` do lote. */
  lotes: string[];
  /** Busca parcial no número da nota. */
  notas: string[];
}

function reais(valorEmCentavos: number): number {
  return valorEmCentavos / 100;
}

function contem(texto: string | null | undefined, termo: string): boolean {
  return (texto ?? '').toLowerCase().includes(termo);
}

function termos(brutos: string[]): string[] {
  return brutos.map((t) => t.trim().toLowerCase()).filter((t) => t !== '');
}

/**
 * Os títulos que o gráfico do Dashboard considera — a mesma regra da RPC
 * `fat_dashboard_receber`: operadora considerada na meta, filtros de operadora,
 * nota e lote (OR dentro do campo, AND entre campos) e, no modo "Só emitidas no
 * período", a emissão entre `desde` e `ate`.
 */
export function filtrarUniverso(titulos: TituloSaldo[], filtros: FiltrosSaldo): TituloSaldo[] {
  const notas = termos(filtros.notas);
  const lotes = termos(filtros.lotes);
  return titulos.filter((t) => {
    if (!t.consideradaMeta) return false;
    if (filtros.operadoraIds.length > 0 && !filtros.operadoraIds.includes(t.operadoraId)) return false;
    if (notas.length > 0 && !notas.some((termo) => contem(t.numeroNota, termo))) return false;
    if (lotes.length > 0
      && !t.lotes.some((l) => lotes.some((termo) => contem(l.codigo, termo) || contem(l.aplisId?.toString(), termo)))) {
      return false;
    }
    if (filtros.somentePeriodo) {
      if (!t.dataEmissao || t.dataEmissao < filtros.desde || t.dataEmissao > filtros.ate) return false;
    }
    return true;
  });
}

/**
 * Saldo do sistema × saldo do apLIS por operadora. Só entram os títulos cujos
 * lotes todos têm `aplis_id` e existem no apLIS: título com lote criado fora
 * dele teria só parte do valor do outro lado. O lote ligado a mais de um título
 * da operadora conta uma vez no apLIS (o saldo do sistema soma cada título).
 * Ordena pela maior diferença absoluta.
 */
export function compararSaldos(
  titulos: TituloSaldo[],
  aplisPorLote: Record<number, SaldoAplisDoLote>,
): ComparacaoOperadora[] {
  interface Acumulado {
    nome: string;
    sistema: number;
    comparados: number;
    fora: number;
    lotes: Set<number>;
  }
  const porOperadora = new Map<string, Acumulado>();

  for (const t of titulos) {
    const acc = porOperadora.get(t.operadoraId)
      ?? { nome: t.operadora, sistema: 0, comparados: 0, fora: 0, lotes: new Set<number>() };
    porOperadora.set(t.operadoraId, acc);

    const ids = t.lotes.map((l) => l.aplisId);
    const comparavel = ids.length > 0 && ids.every((id): id is number => id !== null && id in aplisPorLote);
    if (!comparavel) {
      acc.fora += 1;
      continue;
    }
    acc.comparados += 1;
    acc.sistema += centavos(t.saldoSistema);
    for (const id of ids) acc.lotes.add(id as number);
  }

  const linhas = [...porOperadora.entries()].map(([operadoraId, acc]): ComparacaoOperadora => {
    if (acc.comparados === 0) {
      return {
        operadoraId, nome: acc.nome, saldoSistema: 0, saldoAplis: null, diferenca: null,
        situacao: 'sem-comparacao', titulosComparados: 0, titulosForaDaComparacao: acc.fora,
      };
    }
    let aplis = 0;
    for (const id of acc.lotes) aplis += centavos(aplisPorLote[id].liquido) - centavos(aplisPorLote[id].recebido);
    const diferenca = acc.sistema - aplis;
    const situacao: SituacaoComparacao = Math.abs(diferenca) < TOLERANCIA_CENTAVOS
      ? 'igual'
      : diferenca < 0 ? 'sistema-menor' : 'sistema-maior';
    return {
      operadoraId,
      nome: acc.nome,
      saldoSistema: reais(acc.sistema),
      saldoAplis: reais(aplis),
      diferenca: reais(diferenca) + 0,
      situacao,
      titulosComparados: acc.comparados,
      titulosForaDaComparacao: acc.fora,
    };
  });

  return linhas.sort((a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0) || a.nome.localeCompare(b.nome));
}
