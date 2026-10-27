// Classes repetidas da tela de Pagamentos.
//
// Toque: o index.css dá min-height e min-width de 44px a todo button e link em telas de
// toque (pointer: coarse). Os botões daqui já nascem com esse tamanho ou desenham o visual
// dentro de uma área de toque maior, e os que ficam lado a lado numa linha flex levam
// flex-shrink-0: com o mínimo de 44px no lugar do mínimo automático, o flex espremia o
// texto de um por cima do outro (as abas de status no celular).

/** Moldura dos campos (a mesma do formulário de pedido). */
export const CAMPO =
  'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400';

/** Cartão branco das seções da página. */
export const CARTAO = 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700';

/** Rótulo pequeno acima de um campo. */
export const ROTULO = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';

/**
 * Fundo dos modais. No celular, o painel sobe do rodapé como uma folha; do sm em diante,
 * fica centralizado. O próprio fundo é quem rola: os menus do Select e do MultiSelect não
 * usam portal e seriam cortados por um painel com rolagem própria. O cabeçalho e o rodapé
 * do painel ficam presos com sticky.
 */
export const FUNDO_MODAL =
  'fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain bg-black/50 backdrop-blur-sm animate-fade-in pt-[max(1.5rem,env(safe-area-inset-top))] sm:items-center sm:p-4';

/** Painel do modal (a largura máxima e a margem vertical do desktop vêm de cada modal). */
export const PAINEL_MODAL =
  'mt-auto w-full bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-100 dark:border-gray-700 animate-slide-up sm:animate-scale-in';

/** Cabeçalho preso no topo do painel enquanto o fundo rola. */
export const CABECALHO_MODAL =
  'sticky top-0 z-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-t-3xl sm:rounded-t-2xl border-b border-gray-100 dark:border-gray-700';

/** Rodapé preso embaixo, com o respiro da barra do iPhone. */
export const RODAPE_MODAL =
  'sticky bottom-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-100 dark:border-gray-700 sm:rounded-b-2xl px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-4';

/** Alça da folha no celular (só visual). */
export const ALCA_MODAL = 'sm:hidden mx-auto mt-2.5 mb-1 h-1.5 w-10 rounded-full bg-gray-300 dark:bg-gray-600';
