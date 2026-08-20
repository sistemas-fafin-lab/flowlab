import { XCircle } from 'lucide-react';

interface ErrorStateProps {
  titulo: string;
  descricao?: string;
  aoTentarNovamente?: () => void;
}

/** Ver docs/Planing/ui-guidelines.md § Erros. */
export function ErrorState({ titulo, descricao, aoTentarNovamente }: ErrorStateProps) {
  return (
    <div className="glass-surface flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center">
      <XCircle className="h-10 w-10 text-red-500" aria-hidden />
      <p className="font-semibold text-slate-900 dark:text-white">{titulo}</p>
      {descricao && <p className="max-w-md text-sm text-gray-500 dark:text-slate-400">{descricao}</p>}
      {aoTentarNovamente && (
        <button
          type="button"
          onClick={aoTentarNovamente}
          className="mt-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
