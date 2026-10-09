// Fichas de estilo do dashboard (polimento visual). Strings de classe Tailwind
// reaproveitadas pelos componentes para que foco, rolagem, tabelas e campos
// tenham a mesma cara em todo lugar — e nada fique com o visual do navegador.

/**
 * Anel de foco violeta. `focus-visible:outline-0` (e não `outline-none`):
 * o `:focus-visible` global do index.css desenha um contorno azul e, no tema
 * escuro, `.dark :focus-visible` repinta a cor dele — com largura 0 o contorno
 * some de vez e só o anel aparece.
 */
export const ANEL_FOCO =
  'focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';

/** Mesmo anel, por dentro: para linhas de lista e células, onde o offset vazaria do cartão. */
export const ANEL_FOCO_INTERNO = 'focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/70';

/**
 * Barra de rolagem fina e sem trilho. O padrão (`scrollbar-*`) vale no Firefox
 * e no Chrome ≥ 121; o `::-webkit-scrollbar` cobre o Safari. As variantes `dark:`
 * vencem o `.dark ::-webkit-scrollbar-track` global, que pintaria um trilho sólido.
 */
export const ROLAGEM =
  '[scrollbar-width:thin] [scrollbar-color:rgb(148_163_184/0.45)_transparent] dark:[scrollbar-color:rgb(71_85_105/0.7)_transparent] ' +
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent dark:[&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600/70';

/** Superfície flutuante (menus, calendário, dicas): vidro quase opaco, sombra longa e suave. */
export const SUPERFICIE_FLUTUANTE =
  'rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22)] dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)]';

/**
 * Campo de filtro em vidro (gatilho do Select/DatePicker). `ativo` destaca
 * quando o filtro está aplicado; `largura` troca o `w-full` (o calendário usa
 * largura mínima, para "Fevereiro de 2026" caber sem reticências).
 */
export const campoVidro = (ativo = false, largura = 'w-full') =>
  `${largura} h-10 rounded-xl px-3.5 text-sm font-medium shadow-sm backdrop-blur-md transition-colors duration-200 ${ANEL_FOCO} ${
    ativo
      ? 'bg-violet-50/90 dark:bg-violet-500/15 border border-violet-300/80 dark:border-violet-500/40 text-violet-800 dark:text-violet-200'
      : 'bg-white/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
  }`;

/** Botão secundário em vidro (Exportar, Limpar filtros…). */
export const BOTAO_VIDRO = `inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-50 disabled:pointer-events-none ${ANEL_FOCO}`;

/** Link de ação discreto dentro dos cartões ("Ver todos", "Cadastrar orçamento"). */
export const LINK_ACAO = `inline-flex items-center gap-1 rounded-lg text-xs font-semibold text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-100 ${ANEL_FOCO}`;

// ─── Tabelas equivalentes ─────────────────────────────────────────────────────

export const TABELA_CAIXA = `overflow-auto max-h-[340px] -mx-1 px-1 ${ROLAGEM}`;
export const TABELA = 'w-full text-xs border-separate border-spacing-0';
/** Cabeçalho fixo em vidro: a rolagem passa por baixo, desfocada. */
export const TABELA_THEAD = 'sticky top-0 z-10 [&_th]:bg-white/85 dark:[&_th]:bg-slate-900/85 [&_th]:backdrop-blur-md';
export const TABELA_TH =
  'py-2 px-2 font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-700/50 whitespace-nowrap';
export const TABELA_TR = 'transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40';
export const TABELA_TD = 'py-2 px-2 border-b border-slate-100 dark:border-slate-800/80 text-slate-700 dark:text-slate-200';

// ─── Movimento ────────────────────────────────────────────────────────────────

/** Curva "ease-out expo" suave, a mesma em todas as entradas (sensação de mola sem quicar). */
export const CURVA_SAIDA = [0.22, 1, 0.36, 1] as const;
