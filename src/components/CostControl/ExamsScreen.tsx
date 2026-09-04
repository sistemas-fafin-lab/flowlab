import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  Filter,
  ChevronDown,
  Download,
  Upload,
  Plus,
  FlaskConical,
  DollarSign,
  BarChart3,
} from 'lucide-react';
import { Exam, formatBRL } from '../../hooks/useCostControl';
import { useNotification } from '../../hooks/useNotification';
import { useDialog } from '../../hooks/useDialog';
import Notification from '../Notification';
import ConfirmDialog from '../ConfirmDialog';
import ExamTable from './ExamTable';
import ExamFormModal from './ExamFormModal';
import ExamImportModal from './ExamImportModal';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ExamsScreenProps {
  exams: Exam[];
  addExam: (data: Omit<Exam, 'id'>) => Promise<void>;
  updateExam: (id: string, data: Partial<Omit<Exam, 'id'>>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  importExams: (rows: Omit<Exam, 'id'>[]) => Promise<number>;
}

// O catálogo passa de 500 exames — sem paginação a tabela renderizava tudo de
// uma vez, deixando a página com ~35 mil px de altura (a barra de rolagem
// virava um fio, "voando" a qualquer toque na roda do mouse).
const ITEMS_PER_PAGE = 25;

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════════════════════

type StatTone = 'blue' | 'green' | 'amber';

const STAT_TONES: Record<StatTone, string> = {
  blue:  'bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  green: 'bg-gradient-to-br from-emerald-500/10 to-green-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  amber: 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
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
// EXAMS SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

const ExamsScreen: React.FC<ExamsScreenProps> = ({ exams, addExam, updateExam, deleteExam, importExams }) => {
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const {
    confirmDialog,
    showConfirmDialog,
    hideConfirmDialog,
    handleConfirmDialogConfirm,
  } = useDialog();

  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);

  const locations = useMemo(
    () => Array.from(new Set(exams.map(e => e.location).filter(Boolean))).sort(),
    [exams]
  );

  const filtered = useMemo(
    () =>
      exams.filter(e => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.code.toLowerCase().includes(q) ||
          e.tuss.toLowerCase().includes(q);
        const matchesLoc = location === 'all' || e.location === location;
        return matchesSearch && matchesLoc;
      }),
    [exams, search, location]
  );

  // Reseta a paginação sempre que o recorte (busca/local) muda — senão o
  // usuário pode ficar "preso" numa página 5 que não existe mais no recorte novo.
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [search, location]);

  const displayedExams = useMemo(() => filtered.slice(0, displayCount), [filtered, displayCount]);
  const hasMoreExams = filtered.length > displayCount;

  const stats = useMemo(() => {
    const totalCost = exams.reduce((s, e) => s + e.direct + e.indirect, 0);
    return {
      count: exams.length,
      totalCost,
      avgCost: exams.length ? totalCost / exams.length : 0,
    };
  }, [exams]);

  const handleSave = async (data: Omit<Exam, 'id'>) => {
    try {
      if (editing) {
        await updateExam(editing.id, data);
        showSuccess('Exame atualizado com sucesso!');
      } else {
        await addExam(data);
        showSuccess('Exame cadastrado com sucesso!');
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      showError('Erro ao salvar exame', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDelete = (exam: Exam) => {
    showConfirmDialog(
      'Excluir exame',
      `Tem certeza que deseja excluir "${exam.name}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await deleteExam(exam.id);
          setSelectedIds(prev => {
            if (!prev.has(exam.id)) return prev;
            const next = new Set(prev);
            next.delete(exam.id);
            return next;
          });
          showSuccess('Exame excluído com sucesso!');
        } catch (err) {
          showError('Erro ao excluir exame', err instanceof Error ? err.message : undefined);
        }
      },
      { type: 'danger', confirmText: 'Excluir' }
    );
  };

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (exam: Exam) => { setEditing(exam); setModalOpen(true); };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allSelected = displayedExams.every(e => selectedIds.has(e.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      displayedExams.forEach(e => (allSelected ? next.delete(e.id) : next.add(e.id)));
      return next;
    });
  };

  // Fecha o dropdown de exportação ao clicar fora dele.
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [exportMenuOpen]);

  const handleExport = (scope: 'all' | 'selected') => {
    const source = scope === 'selected' ? filtered.filter(e => selectedIds.has(e.id)) : filtered;
    if (source.length === 0) {
      showError(scope === 'selected' ? 'Nenhum exame selecionado' : 'Nenhum exame para exportar');
      return;
    }

    const data = source.map(e => ({
      CODIGO: e.code,
      TUSS: e.tuss,
      'NOME DO EXAME': e.name,
      LOCAL: e.location,
      'CUSTO DIRETO': e.direct,
      'CUSTO INDIRETO': e.indirect,
      'CUSTO TOTAL': e.direct + e.indirect,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Exames');

    const suffix = scope === 'selected' ? 'selecionados' : 'todos';
    const filename = `exames_controle_custos_${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    setExportMenuOpen(false);
  };

  const btnGhost =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[.98] transition-all';

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<FlaskConical className="w-5 h-5" />}
          label="Exames cadastrados"
          value={stats.count}
          sub="No catálogo"
          tone="blue"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Custo total da carteira"
          value={formatBRL(stats.totalCost)}
          sub="Soma de todos os exames"
          tone="amber"
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Custo médio por exame"
          value={formatBRL(stats.avgCost)}
          sub="Direto + indireto"
          tone="green"
        />
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou código…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Location filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="pl-9 pr-9 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 appearance-none"
            >
              <option value="all">Todos os locais</option>
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={exportMenuRef}>
              <button className={btnGhost} onClick={() => setExportMenuOpen(o => !o)}>
                <Download className="w-4 h-4" /> Exportar
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 lg:left-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={() => handleExport('all')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                  >
                    Todos os valores
                    <div className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} exame{filtered.length !== 1 ? 's' : ''}</div>
                  </button>
                  <button
                    onClick={() => handleExport('selected')}
                    disabled={selectedIds.size === 0}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent border-t border-gray-100 dark:border-gray-700"
                  >
                    Somente selecionados
                    <div className="text-xs text-gray-400 dark:text-gray-500">{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</div>
                  </button>
                </div>
              )}
            </div>
            <button className={btnGhost} onClick={() => setImportModalOpen(true)}>
              <Upload className="w-4 h-4" /> Importar
            </button>
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/25 active:scale-[.98] transition-all"
            >
              <Plus className="w-4 h-4" /> Novo exame
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <ExamTable
        exams={displayedExams}
        selectedIds={selectedIds}
        onToggleOne={toggleOne}
        onToggleAll={toggleAll}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {/* Show more */}
      {hasMoreExams && (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => setDisplayCount(c => c + ITEMS_PER_PAGE)}
            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium text-sm"
          >
            Exibir mais {Math.min(ITEMS_PER_PAGE, filtered.length - displayCount)}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Exibindo {displayedExams.length} de {filtered.length} exames
          </span>
        </div>
      )}

      {/* Modal */}
      <ExamFormModal
        open={modalOpen}
        exam={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
      />
      <ExamImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={importExams}
      />

      {/* Feedback components */}
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={hideConfirmDialog}
      />
    </div>
  );
};

export default ExamsScreen;
