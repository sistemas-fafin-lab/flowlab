// Regras puras do "Atualizar do apLIS" (criação de títulos a partir dos lotes
// fechados no apLIS — .scratch/faturamento-titulos-automaticos/spec.md).

import type { LoteFaturamento, LotePreviaAplis } from '../types';
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

export type EstadoCriacao = 'aguardando' | 'criando' | 'criado' | 'falhou';

/** Consolida o estado das linhas no resumo exibido ao fim da execução. */
export function resumoCriacao(estados: Iterable<EstadoCriacao>): {
  criados: number;
  falharam: number;
  texto: string;
} {
  let criados = 0;
  let falharam = 0;
  for (const estado of estados) {
    if (estado === 'criado') criados += 1;
    else if (estado === 'falhou') falharam += 1;
  }
  const texto = `${criados} título${criados === 1 ? '' : 's'} criado${criados === 1 ? '' : 's'}`;
  if (falharam === 0) return { criados, falharam, texto };
  return { criados, falharam, texto: `${texto}, ${falharam} ${falharam === 1 ? 'falhou' : 'falharam'}` };
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
