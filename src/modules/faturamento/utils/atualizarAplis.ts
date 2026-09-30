// Regras puras do "Atualizar do apLIS" (criação de títulos a partir dos lotes
// fechados no apLIS — .scratch/faturamento-titulos-automaticos/spec.md).

import type { LoteFaturamento, LotePreviaAplis, NfAPreencherAplis } from '../types';
import { emissaoPadrao } from './emissaoTitulo';
import { paraIso } from './formato';

/** Data de corte mínima. Lotes fechados antes disso foram tratados pelo backfill
 *  e ficam de fora de propósito. O servidor valida o mesmo piso
 *  (faturamento-titulos-aplis-previa.ts); aqui só limita o campo. */
export const PISO_CORTE_APLIS = '2026-09-01';

/** Default do "fechados a partir de": 1º dia do mês anterior (cobre o mês que
 *  acabou de fechar), nunca antes do piso. Em data local, não UTC. */
export function corteAplisPadrao(hoje: Date = new Date()): string {
  const corte = paraIso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
  return corte < PISO_CORTE_APLIS ? PISO_CORTE_APLIS : corte;
}

/** Competência "YYYY-MM" do mês da emissão. */
export function competenciaDaEmissao(emissao: string): string {
  return emissao.slice(0, 7);
}

/** Marca que distingue o título automático do manual, com a data local. */
export function observacaoAplis(hoje: Date = new Date()): string {
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `Criado pelo Atualizar a partir do apLIS em ${dia}/${mes}`;
}

/** Seleção inicial da prévia: todos os válidos, menos os desvinculados (que o
 *  operador tirou de um título de propósito — voltar a faturar é decisão dele). */
export function selecaoPadraoAplis(lotes: LotePreviaAplis[]): Set<number> {
  return new Set(
    lotes.filter((item) => item.bloqueio === null && !item.desvinculado).map((item) => item.lote.idLote),
  );
}

export interface CorpoTituloAplis {
  idsLote: number[];
  dataEmissao: string;
  competencia: string;
  observacoes: string;
  numeroNota?: string;
}

/** Corpo do POST titulo-criar para um lote. Emissão explícita (a mesma regra do
 *  "Novo título") para a competência sair da mesma conta, inclusive no fallback
 *  de lote sem data de criação. O número da nota é a NF-e do lote, que no
 *  "Novo título" o operador copia à mão — a rota não o deduz do lote. */
export function corpoTituloAplis(
  lote: Pick<LoteFaturamento, 'idLote' | 'dtaCriacao' | 'nfeNumero'>,
  hoje: Date = new Date(),
): CorpoTituloAplis {
  const dataEmissao = emissaoPadrao([lote]);
  return {
    idsLote: [lote.idLote],
    dataEmissao,
    competencia: competenciaDaEmissao(dataEmissao),
    observacoes: observacaoAplis(hoje),
    ...(lote.nfeNumero ? { numeroNota: lote.nfeNumero } : {}),
  };
}

/** Seleção inicial das NFs a preencher: todas as preenchíveis. A divergente
 *  (lotes com NF-e diferentes) nem é selecionável. */
export function selecaoPadraoNfs(nfs: NfAPreencherAplis[]): Set<string> {
  return new Set(nfs.filter((nf) => nf.situacao === 'preenchivel').map((nf) => nf.idNota));
}

export type EstadoCriacao = 'aguardando' | 'criando' | 'criado' | 'falhou';

/** "ja-preenchido": alguém digitou o número entre a prévia e a confirmação —
 *  a rota não sobrescreve (somenteSeVazio). É aviso, não falha. */
export type EstadoPreenchimentoNf = 'aguardando' | 'preenchendo' | 'preenchido' | 'ja-preenchido' | 'falhou';

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** Consolida o estado das linhas no resumo exibido ao fim da execução. A parte
 *  dos títulos some quando só houve NFs, e a das NFs quando só houve títulos. */
export function resumoExecucao(
  estados: Iterable<EstadoCriacao>,
  estadosNf: Iterable<EstadoPreenchimentoNf> = [],
): {
  criados: number;
  falharam: number;
  nfsPreenchidas: number;
  texto: string;
} {
  let criados = 0;
  let falharam = 0;
  let titulosRodados = 0;
  for (const estado of estados) {
    titulosRodados += 1;
    if (estado === 'criado') criados += 1;
    else if (estado === 'falhou') falharam += 1;
  }
  let nfsPreenchidas = 0;
  let nfsJaPreenchidas = 0;
  let nfsFalharam = 0;
  let nfsRodadas = 0;
  for (const estado of estadosNf) {
    nfsRodadas += 1;
    if (estado === 'preenchido') nfsPreenchidas += 1;
    else if (estado === 'ja-preenchido') nfsJaPreenchidas += 1;
    else if (estado === 'falhou') nfsFalharam += 1;
  }

  const partes: string[] = [];
  if (titulosRodados > 0 || nfsRodadas === 0) {
    partes.push(plural(criados, 'título criado', 'títulos criados'));
    if (falharam > 0) partes.push(`${falharam} ${falharam === 1 ? 'falhou' : 'falharam'}`);
  }
  if (nfsRodadas > 0) {
    partes.push(plural(nfsPreenchidas, 'NF preenchida', 'NFs preenchidas'));
    if (nfsJaPreenchidas > 0) partes.push(plural(nfsJaPreenchidas, 'NF já preenchida', 'NFs já preenchidas'));
    if (nfsFalharam > 0) partes.push(plural(nfsFalharam, 'NF falhou', 'NFs falharam'));
  }
  return { criados, falharam, nfsPreenchidas, texto: partes.join(', ') };
}

/** Roda `fn` sobre os itens com no máximo `limite` chamadas ao mesmo tempo. Cada
 *  item é independente: a rejeição de um não interrompe os demais (quem chama
 *  registra o erro por item). `parar` é consultado antes de cada novo item. */
export async function emParalelo<T>(
  itens: T[],
  limite: number,
  fn: (item: T) => Promise<void>,
  parar: () => boolean = () => false,
): Promise<void> {
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length && !parar()) {
      const item = itens[proximo];
      proximo += 1;
      await fn(item).catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
}
