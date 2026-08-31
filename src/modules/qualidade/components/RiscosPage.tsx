import { AlertOctagon } from 'lucide-react';

/**
 * Shell de navegação — sem tabela ou regra de negócio ainda. Existe para as
 * demais issues de Riscos poderem entregar conteúdo em paralelo sem mexer
 * nos mesmos arquivos de rota/menu (ver .scratch/qualidade-riscos-indicadores).
 */
export function Riscos() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Riscos</h1>
        <p className="text-sm text-gray-600 dark:text-slate-400">Gestão de riscos da Qualidade.</p>
      </div>

      <div className="glass-surface flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center">
        <AlertOctagon className="h-10 w-10 text-gray-400 dark:text-slate-500" aria-hidden />
        <p className="font-semibold text-slate-900 dark:text-white">Em construção</p>
        <p className="max-w-md text-sm text-gray-500 dark:text-slate-400">
          Este módulo ainda não tem conteúdo. Volte em breve.
        </p>
      </div>
    </div>
  );
}
