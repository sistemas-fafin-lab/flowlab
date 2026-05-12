import React, { useState, useMemo } from 'react';
import {
  Layers,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  SlidersHorizontal,
  Building2,
  ChevronDown,
  Calendar,
  Plus,
  X,
  Download,
  Info,
} from 'lucide-react';
import { Exam, Payor, formatBRL, formatPct } from '../../hooks/useCostControl';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AnalyticsScreenProps {
  exams: Exam[];
  payors: Payor[];
}

type FilterOp = 'gt' | 'lt' | 'eq' | 'between';
type FilterField = 'cost' | 'revenue' | 'profit' | 'margin';

interface AdvancedFilter {
  field: FilterField;
  op: FilterOp;
  val: string;
  val2: string;
}

interface RentabilidadeRow {
  id: string;
  exam: Exam;
  cost: number;
  revenue: number;
  profit: number;
  margin: number;
  payor: string;
  table: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════════════════════

type StatTone = 'blue' | 'green' | 'amber' | 'red';

const STAT_TONES: Record<StatTone, string> = {
  blue:  'bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  green: 'bg-gradient-to-br from-emerald-500/10 to-green-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  amber: 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  red:   'bg-gradient-to-br from-red-500/10 to-rose-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  tone?: StatTone;
}> = ({ icon, label, value, sub, tone = 'blue' }) => (
  <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</div>
      </div>
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${STAT_TONES[tone]}`}>
        {icon}
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED FILTER ROW
// ═══════════════════════════════════════════════════════════════════════════════

const FILTER_FIELDS: { k: FilterField; label: string }[] = [
  { k: 'cost',    label: 'Custo Total' },
  { k: 'revenue', label: 'Receita' },
  { k: 'profit',  label: 'Lucro/Prejuízo' },
  { k: 'margin',  label: 'Margem (%)' },
];

const FILTER_OPS: { v: FilterOp; label: string }[] = [
  { v: 'gt',      label: 'Maior que' },
  { v: 'lt',      label: 'Menor que' },
  { v: 'eq',      label: 'Igual a' },
  { v: 'between', label: 'Entre' },
];

const selectCls =
  'px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500';

const inputNumCls =
  'w-24 px-2 py-1.5 text-xs tabular-nums rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500';

const AdvancedFilterRow: React.FC<{
  filter: AdvancedFilter;
  onChange: (f: AdvancedFilter) => void;
  onRemove: () => void;
}> = ({ filter, onChange, onRemove }) => (
  <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
    <select
      value={filter.field}
      onChange={e => onChange({ ...filter, field: e.target.value as FilterField })}
      className={selectCls}
    >
      {FILTER_FIELDS.map(f => <option key={f.k} value={f.k}>{f.label}</option>)}
    </select>

    <select
      value={filter.op}
      onChange={e => onChange({ ...filter, op: e.target.value as FilterOp })}
      className={selectCls}
    >
      {FILTER_OPS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>

    <input
      type="number"
      step="0.01"
      value={filter.val}
      onChange={e => onChange({ ...filter, val: e.target.value })}
      className={inputNumCls}
    />

    {filter.op === 'between' && (
      <>
        <span className="text-xs text-gray-400">e</span>
        <input
          type="number"
          step="0.01"
          value={filter.val2}
          onChange={e => onChange({ ...filter, val2: e.target.value })}
          className={inputNumCls}
        />
      </>
    )}

    <button
      onClick={onRemove}
      className="ml-1 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// INFO TOOLTIP
// ═══════════════════════════════════════════════════════════════════════════════

const InfoTooltip: React.FC<{ content: string; children: React.ReactNode }> = ({ children, content }) => {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className="absolute bottom-full right-0 mb-2 w-64 p-3 rounded-xl bg-gray-900 dark:bg-gray-700 text-white text-xs leading-relaxed shadow-xl z-30">
          {content}
          <span className="absolute -bottom-1 right-3 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
        </span>
      )}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ exams, payors }) => {
  const [filters, setFilters] = useState<AdvancedFilter[]>([
    { field: 'margin', op: 'lt', val: '0', val2: '0' },
  ]);
  const [payorFilter, setPayorFilter] = useState('Saldo de Caixa');
  const [dateFrom, setDateFrom] = useState('2026-04-01');
  const [dateTo, setDateTo] = useState('2026-04-30');

  const examMap = useMemo(() => Object.fromEntries(exams.map(e => [e.id, e])), [exams]);

  const payorList = useMemo(
    () => Array.from(new Set(payors.map(p => p.payor))).sort(),
    [payors]
  );

  // Build rentabilidade rows for the selected payor
  const rows = useMemo<RentabilidadeRow[]>(() => {
    const filteredP = payors.filter(p => payorFilter === 'all' || p.payor === payorFilter);
    return filteredP.flatMap(p => {
      const ex = examMap[p.examId];
      if (!ex) return [];
      const cost = ex.direct + ex.indirect;
      const revenue = p.price;
      const profit = revenue - cost;
      const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
      return [{ id: p.id, exam: ex, cost, revenue, profit, margin, payor: p.payor, table: p.table }];
    });
  }, [payors, examMap, payorFilter]);

  // Apply advanced filters
  const filteredRows = useMemo(
    () =>
      rows.filter(r =>
        filters.every(f => {
          const v: number = r[f.field as keyof RentabilidadeRow] as number;
          const a = parseFloat(f.val);
          const b = parseFloat(f.val2);
          switch (f.op) {
            case 'gt':     return isNaN(a) || v > a;
            case 'lt':     return isNaN(a) || v < a;
            case 'eq':     return isNaN(a) || Math.abs(v - a) < 0.01;
            case 'between':
              if (isNaN(a) || isNaN(b)) return true;
              return v >= Math.min(a, b) && v <= Math.max(a, b);
            default: return true;
          }
        })
      ),
    [rows, filters]
  );

  const summary = useMemo(() => {
    const totalCost = filteredRows.reduce((s, r) => s + r.cost, 0);
    const totalRev  = filteredRows.reduce((s, r) => s + r.revenue, 0);
    const totalProfit = totalRev - totalCost;
    const lossCount = filteredRows.filter(r => r.profit < 0).length;
    return { totalCost, totalRev, totalProfit, lossCount, count: filteredRows.length };
  }, [filteredRows]);

  const addFilter = () =>
    setFilters(f => [...f, { field: 'cost', op: 'gt', val: '0', val2: '0' }]);

  const updateFilter = (i: number, nf: AdvancedFilter) =>
    setFilters(f => f.map((x, j) => (j === i ? nf : x)));

  const removeFilter = (i: number) =>
    setFilters(f => f.filter((_, j) => j !== i));

  const fieldSelectCls =
    'w-full appearance-none pl-9 pr-9 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';

  const inputDateCls =
    'w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';

  return (
    <div className="space-y-5">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Layers className="w-5 h-5" />}
          label="Exames analisados"
          value={summary.count}
          sub="Período: abr/2026"
          tone="blue"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Receita total"
          value={formatBRL(summary.totalRev)}
          sub="Soma das fontes pagadoras"
          tone="green"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Custo total"
          value={formatBRL(summary.totalCost)}
          sub="Direto + indireto"
          tone="amber"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Exames com prejuízo"
          value={summary.lossCount}
          sub={
            summary.count
              ? `${((summary.lossCount / summary.count) * 100).toFixed(0)}% da carteira`
              : '—'
          }
          tone={summary.lossCount > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Advanced filters card */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Filtros avançados</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Combine condições para isolar cenários de rentabilidade.
              </p>
            </div>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/25 active:scale-[.98] transition-all">
            <Download className="w-4 h-4" /> Exportar relatório
          </button>
        </div>

        {/* Base filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {/* Payor */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Fonte pagadora</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select value={payorFilter} onChange={e => setPayorFilter(e.target.value)} className={fieldSelectCls}>
                <option value="all">Todos os convênios</option>
                {payorList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Date from */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Data inicial</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputDateCls} />
            </div>
          </div>

          {/* Date to */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Data final</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputDateCls} />
            </div>
          </div>
        </div>

        {/* Dynamic condition filters */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Condições
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((f, i) => (
              <AdvancedFilterRow
                key={i}
                filter={f}
                onChange={nf => updateFilter(i, nf)}
                onRemove={() => removeFilter(i)}
              />
            ))}
            <button
              onClick={addFilter}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar condição
            </button>
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Pré-visualização de rentabilidade
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Linhas em vermelho indicam <strong>prejuízo</strong> (Custo / Receita &gt; 100%).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-current" /> Lucro
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-current" /> Margem &lt; 10%
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-current" /> Prejuízo
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-gray-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left font-bold">Exame</th>
                <th className="px-5 py-3 text-left font-bold">Pagador / Tabela</th>
                <th className="px-5 py-3 text-right font-bold">Custo Total</th>
                <th className="px-5 py-3 text-right font-bold">Receita</th>
                <th className="px-5 py-3 text-right font-bold">Lucro/Prejuízo</th>
                <th className="px-5 py-3 text-right font-bold">Margem</th>
                <th className="px-5 py-3 text-center font-bold w-32">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum resultado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredRows.map(r => {
                  const isLoss = r.profit < 0;
                  const isThin = !isLoss && r.margin < 10;
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors ${
                        isLoss
                          ? 'bg-red-50/40 dark:bg-red-500/[.05] hover:bg-red-50/70 dark:hover:bg-red-500/[.08]'
                          : 'hover:bg-blue-50/40 dark:hover:bg-blue-500/[.04]'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-800 dark:text-gray-100">{r.exam.name}</span>
                          {isLoss && (
                            <InfoTooltip content="Exames podem ser mantidos no portfólio mesmo com prejuízo unitário, por integrarem painéis lucrativos maiores ou contratos de exclusividade. Avalie em conjunto.">
                              <span className="text-amber-500 cursor-help inline-flex">
                                <Info className="w-3.5 h-3.5" />
                              </span>
                            </InfoTooltip>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                          {r.exam.code} · {r.exam.location}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{r.payor}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{r.table}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-gray-200">
                        {formatBRL(r.cost)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-gray-200">
                        {formatBRL(r.revenue)}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right tabular-nums font-bold ${
                          isLoss ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isLoss ? '−' : '+'}
                        {formatBRL(Math.abs(r.profit))}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right tabular-nums font-semibold ${
                          isLoss
                            ? 'text-red-600 dark:text-red-400'
                            : isThin
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {formatPct(r.margin)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isLoss ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-current" /> Prejuízo
                          </span>
                        ) : isThin ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-current" /> Margem baixa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-current" /> Lucro
                          </span>
                        )}
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
            {filteredRows.length} {filteredRows.length === 1 ? 'linha' : 'linhas'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            Resultado líquido:{' '}
            <strong
              className={`tabular-nums ${
                summary.totalProfit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {summary.totalProfit >= 0 ? '+' : '−'}
              {formatBRL(Math.abs(summary.totalProfit))}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsScreen;
