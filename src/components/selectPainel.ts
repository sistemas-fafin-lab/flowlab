// Visual e posição do painel dos dropdowns do design system (Select e MultiSelect).

// Altura máxima da lista; também serve de folga para decidir se abre para cima.
export const PANEL_MAX_PX = 260;
// Altura do campo de busca, somada à folga quando há busca.
export const SEARCH_PX = 48;

// Classes que mudam por tom. As de 'padrao' são exatamente as de antes do `tone`.
export const TONS = {
  padrao: {
    painel: 'py-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl shadow-black/10 dark:shadow-black/40',
    separador: 'my-1 border-t border-gray-100 dark:border-gray-700',
    opcao: '',
    ativo: 'bg-blue-50 dark:bg-blue-900/30',
    escolhido: 'font-medium text-blue-600 dark:text-blue-300',
    normal: 'text-gray-700 dark:text-gray-200',
    vazio: 'text-gray-400 dark:text-gray-500',
    seta: 'text-gray-400',
    descricao: 'text-xs font-normal text-gray-400 dark:text-gray-500',
    busca: 'px-2 pt-1 pb-2 mb-1 border-b border-gray-100 dark:border-gray-700',
    campoBusca:
      'w-full pl-8 pr-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500/20',
    marca: 'border-gray-300 dark:border-gray-500',
    marcaLigada: 'border-blue-500 bg-blue-500 text-white',
    chip: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  },
  vidro: {
    painel:
      'p-1 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22)] dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)] [scrollbar-width:thin] animate-scale-in',
    separador: 'my-1 mx-2 border-t border-slate-100 dark:border-slate-800',
    opcao: 'rounded-lg',
    ativo: 'bg-violet-50 dark:bg-violet-500/15',
    escolhido: 'font-semibold text-violet-700 dark:text-violet-300',
    normal: 'text-slate-700 dark:text-slate-200',
    vazio: 'text-slate-400 dark:text-slate-500',
    seta: 'text-slate-400',
    descricao: 'text-xs font-normal text-slate-400 dark:text-slate-500',
    busca: 'pb-1.5 mb-1 border-b border-slate-100 dark:border-slate-800',
    campoBusca:
      'w-full pl-8 pr-2 py-1.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/70 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-violet-500/25',
    marca: 'border-slate-300 dark:border-slate-600',
    marcaLigada: 'border-violet-500 bg-violet-500 text-white',
    chip: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
} as const;

export type TomSelect = keyof typeof TONS;

// Limites verticais de quem realmente corta o painel: o ancestral que rola
// (o corpo do modal, por exemplo) ou, na falta dele, a viewport.
export const limitesDoContainer = (el: HTMLElement | null): { top: number; bottom: number } => {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }
    node = node.parentElement;
  }
  return { top: 0, bottom: window.innerHeight };
};

/** Abre para cima quando não cabe embaixo (dentro do modal o espaço é curto). */
export const deveAbrirParaCima = (el: HTMLElement | null, alturaPainel: number): boolean => {
  const rect = el?.getBoundingClientRect();
  if (!rect) return false;
  const limites = limitesDoContainer(el);
  const espacoAbaixo = Math.min(window.innerHeight, limites.bottom) - rect.bottom;
  const espacoAcima = rect.top - Math.max(0, limites.top);
  return espacoAbaixo < alturaPainel && espacoAcima > espacoAbaixo;
};
