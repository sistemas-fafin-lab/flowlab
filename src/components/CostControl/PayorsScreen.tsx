import React, { useMemo, useState } from 'react';
import { Building2, Lock, Search, X } from 'lucide-react';
import { Exam, Payor, formatBRL } from '../../hooks/useCostControl';
import { buscarExamesPorTermo, fontesPagadorasPorTuss } from './domain/busca';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PayorsScreenProps {
  payors: Payor[];
  exams: Exam[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PayorsScreen: React.FC<PayorsScreenProps> = ({ payors, exams }) => {
  const [search, setSearch] = useState('');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const termoDigitado = search.trim().length > 0;

  const matches = useMemo(
    () => (selectedExam ? [] : buscarExamesPorTermo(exams, search)),
    [exams, search, selectedExam]
  );

  // Sem seleção explícita, um único match já é a "seleção" — não exige clique.
  const examEfetivo = selectedExam ?? (matches.length === 1 ? matches[0] : null);

  const fontesPagadoras = useMemo(
    () => (examEfetivo ? fontesPagadorasPorTuss(payors, examEfetivo.tuss) : []),
    [payors, examEfetivo]
  );

  const handleSelectExam = (exam: Exam) => {
    setSelectedExam(exam);
    setSearch('');
  };

  const handleClear = () => {
    setSelectedExam(null);
    setSearch('');
  };

  const mostrarDropdown = !selectedExam && termoDigitado && matches.length > 1;
  const mostrarNenhumEncontrado = !selectedExam && termoDigitado && matches.length === 0;
  const mostrarConvite = !selectedExam && !termoDigitado;

  return (
    <div className="space-y-5">
      {/* Header + search */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Fontes Pagadoras</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Busque por exame ou código TUSS para ver as fontes pagadoras e valores cobrados.
          </p>
        </div>

        <div className="mt-5 relative">
          {selectedExam ? (
            <div className="flex items-center gap-2 pl-9 pr-2 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
              <span className="flex-1 min-w-0 text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
                {selectedExam.name}
                <span className="ml-2 font-mono text-xs text-blue-500 dark:text-blue-400">{selectedExam.tuss}</span>
              </span>
              <button
                type="button"
                onClick={handleClear}
                aria-label="Limpar exame selecionado"
                className="shrink-0 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por exame ou código TUSS…"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
              {mostrarDropdown && (
                <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-64 overflow-y-auto">
                  {matches.map(exam => (
                    <li key={exam.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectExam(exam)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{exam.name}</span>
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">{exam.tuss}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {mostrarConvite && (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Pesquise por um exame ou código TUSS para ver as fontes pagadoras.
        </div>
      )}

      {mostrarNenhumEncontrado && (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum exame encontrado.
        </div>
      )}

      {examEfetivo && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left font-bold">Fonte Pagadora</th>
                  <th className="px-5 py-3 text-left font-bold">Tabela Associada</th>
                  <th className="px-5 py-3 text-right font-bold">Valor Cobrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {fontesPagadoras.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhuma fonte pagadora cadastrada para este exame.
                    </td>
                  </tr>
                ) : (
                  fontesPagadoras.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/[.04] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-semibold text-gray-800 dark:text-gray-100">{p.payor}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {p.table}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        {formatBRL(p.price)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/30 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>
              {fontesPagadoras.length} {fontesPagadoras.length === 1 ? 'fonte pagadora' : 'fontes pagadoras'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Dados somente leitura — espelhados do APLIS
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayorsScreen;
