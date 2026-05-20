import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  ArrowLeft,
  Folder,
  LayoutGrid,
  Loader2,
  Check,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ITProject, ITSprint } from './ITKanbanBoard';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { hex: '#6366f1', label: 'Índigo' },
  { hex: '#8b5cf6', label: 'Violeta' },
  { hex: '#ec4899', label: 'Rosa' },
  { hex: '#ef4444', label: 'Vermelho' },
  { hex: '#f59e0b', label: 'Âmbar' },
  { hex: '#10b981', label: 'Esmeralda' },
  { hex: '#06b6d4', label: 'Ciano' },
  { hex: '#3b82f6', label: 'Azul' },
  { hex: '#64748b', label: 'Ardósia' },
];

const KANBAN_COLUMNS = [
  { value: 'backlog',     label: 'Backlog' },
  { value: 'todo',        label: 'A Fazer' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'review',      label: 'Revisão' },
  { value: 'done',        label: 'Concluído' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalView = 'choose' | 'create-project' | 'add-card';

interface KanbanPromoteModalProps {
  request: {
    id: string;
    title: string;
    description: string | null;
    project_id?: string | null;
    sprint_id?: string | null;
    kanban_status: string;
    kanban_hidden: boolean;
  };
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const KanbanPromoteModal: React.FC<KanbanPromoteModalProps> = ({
  request,
  userId,
  onClose,
  onSuccess,
}) => {
  const isEditMode = !!request.project_id;

  const [view, setView] = useState<ModalView>(isEditMode ? 'add-card' : 'choose');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create project form
  const [projectName, setProjectName] = useState(request.title);
  const [projectDesc, setProjectDesc] = useState(request.description ?? '');
  const [projectColor, setProjectColor] = useState(PRESET_COLORS[0].hex);
  const [createColumn, setCreateColumn] = useState('backlog');

  // Add/edit card form — pre-filled when editing
  const [projects, setProjects] = useState<ITProject[]>([]);
  const [sprints, setSprints] = useState<ITSprint[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(request.project_id ?? '');
  const [selectedSprintId, setSelectedSprintId] = useState(request.sprint_id ?? '');
  const [cardColumn, setCardColumn] = useState(request.kanban_status ?? 'backlog');

  // Prevent resetting sprint selection on the very first fetch (pre-fill case)
  const isFirstSprintFetch = useRef(true);

  // Fetch projects when entering add-card view
  useEffect(() => {
    if (view !== 'add-card') return;
    setLoadingProjects(true);
    supabase
      .from('it_projects')
      .select('*')
      .order('name')
      .then(({ data }) => {
        setProjects(data ?? []);
        setLoadingProjects(false);
      });
  }, [view]);

  // Fetch sprints when project changes; skip reset on initial pre-filled load
  useEffect(() => {
    if (!selectedProjectId) {
      setSprints([]);
      if (!isFirstSprintFetch.current) setSelectedSprintId('');
      return;
    }
    supabase
      .from('it_sprints')
      .select('*')
      .eq('project_id', selectedProjectId)
      .order('created_at')
      .then(({ data }) => {
        setSprints(data ?? []);
        if (!isFirstSprintFetch.current) setSelectedSprintId('');
        isFirstSprintFetch.current = false;
      });
  }, [selectedProjectId]);

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError('Nome do projeto é obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: project, error: projErr } = await supabase
        .from('it_projects')
        .insert({
          name: projectName.trim(),
          description: projectDesc.trim() || null,
          color: projectColor,
          created_by: userId,
        })
        .select()
        .single();

      if (projErr) throw projErr;

      const { error: reqErr } = await supabase
        .from('it_requests')
        .update({
          project_id: project.id,
          kanban_hidden: false,
          kanban_status: createColumn,
        })
        .eq('id', request.id);

      if (reqErr) throw reqErr;

      onSuccess();
    } catch {
      setError('Erro ao criar projeto. Tente novamente.');
      setSaving(false);
    }
  };

  const handleSaveCard = async () => {
    if (!selectedProjectId) {
      setError('Selecione um projeto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: reqErr } = await supabase
        .from('it_requests')
        .update({
          project_id: selectedProjectId,
          sprint_id: selectedSprintId || null,
          kanban_hidden: false,
          kanban_status: cardColumn,
        })
        .eq('id', request.id);

      if (reqErr) throw reqErr;

      onSuccess();
    } catch {
      setError('Erro ao salvar. Tente novamente.');
      setSaving(false);
    }
  };

  const handleRemoveFromKanban = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: reqErr } = await supabase
        .from('it_requests')
        .update({ kanban_hidden: true })
        .eq('id', request.id);

      if (reqErr) throw reqErr;

      onSuccess();
    } catch {
      setError('Erro ao remover do Kanban.');
      setSaving(false);
    }
  };

  const viewTitles: Record<ModalView, string> = {
    choose: 'Adicionar ao Kanban',
    'create-project': 'Criar Projeto',
    'add-card': isEditMode ? 'Editar no Kanban' : 'Adicionar como Card',
  };

  const showBackButton = !isEditMode && view !== 'choose';

  const panel = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        {/* Color accent bar */}
        <div className="h-1 bg-gradient-to-r from-violet-500 to-blue-500" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          {showBackButton && (
            <button
              onClick={() => { setView('choose'); setError(null); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">
            {viewTitles[view]}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <AnimatePresence mode="wait">
          {view === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="p-6 space-y-3"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Como deseja adicionar{' '}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  "{request.title}"
                </span>{' '}
                ao Kanban?
              </p>

              <button
                onClick={() => setView('create-project')}
                className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-200 dark:group-hover:bg-violet-900/60 transition-colors">
                  <Folder className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Criar Projeto</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Cria um novo projeto com os dados desta solicitação
                  </p>
                </div>
              </button>

              <button
                onClick={() => setView('add-card')}
                className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/60 transition-colors">
                  <LayoutGrid className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Card em Projeto</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Adiciona a um projeto e sprint existentes
                  </p>
                </div>
              </button>
            </motion.div>
          )}

          {view === 'create-project' && (
            <motion.div
              key="create-project"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.15 }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nome do projeto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  placeholder="Nome do projeto"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Descrição
                </label>
                <textarea
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none"
                  placeholder="Descrição opcional"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cor
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      onClick={() => setProjectColor(c.hex)}
                      className="w-7 h-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: c.hex }}
                    >
                      {projectColor === c.hex && (
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Coluna inicial
                </label>
                <select
                  value={createColumn}
                  onChange={(e) => setCreateColumn(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                >
                  {KANBAN_COLUMNS.map((col) => (
                    <option key={col.value} value={col.value}>{col.label}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { setView('choose'); setError(null); }}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors disabled:opacity-70"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Folder className="w-4 h-4" />}
                  Criar Projeto
                </button>
              </div>
            </motion.div>
          )}

          {view === 'add-card' && (
            <motion.div
              key="add-card"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.15 }}
              className="p-6 space-y-4"
            >
              {/* Project select */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Projeto <span className="text-red-500">*</span>
                </label>
                {loadingProjects ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando projetos…
                  </div>
                ) : projects.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-1">Nenhum projeto encontrado.</p>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  >
                    <option value="">Selecionar projeto</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Sprint select */}
              {selectedProjectId && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Sprint <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <select
                    value={selectedSprintId}
                    onChange={(e) => setSelectedSprintId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  >
                    <option value="">Nenhuma sprint</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Column */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Coluna
                </label>
                <select
                  value={cardColumn}
                  onChange={(e) => setCardColumn(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                >
                  {KANBAN_COLUMNS.map((col) => (
                    <option key={col.value} value={col.value}>{col.label}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex items-center justify-between pt-1">
                {/* Remove from kanban — only when editing */}
                {isEditMode && !request.kanban_hidden ? (
                  <button
                    onClick={handleRemoveFromKanban}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover do Kanban
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex gap-2">
                  <button
                    onClick={isEditMode ? onClose : () => { setView('choose'); setError(null); }}
                    disabled={saving}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveCard}
                    disabled={saving || !selectedProjectId}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-70"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />}
                    {isEditMode ? 'Salvar' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );

  return ReactDOM.createPortal(
    <AnimatePresence>{panel}</AnimatePresence>,
    document.body
  );
};

export default KanbanPromoteModal;
