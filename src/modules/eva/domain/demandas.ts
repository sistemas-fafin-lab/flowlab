// Regras sobre os cards de TI (it_requests) — RN01 a RN04, D23 e o resumo do Kanban.
// Puras: recebem `hoje` (dia em Brasília). Usadas pelo Início, pela cobrança e pela VPS.
import { diaSP, diferencaDias, inicioDaSemana, type Dia } from './datas';

export type ColunaKanban = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type Prioridade = 'low' | 'medium' | 'high' | 'critical';
export type StatusChamado = 'pending' | 'in_progress' | 'resolved' | 'cancelled';

/** O recorte de it_requests que as regras usam. */
export interface CardTI {
  id: string;
  codigo: string;
  title: string;
  priority: Prioridade;
  status: StatusChamado;
  kanban_status: ColunaKanban;
  assigned_to: string[];
  due_date: string | null;
  kanban_hidden: boolean;
  project_id: string | null;
  sprint_id: string | null;
  updated_at: string;
  created_at: string;
}

export const COLUNAS: ColunaKanban[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];

const PESO_PRIORIDADE: Record<Prioridade, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/** Card que entra em qualquer conta: nem oculto no Kanban, nem cancelado. */
export function estaVisivel(card: CardTI): boolean {
  return !card.kanban_hidden && card.status !== 'cancelled';
}

/** Concluído: na coluna "done" ou marcado como resolvido. */
export function estaConcluido(card: CardTI): boolean {
  return card.kanban_status === 'done' || card.status === 'resolved';
}

/** RN01 — ainda não terminou. */
export function estaAberto(card: CardTI): boolean {
  return estaVisivel(card) && !estaConcluido(card);
}

/** Dia de vencimento em Brasília, ou null sem prazo. */
export function diaVencimento(card: CardTI): Dia | null {
  return card.due_date ? diaSP(card.due_date) : null;
}

/** RN02 — aberto e venceu antes de hoje. */
export function estaAtrasado(card: CardTI, hoje: Dia): boolean {
  const venc = diaVencimento(card);
  return estaAberto(card) && venc !== null && venc < hoje;
}

/** Dias de atraso (0 quando não está atrasado). */
export function diasDeAtraso(card: CardTI, hoje: Dia): number {
  const venc = diaVencimento(card);
  return estaAtrasado(card, hoje) && venc ? diferencaDias(venc, hoje) : 0;
}

/** RN03 — aberto e vence entre hoje e hoje + n dias. */
export function venceEmBreve(card: CardTI, hoje: Dia, n: number): boolean {
  const venc = diaVencimento(card);
  if (!estaAberto(card) || venc === null) return false;
  const dias = diferencaDias(hoje, venc);
  return dias >= 0 && dias <= n;
}

/**
 * RN04 — em andamento ou revisão sem mudança há `diasParado` dias ou mais.
 * A última mudança é a mais recente entre o updated_at e o último comentário.
 */
export function estaParado(card: CardTI, hoje: Dia, diasParado: number, ultimoComentario?: string | null): boolean {
  if (!estaAberto(card) || (card.kanban_status !== 'in_progress' && card.kanban_status !== 'review')) return false;
  const ultima = [card.updated_at, ultimoComentario].filter(Boolean).map((t) => diaSP(t as string)).sort().pop()!;
  return diferencaDias(ultima, hoje) >= diasParado;
}

export function ehDoUsuario(card: CardTI, usuarioId: string): boolean {
  return (card.assigned_to ?? []).includes(usuarioId);
}

/** Concluído nesta semana (segunda a hoje), pelo updated_at — não há coluna de conclusão. */
export function concluidoNaSemana(card: CardTI, hoje: Dia): boolean {
  if (!estaVisivel(card) || !estaConcluido(card)) return false;
  const dia = diaSP(card.updated_at);
  return dia >= inicioDaSemana(hoje) && dia <= hoje;
}

/**
 * D23 — tasks do dia de uma pessoa: os cards dela que vencem hoje ou já venceram,
 * abertos, mais os que ela concluiu hoje (para o "x de y concluídas" não encolher).
 * Ordem: atrasados primeiro (do mais antigo), depois prioridade.
 */
export function tasksDoDia(cards: CardTI[], usuarioId: string, hoje: Dia): CardTI[] {
  return cards
    .filter((c) => estaVisivel(c) && ehDoUsuario(c, usuarioId))
    .filter((c) => {
      const venc = diaVencimento(c);
      if (venc === null || venc > hoje) return false;
      return estaAberto(c) || diaSP(c.updated_at) === hoje;
    })
    .sort((a, b) => {
      const va = diaVencimento(a)!;
      const vb = diaVencimento(b)!;
      if (va !== vb) return va < vb ? -1 : 1;
      return PESO_PRIORIDADE[b.priority] - PESO_PRIORIDADE[a.priority];
    });
}

/** Critério de destaque: maior prioridade → prazo mais próximo → mais recente. */
export function compararDestaque(a: CardTI, b: CardTI): number {
  const p = PESO_PRIORIDADE[b.priority] - PESO_PRIORIDADE[a.priority];
  if (p !== 0) return p;
  const va = diaVencimento(a);
  const vb = diaVencimento(b);
  if (va !== vb) {
    if (va === null) return 1;
    if (vb === null) return -1;
    return va < vb ? -1 : 1;
  }
  return a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0;
}

export interface ColunaResumo {
  coluna: ColunaKanban;
  total: number;
  destaques: CardTI[];
}

/**
 * Resumo do Kanban por coluna, com até `maxDestaques` cards. Em "done" só entram
 * os concluídos nesta semana — senão a coluna cresceria para sempre.
 */
export function resumoKanban(cards: CardTI[], hoje: Dia, maxDestaques = 2): ColunaResumo[] {
  return COLUNAS.map((coluna) => {
    const daColuna = cards.filter((c) =>
      coluna === 'done'
        ? c.kanban_status === 'done' && concluidoNaSemana(c, hoje)
        : estaAberto(c) && c.kanban_status === coluna,
    );
    return { coluna, total: daColuna.length, destaques: [...daColuna].sort(compararDestaque).slice(0, maxDestaques) };
  });
}

export function ordenarAtrasados(cards: CardTI[], hoje: Dia): CardTI[] {
  return cards
    .filter((c) => estaAtrasado(c, hoje))
    .sort((a, b) => diasDeAtraso(b, hoje) - diasDeAtraso(a, hoje) || PESO_PRIORIDADE[b.priority] - PESO_PRIORIDADE[a.priority]);
}
