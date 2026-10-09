// Classes compartilhadas pelos formulários do módulo (mesmo visual dos campos de RH, com foco violeta).

export const classeCampo =
  'w-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 rounded-xl px-3 py-2 disabled:opacity-60';

export const classeCampoComErro = 'border-red-300 dark:border-red-700 focus:ring-red-500/30 focus:border-red-400';

export const classeRotulo = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

export const campo = (erro?: string | null): string => (erro ? `${classeCampo} ${classeCampoComErro}` : classeCampo);
