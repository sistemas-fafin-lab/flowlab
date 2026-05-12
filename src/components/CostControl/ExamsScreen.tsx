import React, { useState, useMemo } from 'react';
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

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ExamsScreenProps {
  exams: Exam[];
  addExam: (data: Omit<Exam, 'id'>) => void;
  updateExam: (id: string, data: Partial<Omit<Exam, 'id'>>) => void;
  deleteExam: (id: string) => void;
}

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

const ExamsScreen: React.FC<ExamsScreenProps> = ({ exams, addExam, updateExam, deleteExam }) => {
  const { notification, showSuccess, hideNotification } = useNotification();
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

  const locations = useMemo(
    () => Array.from(new Set(exams.map(e => e.location))).sort(),
    [exams]
  );

  const filtered = useMemo(
    () =>
      exams.filter(e => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q);
        const matchesLoc = location === 'all' || e.location === location;
        return matchesSearch && matchesLoc;
      }),
    [exams, search, location]
  );

  const stats = useMemo(() => {
    const totalCost = exams.reduce((s, e) => s + e.direct + e.indirect, 0);
    return {
      count: exams.length,
      totalCost,
      avgCost: exams.length ? totalCost / exams.length : 0,
    };
  }, [exams]);

  const handleSave = (data: Omit<Exam, 'id'>) => {
    if (editing) {
      updateExam(editing.id, data);
      showSuccess('Exame atualizado com sucesso!');
    } else {
      addExam(data);
      showSuccess('Exame cadastrado com sucesso!');
    }
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = (exam: Exam) => {
    showConfirmDialog(
      'Excluir exame',
      `Tem certeza que deseja excluir "${exam.name}"? Esta ação não pode ser desfeita.`,
      () => {
        deleteExam(exam.id);
        showSuccess('Exame excluído com sucesso!');
      },
      { type: 'danger', confirmText: 'Excluir' }
    );
  };

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (exam: Exam) => { setEditing(exam); setModalOpen(true); };

  const btnGhost =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[.98] transition-all';

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
            <button className={btnGhost}>
              <Download className="w-4 h-4" /> Exportar
            </button>
            <button className={btnGhost}>
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
      <ExamTable exams={filtered} onEdit={openEdit} onDelete={handleDelete} />

      {/* Modal */}
      <ExamFormModal
        open={modalOpen}
        exam={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
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
