import React, { useState, useMemo } from 'react';
import { Search, Building2, Table2, ChevronDown, RefreshCw, Download, Lock } from 'lucide-react';
import { Exam, Payor, formatBRL } from '../../hooks/useCostControl';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PayorsScreenProps {
  payors: Payor[];
  exams: Exam[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// APLIS SYNC BADGE
// ═══════════════════════════════════════════════════════════════════════════════

const AplisSyncBadge: React.FC = () => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
    </span>
    Sincronizado com APLIS
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PayorsScreen: React.FC<PayorsScreenProps> = ({ payors, exams }) => {
  const [search, setSearch] = useState('');
  const [payorFilter, setPayorFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');

  const examMap = useMemo(
    () => Object.fromEntries(exams.map(e => [e.id, e])),
    [exams]
  );

  const payorList = useMemo(
    () => Array.from(new Set(payors.map(p => p.payor))).sort(),
    [payors]
  );

  const tableList = useMemo(
    () => Array.from(new Set(payors.map(p => p.table))).sort(),
    [payors]
  );

  const filtered = useMemo(
    () =>
      payors.filter(p => {
        const ex = examMap[p.examId];
        const matchesSearch =
          !search ||
          ex?.name.toLowerCase().includes(search.toLowerCase()) ||
          p.tus.toLowerCase().includes(search.toLowerCase());
        const matchesPayor = payorFilter === 'all' || p.payor === payorFilter;
        const matchesTable = tableFilter === 'all' || p.table === tableFilter;
        return matchesSearch && matchesPayor && matchesTable;
      }),
    [payors, examMap, search, payorFilter, tableFilter]
  );

  const selectCls =
    'w-full appearance-none pl-9 pr-9 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';

  const btnGhost =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[.98] transition-all';

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Fontes Pagadoras</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Convênios, tabelas de preço e valores cobrados por exame.
            </p>
            <div className="mt-3">
              <AplisSyncBadge />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={btnGhost}>
              <RefreshCw className="w-4 h-4" /> Atualizar do APLIS
            </button>
            <button className={btnGhost}>
              <Download className="w-4 h-4" /> Exportar (Excel)
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por exame ou código TUS…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Payor filter */}
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select value={payorFilter} onChange={e => setPayorFilter(e.target.value)} className={selectCls}>
              <option value="all">Todos os convênios</option>
              {payorList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Table filter */}
          <div className="relative">
            <Table2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select value={tableFilter} onChange={e => setTableFilter(e.target.value)} className={selectCls}>
              <option value="all">Todas as tabelas</option>
              {tableList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-gray-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left font-bold">Fonte Pagadora</th>
                <th className="px-5 py-3 text-left font-bold">Tabela Associada</th>
                <th className="px-5 py-3 text-left font-bold">Código TUS</th>
                <th className="px-5 py-3 text-left font-bold">Nome do Exame</th>
                <th className="px-5 py-3 text-right font-bold">Valor Cobrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum registro para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const ex = examMap[p.examId];
                  return (
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
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{p.tus}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{ex?.name ?? '—'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{ex?.code}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        {formatBRL(p.price)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/30 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <span>
            {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Dados somente leitura — espelhados do APLIS
          </span>
        </div>
      </div>
    </div>
  );
};

export default PayorsScreen;
