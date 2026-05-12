import React from 'react';
import { Pencil, Trash2, SearchX } from 'lucide-react';
import { Exam, formatBRL } from '../../hooks/useCostControl';

interface ExamTableProps {
  exams: Exam[];
  onEdit: (exam: Exam) => void;
  onDelete: (exam: Exam) => void;
}

const ExamTable: React.FC<ExamTableProps> = ({ exams, onEdit, onDelete }) => {
  if (exams.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 p-12 text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
          <SearchX className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Nenhum exame encontrado</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ajuste os filtros ou cadastre um novo exame.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-gray-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 text-left font-bold">Código</th>
              <th className="px-5 py-3 text-left font-bold">Nome do Exame</th>
              <th className="px-5 py-3 text-left font-bold">Local</th>
              <th className="px-5 py-3 text-right font-bold">Custo Direto</th>
              <th className="px-5 py-3 text-right font-bold">Custo Indireto</th>
              <th className="px-5 py-3 text-right font-bold">Custo Total</th>
              <th className="px-5 py-3 text-right font-bold w-28">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {exams.map(exam => (
              <tr key={exam.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/[.04] transition-colors">
                <td className="px-5 py-3.5">
                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{exam.code}</span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-gray-800 dark:text-gray-100">{exam.name}</div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {exam.location}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{formatBRL(exam.direct)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{formatBRL(exam.indirect)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums font-bold text-gray-900 dark:text-white">
                  {formatBRL(exam.direct + exam.indirect)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(exam)}
                      title="Editar"
                      className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(exam)}
                      title="Excluir"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/30 text-xs text-gray-500 dark:text-gray-400">
        {exams.length} {exams.length === 1 ? 'exame' : 'exames'} encontrado{exams.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default ExamTable;
