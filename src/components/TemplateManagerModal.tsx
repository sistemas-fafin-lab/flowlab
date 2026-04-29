/**
 * TemplateManagerModal
 *
 * Modal de gestão de templates dinâmicos de e-mail.
 * Permite listar, criar, editar e excluir registros na tabela
 * `notification_templates` via Supabase.
 *
 * Layout interno:
 *  - Sidebar  (25%): lista de templates + busca + botão "+ Novo"
 *  - Editor   (50%): formulário de edição dos campos
 *  - Preview  (25%): iframe live com srcDoc do body_html renderizado
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Search,
  Save,
  Trash2,
  Loader2,
  RefreshCw,
  FileCode2,
  Eye,
  FlaskConical,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  LayoutTemplate,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface NotificationTemplate {
  id: string;
  slug: string;
  name: string;
  subject_template: string;
  body_html: string;
  created_at: string;
}

type UpsertPayload = Omit<NotificationTemplate, 'id' | 'created_at'> & { id?: string };

interface ToastState {
  visible: boolean;
  type: 'success' | 'error';
  message: string;
}

export interface TemplateManagerModalProps {
  onClose: () => void;
}

// ─── Dados de preview mockados ─────────────────────────────────────────────────

const MOCK_VARIABLES: Record<string, string> = {
  user_name:      'João Silva',
  ticket_code:    'TI-042',
  ticket_message: 'Seu chamado foi atualizado pela equipe de TI. A solução foi implementada com sucesso.',
  action_url:     'https://flowlab.app/requests',
};

function applyMockVariables(template: string): string {
  return template.replace(/{{(\w+)}}/g, (_match, key) => MOCK_VARIABLES[key] ?? `{{${key}}}`);
}

// ─── Slugify helper ─────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 50);
}

// ─── Template em branco ─────────────────────────────────────────────────────────

const BLANK_TEMPLATE: UpsertPayload = {
  slug: '',
  name: '',
  subject_template: '',
  body_html: '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8" />\n  <title>Novo Template</title>\n</head>\n<body style="margin:0;padding:40px;background:#f4f4f7;font-family:Arial,sans-serif;">\n  <p>Olá, {{user_name}}!</p>\n</body>\n</html>',
};

// ─── Componente principal ──────────────────────────────────────────────────────

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({ onClose }) => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<UpsertPayload | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [previewMock, setPreviewMock] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activePane, setActivePane] = useState<'editor' | 'preview'>('editor');

  const [toast, setToast] = useState<ToastState>({ visible: false, type: 'success', message: '' });

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ─── Toast helper ───────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 4000);
  }, []);

  // ─── Buscar templates ───────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .order('name');
      if (error) throw error;
      setTemplates(data ?? []);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao carregar templates');
    } finally {
      setLoadingList(false);
    }
  }, [showToast]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // ─── Fechar com ESC ─────────────────────────────────────────────────────────

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  // ─── Selecionar template ────────────────────────────────────────────────────

  const selectTemplate = (t: NotificationTemplate) => {
    setSelected({ id: t.id, slug: t.slug, name: t.name, subject_template: t.subject_template, body_html: t.body_html });
    setIsNew(false);
    setIsDirty(false);
    setShowDeleteConfirm(false);
    setActivePane('editor');
  };

  const createNew = () => {
    setSelected({ ...BLANK_TEMPLATE });
    setIsNew(true);
    setIsDirty(true);
    setShowDeleteConfirm(false);
    setActivePane('editor');
  };

  // ─── Atualizar campo ────────────────────────────────────────────────────────

  const updateField = <K extends keyof UpsertPayload>(key: K, value: UpsertPayload[K]) => {
    setSelected((prev) => prev ? { ...prev, [key]: value } : prev);
    setIsDirty(true);
  };

  const handleNameChange = (value: string) => {
    setSelected((prev) => {
      if (!prev) return prev;
      const nextSlug = isNew ? slugify(value) : prev.slug;
      return { ...prev, name: value, slug: nextSlug };
    });
    setIsDirty(true);
  };

  // ─── Salvar (upsert) ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selected) return;

    const { slug, name, subject_template, body_html } = selected;
    if (!slug.trim() || !name.trim() || !subject_template.trim() || !body_html.trim()) {
      showToast('error', 'Preencha todos os campos obrigatórios.');
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        const { error } = await supabase
          .from('notification_templates')
          .insert({ slug, name, subject_template, body_html });
        if (error) throw error;
        showToast('success', 'Template criado com sucesso!');
      } else {
        const { error } = await supabase
          .from('notification_templates')
          .update({ slug, name, subject_template, body_html })
          .eq('id', selected.id!);
        if (error) throw error;
        showToast('success', 'Template atualizado com sucesso!');
      }

      setIsDirty(false);
      setIsNew(false);
      await fetchTemplates();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar template');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Excluir ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selected?.id) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('notification_templates')
        .delete()
        .eq('id', selected.id);
      if (error) throw error;
      showToast('success', 'Template excluído.');
      setSelected(null);
      setShowDeleteConfirm(false);
      await fetchTemplates();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao excluir template');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Preview ────────────────────────────────────────────────────────────────

  const previewHtml = selected
    ? previewMock
      ? applyMockVariables(selected.body_html)
      : selected.body_html
    : '';

  // ─── Lista filtrada ─────────────────────────────────────────────────────────

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Overlay */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal panel */}
        <motion.div
          className="relative z-10 w-full max-w-[1280px] h-[90vh] flex flex-col
                     bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl
                     border border-white/60 dark:border-slate-700/60
                     rounded-3xl shadow-2xl shadow-black/25 dark:shadow-black/60
                     overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        >
          {/* ── Header ───────────────────────────────────────────────────────── */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4
                          border-b border-slate-200/70 dark:border-slate-700/60
                          bg-gradient-to-r from-violet-600/5 to-purple-600/5 dark:from-violet-900/20 dark:to-purple-900/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/30">
                <LayoutTemplate className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">
                  Gestor de Templates de E-mail
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                  Edite os layouts dinâmicos usados nas notificações por e-mail
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Toast inline */}
              <AnimatePresence>
                {toast.visible && (
                  <motion.div
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                      toast.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {toast.type === 'success'
                      ? <CheckCircle className="w-3.5 h-3.5" />
                      : <AlertTriangle className="w-3.5 h-3.5" />
                    }
                    {toast.message}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                           hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Body ─────────────────────────────────────────────────────────── */}
          <div className="flex-1 flex min-h-0 overflow-hidden">

            {/* ─ Sidebar ─────────────────────────────────────────────────────── */}
            <aside className="w-64 flex-shrink-0 flex flex-col
                              border-r border-slate-200/70 dark:border-slate-700/60
                              bg-slate-50/60 dark:bg-slate-900/40">

              {/* Toolbar da sidebar */}
              <div className="flex-shrink-0 p-3 space-y-2 border-b border-slate-200/70 dark:border-slate-700/60">
                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar template…"
                    className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                               rounded-lg text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400
                               focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                  />
                </div>

                {/* Botão novo */}
                <button
                  type="button"
                  onClick={createNew}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2
                             bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700
                             text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-violet-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Template
                </button>
              </div>

              {/* Lista */}
              <div className="flex-1 overflow-y-auto py-1">
                {loadingList ? (
                  <div className="flex flex-col gap-2 p-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
                    ))}
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 gap-2">
                    <FileCode2 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                      {search ? 'Nenhum template encontrado' : 'Nenhum template criado ainda'}
                    </p>
                  </div>
                ) : (
                  <ul className="px-2 py-1 space-y-0.5">
                    {filteredTemplates.map((t) => {
                      const isActive = selected?.id === t.id;
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => selectTemplate(t)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all group ${
                              isActive
                                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold truncate ${isActive ? '' : ''}`}>
                                {t.name}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                {t.slug}
                              </p>
                            </div>
                            <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                              isActive ? 'text-violet-500 translate-x-0.5' : 'text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5'
                            }`} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Refresh */}
              <div className="flex-shrink-0 p-3 border-t border-slate-200/70 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={fetchTemplates}
                  disabled={loadingList}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-400 dark:text-slate-500
                             hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800
                             rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingList ? 'animate-spin' : ''}`} />
                  Atualizar lista
                </button>
              </div>
            </aside>

            {/* ─ Área de edição + preview ────────────────────────────────────── */}
            {!selected ? (
              /* Estado vazio */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <LayoutTemplate className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Selecione um template para editar
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Ou crie um novo clicando em "Novo Template" na barra lateral
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-w-0 min-h-0">

                {/* Toolbar do editor */}
                <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5
                                border-b border-slate-200/70 dark:border-slate-700/60
                                bg-white/50 dark:bg-slate-800/30">

                  {/* Tabs editor / preview */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setActivePane('editor')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        activePane === 'editor'
                          ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <FileCode2 className="w-3.5 h-3.5" />
                      Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePane('preview')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        activePane === 'preview'
                          ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Simular dados */}
                    <button
                      type="button"
                      onClick={() => { setPreviewMock((v) => !v); setActivePane('preview'); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        previewMock
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300 dark:hover:border-amber-700 hover:text-amber-600 dark:hover:text-amber-400'
                      }`}
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      {previewMock ? 'Dados simulados ✓' : 'Simular dados'}
                    </button>

                    {/* Excluir */}
                    {!isNew && (
                      <AnimatePresence mode="wait">
                        {showDeleteConfirm ? (
                          <motion.div
                            key="confirm"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex items-center gap-1.5"
                          >
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">Confirmar?</span>
                            <button
                              type="button"
                              onClick={handleDelete}
                              disabled={isDeleting}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              Excluir
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDeleteConfirm(false)}
                              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                              Cancelar
                            </button>
                          </motion.div>
                        ) : (
                          <motion.button
                            key="delete-btn"
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                                       text-slate-500 dark:text-slate-400 hover:border-red-300 dark:hover:border-red-700 hover:text-red-500 dark:hover:text-red-400
                                       rounded-lg text-xs font-medium transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </motion.button>
                        )}
                      </AnimatePresence>
                    )}

                    {/* Salvar */}
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving || !isDirty}
                      className="flex items-center gap-1.5 px-4 py-1.5
                                 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-violet-500/20"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {isSaving ? 'Salvando…' : isNew ? 'Criar' : 'Salvar'}
                    </button>
                  </div>
                </div>

                {/* ─ Painel editor ─────────────────────────────────────────────── */}
                <AnimatePresence mode="wait">
                  {activePane === 'editor' ? (
                    <motion.div
                      key="editor"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 overflow-y-auto p-5 space-y-4"
                    >
                      {/* Linha Nome + Slug */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                            Nome do Template <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={selected.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="Ex: Atualização de Chamado TI"
                            maxLength={100}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700
                                       rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400
                                       focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                            Slug (ID único) <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={selected.slug}
                            onChange={(e) => updateField('slug', slugify(e.target.value))}
                            placeholder="ex: it_ticket_update"
                            maxLength={50}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700
                                       rounded-xl text-sm font-mono text-violet-700 dark:text-violet-300 placeholder-slate-400
                                       focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all"
                          />
                        </div>
                      </div>

                      {/* Assunto */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                          Assunto do E-mail <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={selected.subject_template}
                          onChange={(e) => updateField('subject_template', e.target.value)}
                          placeholder="Ex: Atualização no Chamado {{ticket_code}}"
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700
                                     rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400
                                     focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all"
                        />
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Use <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{'{{variavel}}'}</code> para inserir dados dinâmicos.
                        </p>
                      </div>

                      {/* Corpo HTML */}
                      <div className="space-y-1.5 flex flex-col" style={{ minHeight: 320 }}>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                            Corpo HTML <span className="text-red-400">*</span>
                          </label>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            {selected.body_html.length} chars
                          </span>
                        </div>
                        <textarea
                          value={selected.body_html}
                          onChange={(e) => updateField('body_html', e.target.value)}
                          spellCheck={false}
                          className="flex-1 w-full px-4 py-3 bg-slate-900 dark:bg-slate-950 border border-slate-700 dark:border-slate-700
                                     rounded-xl text-xs font-mono text-green-300 dark:text-green-200 placeholder-slate-600
                                     focus:outline-none focus:ring-4 focus:ring-violet-500/15 focus:border-violet-500 transition-all
                                     resize-none leading-relaxed"
                          style={{ minHeight: 320, tabSize: 2 }}
                          placeholder="<!DOCTYPE html>..."
                        />
                      </div>

                      {/* Hint variáveis */}
                      <div className="flex flex-wrap gap-1.5 p-3 bg-violet-50/60 dark:bg-violet-900/10 border border-violet-200/60 dark:border-violet-800/40 rounded-xl">
                        <span className="text-[11px] text-violet-700 dark:text-violet-400 font-semibold mr-1 self-center">Variáveis comuns:</span>
                        {Object.keys(MOCK_VARIABLES).map((key) => (
                          <code key={key} className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-mono">
                            {`{{${key}}}`}
                          </code>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    /* ─ Painel preview ─────────────────────────────────────────── */
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 flex flex-col min-h-0 bg-slate-100 dark:bg-slate-800/40"
                    >
                      {/* Barra de info do preview */}
                      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-slate-200/60 dark:bg-slate-800/80 border-b border-slate-300/50 dark:border-slate-700/60">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Preview em tempo real
                          {previewMock && (
                            <span className="ml-1.5 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <FlaskConical className="w-3 h-3" />
                              dados simulados ativos
                            </span>
                          )}
                        </span>
                        {previewMock && (
                          <div className="ml-auto flex flex-wrap gap-1">
                            {Object.entries(MOCK_VARIABLES).map(([k, v]) => (
                              <span key={k} className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-mono">
                                {k}=<em>{v.length > 20 ? v.slice(0, 20) + '…' : v}</em>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* iframe */}
                      <div className="flex-1 overflow-hidden p-4">
                        <iframe
                          ref={iframeRef}
                          srcDoc={previewHtml || '<p style="font-family:sans-serif;color:#94a3b8;padding:40px;">Nenhum HTML para renderizar.</p>'}
                          title="Email Preview"
                          sandbox="allow-same-origin"
                          className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white shadow-md"
                          style={{ minHeight: 0 }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TemplateManagerModal;
