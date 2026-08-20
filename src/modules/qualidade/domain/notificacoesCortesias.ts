import type { NotificacaoCortesiaDTO } from '../types';

const CHAVE_STORAGE_ULTIMO_VISTO = 'flowlab.notificacoes.cortesias.ultimoVisto';
const CHAVE_STORAGE_LIMPO_ATE = 'flowlab.notificacoes.cortesias.limpoAte';

export function lerUltimoVisto(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CHAVE_STORAGE_ULTIMO_VISTO);
}

export function gravarUltimoVisto(sincronizadoEm: string): void {
  window.localStorage.setItem(CHAVE_STORAGE_ULTIMO_VISTO, sincronizadoEm);
}

/** Não lidas = sincronizadas depois do último "visto" — sem `ultimoVisto`, tudo que já existe conta como não lido. */
export function contarNaoLidas(notificacoes: readonly NotificacaoCortesiaDTO[], ultimoVisto: string | null): number {
  if (!ultimoVisto) return notificacoes.length;
  return notificacoes.filter((n) => n.sincronizadoEm > ultimoVisto).length;
}

/**
 * "Limpar" some da LISTA (não é uma exclusão real — a cortesia continua
 * existindo, só o item de notificação some do modal). Puramente client-side
 * (localStorage): guarda o instante do clique, e tudo sincronizado até ali
 * fica escondido; itens sincronizados DEPOIS voltam a aparecer normalmente.
 */
export function lerLimpoAte(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CHAVE_STORAGE_LIMPO_ATE);
}

export function gravarLimpoAte(instante: string): void {
  window.localStorage.setItem(CHAVE_STORAGE_LIMPO_ATE, instante);
}

export function filtrarNaoLimpas(notificacoes: readonly NotificacaoCortesiaDTO[], limpoAte: string | null): NotificacaoCortesiaDTO[] {
  if (!limpoAte) return [...notificacoes];
  return notificacoes.filter((n) => n.sincronizadoEm > limpoAte);
}
