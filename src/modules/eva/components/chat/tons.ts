import type { Tom } from '../../domain/respostaVisual';

/** Cor do texto por tom (prazo, números). */
export const TEXTO_DO_TOM: Record<Tom, string> = {
  perigo: 'text-red-600 dark:text-red-400',
  atencao: 'text-amber-600 dark:text-amber-400',
  ok: 'text-emerald-600 dark:text-emerald-400',
  neutro: 'text-slate-500 dark:text-slate-400',
};

/** Moldura dos blocos do chat (D34): o mesmo branco das bolhas da EVA. */
export const MOLDURA_BLOCO =
  'rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(0,0,0,.04)]';
