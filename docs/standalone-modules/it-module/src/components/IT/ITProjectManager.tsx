import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Plus,
  Folder,
  FolderOpen,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Zap,
  Check,
  Calendar,
  Target,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ITProject, ITSprint } from './ITKanbanBoard';

// ─── Preset colors ────────────────────────────────────────────────────────────
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

const SPRINT_STATUS_CONFIG: Record<ITSprint['status'], { label: string; badge: string; dot: string }> = {
  planned:   { label: 'Planejado', badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',       dot: 'bg-gray-400' },
  active:    { label: 'Ativo',     badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  completed: { label: 'Concluído', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',    dot: 'bg-blue-500' },
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ProjectFormData {
  name: string;
  description: string;
  color: string;
}

interface SprintFormData {
  name: string;
  goal: string;
  start_date: string;
  end_date: string;
  status: ITSprint['status'];
}

const emptyProjectForm = (): ProjectFormData => ({ name: '', description: '', color: '#6366f1' });
const emptySprintForm  = (): SprintFormData  => ({ name: '', goal: '', start_date: '', end_date: '', status: 'planned' });

// ─── Component ─────────────────────────────────────────────────────────────────
interface ITProjectManagerProps {
  userId: string;
  onClose: () => void;
  onDataChanged: () => void;
}

const ITProjectManager: React.FC<ITProjectManagerProps> = ({ userId, onClose, onDataChanged }) => {
  const [projects,   setProjects]   = useState<ITProject[]>([]);
  const [sprints,    setSprints]    = useState<ITSprint[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Project form state
  const [editingProject,  setEditingProject]  = useState<ITProject | null>(null);
  const [projectForm,     setProjectForm]     = useState<ProjectFormData>(emptyProjectForm());
  const [showProjectForm, setShowProjectForm] = useState(false);

  // Sprint form: one open at a time, keyed by project_id
  const [openSprintForms, setOpenSprintForms] = useState<Set<string>>(new Set());
  const [sprintForms,     setSprintForms]     = useState<Record<string, SprintFormData>>({});
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);

  // Expanded projects in list
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Delete confirmation
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleteSprintId,  setDeleteSprintId]  = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (showProjectForm && firstInputRef.current) firstInputRef.current.focus();
  }, [showProjectForm]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, sprintRes] = await Promise.all([
        supabase.from('it_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('it_sprints').select('*').order('created_at', { ascending: false }),
      ]);
      if (projRes.error)   throw projRes.error;
      if (sprintRes.error) throw sprintRes.error;
      setProjects(projRes.data   as ITProject[]);
      setSprints(sprintRes.data  as ITSprint[]);
    } catch (err: any) {
      setError('Erro ao carregar dados. Tente novamente.');
      console.error('[ITProjectManager] fetchAll error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Project CRUD ──────────────────────────────────────────────────────────

  const openNewProject = () => {
    setEditingProject(null);
    setProjectForm(emptyProjectForm());
    setShowProjectForm(true);
  };

  const openEditProject = (project: ITProject) => {
    setEditingProject(project);
    setProjectForm({ name: project.name, description: project.description ?? '', color: project.color });
    setShowProjectForm(true);
  };

  const cancelProjectForm = () => {
    setShowProjectForm(false);
    setEditingProject(null);
  };

  const saveProject = async () => {
    if (!projectForm.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingProject) {
        const { error } = await supabase.from('it_projects').update({
          name: projectForm.name.trim(),
          description: projectForm.description.trim() || null,
          color: projectForm.color,
        }).eq('id', editingProject.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('it_projects').insert({
          name: projectForm.name.trim(),
          description: projectForm.description.trim() || null,
          color: projectForm.color,
          created_by: userId,
        });
        if (error) throw error;
      }
      setShowProjectForm(false);
      setEditingProject(null);
      await fetchAll();
      onDataChanged();
    } catch (err: any) {
      setError('Erro ao salvar projeto.');
      console.error('[ITProjectManager] saveProject error:', err);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteProject = async () => {
    if (!deleteProjectId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('it_projects').delete().eq('id', deleteProjectId);
      if (error) throw error;
      setDeleteProjectId(null);
      if (editingProject?.id === deleteProjectId) cancelProjectForm();
      await fetchAll();
      onDataChanged();
    } catch (err: any) {
      setError('Erro ao excluir projeto.');
      console.error('[ITProjectManager] deleteProject error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ─── Sprint CRUD ───────────────────────────────────────────────────────────

  const openSprintForm = (projectId: string, sprint?: ITSprint) => {
    setEditingSprintId(sprint?.id ?? null);
    setOpenSprintForms(prev => new Set(prev).add(projectId));
    setSprintForms(prev => ({
      ...prev,
      [projectId]: sprint
        ? { name: sprint.name, goal: sprint.goal ?? '', start_date: sprint.start_date ?? '', end_date: sprint.end_date ?? '', status: sprint.status }
        : emptySprintForm(),
    }));
  };

  const cancelSprintForm = (projectId: string) => {
    setOpenSprintForms(prev => { const s = new Set(prev); s.delete(projectId); return s; });
    setEditingSprintId(null);
  };

  const saveSprint = async (projectId: string) => {
    const form = sprintForms[projectId];
    if (!form?.name.trim()) return;
    setSaving(true);
    setError(null);

    // Pre-flight: check if activating while another is already active
    if (form.status === 'active') {
      const existing = sprints.find(s => s.project_id === projectId && s.status === 'active' && s.id !== editingSprintId);
      if (existing) {
        setError(`Já existe uma sprint ativa neste projeto ("${existing.name}"). Conclua-a primeiro.`);
        setSaving(false);
        return;
      }
    }

    try {
      const payload = {
        project_id:  projectId,
        name:        form.name.trim(),
        goal:        form.goal.trim() || null,
        start_date:  form.start_date || null,
        end_date:    form.end_date   || null,
        status:      form.status,
      };

      if (editingSprintId) {
        const { error } = await supabase.from('it_sprints').update(payload).eq('id', editingSprintId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('it_sprints').insert(payload);
        if (error) throw error;
      }

      cancelSprintForm(projectId);
      await fetchAll();
      onDataChanged();
    } catch (err: any) {
      if (err?.code === '23505') {
        setError('Já existe uma sprint ativa neste projeto. Conclua-a antes de ativar outra.');
      } else {
        setError('Erro ao salvar sprint.');
      }
      console.error('[ITProjectManager] saveSprint error:', err);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteSprint = async () => {
    if (!deleteSprintId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('it_sprints').delete().eq('id', deleteSprintId);
      if (error) throw error;
      setDeleteSprintId(null);
      await fetchAll();
      onDataChanged();
    } catch (err: any) {
      setError('Erro ao excluir sprint.');
      console.error('[ITProjectManager] deleteSprint error:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const panelContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Projetos e Sprints</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{projects.length} projeto{projects.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex-shrink-0"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
          ) : (
            <div className="p-6 space-y-3">

              {/* New project form */}
              <AnimatePresence>
                {showProjectForm && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="bg-gray-50 dark:bg-gray-800 border-2 border-violet-400 dark:border-violet-500 rounded-xl p-4 mb-4"
                  >
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                      {editingProject ? 'Editar Projeto' : 'Novo Projeto'}
                    </h3>

                    <div className="space-y-3">
                      <input
                        ref={firstInputRef}
                        type="text"
                        placeholder="Nome do projeto *"
                        value={projectForm.name}
                        onChange={e => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 text-gray-800 dark:text-gray-100 placeholder-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Descrição (opcional)"
                        value={projectForm.description}
                        onChange={e => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 text-gray-800 dark:text-gray-100 placeholder-gray-400"
                      />

                      {/* Color picker */}
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Cor do projeto</p>
                        <div className="flex flex-wrap gap-2">
                          {PRESET_COLORS.map(c => (
                            <button
                              key={c.hex}
                              title={c.label}
                              onClick={() => setProjectForm(prev => ({ ...prev, color: c.hex }))}
                              style={{ backgroundColor: c.hex }}
                              className={`w-7 h-7 rounded-lg transition-all ${projectForm.color === c.hex ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800 scale-110' : 'hover:scale-105'}`}
                            >
                              {projectForm.color === c.hex && (
                                <Check className="w-3.5 h-3.5 text-white mx-auto" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-4">
                      <button
                        onClick={cancelProjectForm}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={saveProject}
                        disabled={saving || !projectForm.name.trim()}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {editingProject ? 'Salvar' : 'Criar'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Project list */}
              {projects.length === 0 && !showProjectForm ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Folder className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhum projeto criado</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Crie um projeto para organizar suas sprints</p>
                </div>
              ) : (
                projects.map(project => {
                  const projectSprints = sprints.filter(s => s.project_id === project.id);
                  const isExpanded     = expandedProjects.has(project.id);
                  const isFormOpen     = openSprintForms.has(project.id);

                  return (
                    <div key={project.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      {/* Project header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                        {/* Color swatch */}
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />

                        {/* Toggle expand */}
                        <button
                          onClick={() => toggleProject(project.id)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        >
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          }
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{project.name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1 flex-shrink-0">
                            {projectSprints.length} sprint{projectSprints.length !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => openEditProject(project)}
                            title="Editar projeto"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteProjectId(project.id)}
                            title="Excluir projeto"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      {project.description && (
                        <div className="px-4 pb-2 bg-white dark:bg-gray-800">
                          <p className="text-xs text-gray-500 dark:text-gray-400 pl-6">{project.description}</p>
                        </div>
                      )}

                      {/* Sprints (expanded) */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                            className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60"
                          >
                            {/* Sprint rows */}
                            {projectSprints.length === 0 && !isFormOpen && (
                              <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 pl-10">
                                Nenhuma sprint ainda.
                              </div>
                            )}
                            {projectSprints.map(sprint => {
                              const statusConf = SPRINT_STATUS_CONFIG[sprint.status];
                              const isEditingThis = editingSprintId === sprint.id && isFormOpen;
                              return (
                                <div key={sprint.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                                  {isEditingThis ? (
                                    <SprintForm
                                      form={sprintForms[project.id] ?? emptySprintForm()}
                                      onChange={form => setSprintForms(prev => ({ ...prev, [project.id]: form }))}
                                      onSave={() => saveSprint(project.id)}
                                      onCancel={() => cancelSprintForm(project.id)}
                                      saving={saving}
                                    />
                                  ) : (
                                    <div className="flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors">
                                      <Zap className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{sprint.name}</span>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md flex-shrink-0 ${statusConf.badge}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                                        {statusConf.label}
                                      </span>
                                      {sprint.start_date && sprint.end_date && (
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                                          {sprint.start_date} → {sprint.end_date}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                          onClick={() => openSprintForm(project.id, sprint)}
                                          title="Editar sprint"
                                          className="p-1 rounded-md text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setDeleteSprintId(sprint.id)}
                                          title="Excluir sprint"
                                          className="p-1 rounded-md text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Sprint form (new) */}
                            {isFormOpen && !editingSprintId && (
                              <SprintForm
                                form={sprintForms[project.id] ?? emptySprintForm()}
                                onChange={form => setSprintForms(prev => ({ ...prev, [project.id]: form }))}
                                onSave={() => saveSprint(project.id)}
                                onCancel={() => cancelSprintForm(project.id)}
                                saving={saving}
                              />
                            )}

                            {/* "Nova Sprint" button */}
                            {!isFormOpen && (
                              <button
                                onClick={() => openSprintForm(project.id)}
                                className="flex items-center gap-1.5 w-full px-4 py-2 pl-10 text-xs text-gray-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Nova Sprint
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <button
            onClick={openNewProject}
            disabled={showProjectForm}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 rounded-xl transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          >
            Fechar
          </button>
        </div>
      </motion.div>

      {/* Delete project confirmation */}
      {deleteProjectId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[310] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteProjectId(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-red-500 to-rose-500" />
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Excluir projeto?</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Todas as sprints serão excluídas. Os cards não serão deletados, mas perderão a associação.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteProjectId(null)} disabled={saving} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancelar</button>
                <button onClick={confirmDeleteProject} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-70">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Excluir
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Delete sprint confirmation */}
      {deleteSprintId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[310] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteSprintId(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-red-500 to-rose-500" />
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Excluir sprint?</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Os cards desta sprint não serão deletados, mas perderão a associação.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteSprintId(null)} disabled={saving} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancelar</button>
                <button onClick={confirmDeleteSprint} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-70">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Excluir
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );

  return ReactDOM.createPortal(
    <AnimatePresence>{panelContent}</AnimatePresence>,
    document.body,
  );
};

// ─── Sprint Form sub-component ─────────────────────────────────────────────────
const SprintForm: React.FC<{
  form: SprintFormData;
  onChange: (form: SprintFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}> = ({ form, onChange, onSave, onCancel, saving }) => {
  const set = (key: keyof SprintFormData, value: string) => onChange({ ...form, [key]: value });

  return (
    <div className="px-4 py-3 pl-10 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
      <div className="space-y-2">
        <input
          autoFocus
          type="text"
          placeholder="Nome da sprint *"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
          className="w-full text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 text-gray-800 dark:text-gray-100 placeholder-gray-400"
        />
        <input
          type="text"
          placeholder="Objetivo (opcional)"
          value={form.goal}
          onChange={e => set('goal', e.target.value)}
          className="w-full text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 text-gray-800 dark:text-gray-100 placeholder-gray-400"
        />
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={form.start_date}
              onChange={e => set('start_date', e.target.value)}
              className="flex-1 text-xs px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-violet-400 text-gray-800 dark:text-gray-100"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <Target className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={form.end_date}
              onChange={e => set('end_date', e.target.value)}
              className="flex-1 text-xs px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-violet-400 text-gray-800 dark:text-gray-100"
            />
          </div>
        </div>
        {/* Status */}
        <div className="flex gap-1.5">
          {(['planned', 'active', 'completed'] as const).map(s => {
            const conf = SPRINT_STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => set('status', s)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  form.status === s
                    ? conf.badge + ' ring-1 ring-inset ring-current'
                    : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                {conf.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} disabled={saving} className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Cancelar</button>
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Salvar
        </button>
      </div>
    </div>
  );
};

export default ITProjectManager;
