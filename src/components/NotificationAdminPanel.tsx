/**
 * NotificationAdminPanel
 *
 * Painel de Sandbox & Configurações da Central de Notificações.
 * Permite disparar notificações de teste, verificar SMTP e visualizar logs recentes.
 *
 * Layout: 2 colunas em desktop (Sandbox à esquerda | Logs à direita).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Send,
  Mail,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
  Clock,
  User,
  ShoppingCart,
  Server,
  Wrench,
  Code,
  Headphones,
  KeyRound,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  Settings2,
  ChevronDown,
  Search,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useNotificationCenter, NotificationModule, NotificationType } from '../hooks/useNotificationCenter';
import TemplateManagerModal from './TemplateManagerModal';

// ─── Constantes ───────────────────────────────────────────────────────────────

const GLOBAL_EMAIL_KEY = 'flowLab_notifications_email_enabled';

const MODULE_OPTIONS: { value: NotificationModule; label: string; icon: React.ReactElement }[] = [
  { value: 'IT',          label: 'TI',         icon: <Headphones className="w-4 h-4" /> },
  { value: 'PURCHASING',  label: 'Compras',     icon: <ShoppingCart className="w-4 h-4" /> },
  { value: 'SYSTEM',      label: 'Sistema',     icon: <Server className="w-4 h-4" /> },
  { value: 'MAINTENANCE', label: 'Manutenção',  icon: <Wrench className="w-4 h-4" /> },
  { value: 'DEV',         label: 'Dev',         icon: <Code className="w-4 h-4" /> },
];

const TYPE_OPTIONS: { value: NotificationType; label: string; color: string }[] = [
  { value: 'info',    label: 'Info',    color: 'text-blue-600 dark:text-blue-400' },
  { value: 'success', label: 'Sucesso', color: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'warning', label: 'Aviso',   color: 'text-amber-600 dark:text-amber-400' },
  { value: 'error',   label: 'Erro',    color: 'text-red-600 dark:text-red-400' },
];

const TYPE_ICON: Record<NotificationType, React.ReactElement> = {
  info:    <Info className="w-3.5 h-3.5 text-blue-500" />,
  success: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  error:   <XCircle className="w-3.5 h-3.5 text-red-500" />,
};

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface TemplateOption {
  id: string;
  slug: string;
  name: string;
  subject_template: string;
}

interface LogEntry {
  id: string;
  user_id: string;
  title: string;
  module: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

interface ToastState {
  visible: boolean;
  type: 'success' | 'error';
  message: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex items-start gap-3 w-full text-left group"
    aria-pressed={checked}
  >
    <span className="flex-shrink-0 mt-0.5">
      {checked
        ? <ToggleRight className="w-9 h-9 text-violet-500 transition-colors" />
        : <ToggleLeft  className="w-9 h-9 text-slate-300 dark:text-slate-600 transition-colors group-hover:text-slate-400 dark:group-hover:text-slate-500" />
      }
    </span>
    <span>
      <span className={`text-sm font-medium ${checked ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
        {label}
      </span>
      {description && (
        <span className="block text-xs text-slate-500 dark:text-slate-500 mt-0.5">{description}</span>
      )}
    </span>
  </button>
);

// ─── Componente principal ─────────────────────────────────────────────────────

export const NotificationAdminPanel: React.FC = () => {
  const { userProfile } = useAuth();
  const { sendNotification } = useNotificationCenter();
  const isAdmin = userProfile?.role === 'admin';
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  // ── Estado do formulário ─────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [module, setModule] = useState<NotificationModule>('SYSTEM');
  const [type, setType] = useState<NotificationType>('info');
  const [sendEmail, setSendEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Dropdown módulo ───────────────────────────────────────────────────────────
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);
  const moduleDropdownRef = useRef<HTMLDivElement>(null);

  // ── Dropdown tipo ─────────────────────────────────────────────────────────────
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // ── Templates de e-mail ───────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateSlug, setSelectedTemplateSlug] = useState('system_notification');
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  // ── Dropdown destinatário ────────────────────────────────────────────────────
  const [recipientDropdownOpen, setRecipientDropdownOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const recipientDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recipientDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (recipientDropdownRef.current && !recipientDropdownRef.current.contains(e.target as Node)) {
        setRecipientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [recipientDropdownOpen]);

  useEffect(() => {
    if (!moduleDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(e.target as Node)) {
        setModuleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [moduleDropdownOpen]);

  useEffect(() => {
    if (!typeDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [typeDropdownOpen]);

  useEffect(() => {
    if (!templateDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target as Node)) {
        setTemplateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [templateDropdownOpen]);

  // ── Estado de configurações ──────────────────────────────────────────────────
  const [globalEmailEnabled, setGlobalEmailEnabled] = useState<boolean>(() => {
    return localStorage.getItem(GLOBAL_EMAIL_KEY) !== 'false';
  });

  // ── Estado de logs ───────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState>({ visible: false, type: 'success', message: '' });

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 4000);
  }, []);

  // ── Auto-popular content a partir do subject do template quando sendEmail ativa ──
  useEffect(() => {
    if (sendEmail && selectedTemplateSlug) {
      const t = templates.find((t) => t.slug === selectedTemplateSlug);
      if (t && !content.trim()) {
        setContent(t.subject_template.replace(/{{\w+}}/g, '').trim() || `Notificação via template: ${t.name}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendEmail, selectedTemplateSlug]);

  // ── Fetch templates ──────────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await supabase
        .from('notification_templates')
        .select('id, slug, name, subject_template')
        .order('name');
      if (data && data.length > 0) {
        setTemplates(data);
        // se o slug padrão não existir na lista, usa o primeiro disponível
        if (!data.find((t) => t.slug === 'system_notification')) {
          setSelectedTemplateSlug(data[0].slug);
        }
      }
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // ── Fetch users ──────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .order('name');
      setUsers(data || []);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // ── Fetch logs ───────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('id, user_id, title, module, type, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[NotificationAdminPanel] fetchLogs error:', error.message);
        setLogs([]);
        return;
      }

      setLogs(data || []);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchLogs();
    fetchTemplates();
  }, [fetchUsers, fetchLogs, fetchTemplates]);

  // ── Persistir toggle global ──────────────────────────────────────────────────
  const handleGlobalEmailToggle = (val: boolean) => {
    setGlobalEmailEnabled(val);
    localStorage.setItem(GLOBAL_EMAIL_KEY, String(val));
  };

  // ── "Testar em mim mesmo" ────────────────────────────────────────────────────
  const fillSelf = () => {
    if (userProfile) setRecipientId(userProfile.id);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Quando sendEmail ativo, o content é auto-preenchido; basta garantir título e destinatário
    if (!recipientId || !title.trim()) return;
    if (!sendEmail && !content.trim()) return;

    setIsSubmitting(true);
    try {
      const recipient = users.find((u) => u.id === recipientId);
      const shouldEmail = sendEmail && globalEmailEnabled && !!recipient?.email;

      await sendNotification({
        userId: recipientId,
        title: title.trim(),
        content: content.trim(),
        module,
        type,
        sendEmail: shouldEmail,
        emailData: shouldEmail && recipient?.email
          ? {
              to: recipient.email,
              templateSlug: selectedTemplateSlug,
              variables: {
                user_name: recipient.name,
                title: title.trim(),
                content: content.trim(),
              },
            }
          : undefined,
      });

      showToast('success', 'Notificação enviada com sucesso!');

      // Reset form (mantém módulo/tipo para múltiplos testes)
      setTitle('');
      setContent('');

      // Atualiza logs
      await fetchLogs();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao enviar notificação');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Cabeçalho ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            Central de Notificações
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sandbox de testes e histórico de logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-xs font-semibold">
            <Bell className="w-3.5 h-3.5" />
            Fase 5 — Admin
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowTemplateManager(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                         text-slate-600 dark:text-slate-400 hover:border-violet-400 dark:hover:border-violet-600
                         hover:text-violet-600 dark:hover:text-violet-400 rounded-full text-xs font-semibold
                         transition-all shadow-sm"
              title="Gerir templates de e-mail"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Templates de E-mail
            </button>
          )}
        </div>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast.visible && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-scale-in shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-500" />
            : <XCircle    className="w-4 h-4 flex-shrink-0 text-red-500" />
          }
          {toast.message}
        </div>
      )}

      {/* ── Grid principal ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ══ Coluna Esquerda: Sandbox ══════════════════════════════════════════ */}
        <div className="space-y-4">

          {/* Card de info SMTP */}
          <div className="flex items-start gap-3 p-4 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/50 rounded-2xl">
            <KeyRound className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Credenciais SMTP geridas por variáveis de ambiente
              </p>
              <p className="text-xs text-amber-700/70 dark:text-amber-300/70 mt-0.5">
                Configure <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">SMTP_HOST</code>,&nbsp;
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">SMTP_USER</code> e&nbsp;
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">SMTP_PASS</code> no ficheiro <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">.env</code>.
              </p>
            </div>
          </div>

          {/* Toggle global de emails */}
          <div className="p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl shadow-sm">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-3">
              Configurações Globais
            </p>
            <ToggleSwitch
              checked={globalEmailEnabled}
              onChange={handleGlobalEmailToggle}
              label="Habilitar Envio de E-mails"
              description="Quando desligado, notificações in-app ainda são criadas, mas os e-mails não são disparados."
            />
          </div>

          {/* Formulário Sandbox */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl shadow-sm">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Testador Manual
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                Dispara uma notificação real para qualquer utilizador do sistema.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Destinatário */}
              <div className="space-y-1.5" ref={recipientDropdownRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Destinatário
                  </label>
                  <button
                    type="button"
                    onClick={() => { fillSelf(); setRecipientDropdownOpen(false); }}
                    className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline font-medium flex items-center gap-1"
                  >
                    <User className="w-3 h-3" />
                    Testar em mim mesmo
                  </button>
                </div>

                {/* Custom dropdown */}
                <div className="relative">
                  {/* Trigger */}
                  <button
                    type="button"
                    disabled={loadingUsers}
                    onClick={() => { setRecipientDropdownOpen((v) => !v); setRecipientSearch(''); }}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5
                      bg-slate-50/50 dark:bg-slate-800/50 border rounded-xl text-sm transition-all
                      disabled:opacity-60 disabled:cursor-not-allowed
                      ${
                        recipientDropdownOpen
                          ? 'border-violet-400 dark:border-violet-500 ring-4 ring-violet-500/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'
                      }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {loadingUsers ? (
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-violet-500" />
                        </span>
                      )}
                      {recipientId ? (() => {
                        const u = users.find((u) => u.id === recipientId);
                        return u ? (
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{u.name}</span>
                            <span className="block text-[11px] text-slate-400 truncate">{u.email}</span>
                          </span>
                        ) : null;
                      })() : (
                        <span className="text-slate-400 dark:text-slate-500">
                          {loadingUsers ? 'Carregando…' : 'Selecione um destinatário'}
                        </span>
                      )}
                    </span>
                    <motion.span
                      animate={{ rotate: recipientDropdownOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex-shrink-0"
                    >
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </motion.span>
                  </button>

                  {/* Menu */}
                  <AnimatePresence>
                    {recipientDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.13, ease: 'easeOut' }}
                        className="absolute z-50 top-[calc(100%+4px)] left-0 right-0
                                   bg-white dark:bg-slate-800
                                   border border-slate-200 dark:border-slate-700
                                   rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30
                                   overflow-hidden"
                      >
                        {/* Search dentro do menu */}
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <input
                              type="text"
                              autoFocus
                              value={recipientSearch}
                              onChange={(e) => setRecipientSearch(e.target.value)}
                              placeholder="Buscar por nome ou e-mail…"
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700/60
                                         border border-slate-200 dark:border-slate-600 rounded-lg
                                         text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400
                                         focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400
                                         transition-all"
                            />
                          </div>
                        </div>

                        {/* Lista */}
                        <ul className="max-h-52 overflow-y-auto py-1">
                          {users
                            .filter((u) =>
                              !recipientSearch ||
                              u.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
                              u.email.toLowerCase().includes(recipientSearch.toLowerCase())
                            )
                            .map((u) => {
                              const isSelected = u.id === recipientId;
                              const initials = u.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                              return (
                                <li key={u.id}>
                                  <button
                                    type="button"
                                    onClick={() => { setRecipientId(u.id); setRecipientDropdownOpen(false); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                      isSelected
                                        ? 'bg-violet-50 dark:bg-violet-900/20'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    }`}
                                  >
                                    {/* Avatar com iniciais */}
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                      isSelected
                                        ? 'bg-violet-500 text-white'
                                        : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                    }`}>
                                      {initials}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className={`block text-sm font-medium truncate ${
                                        isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-100'
                                      }`}>
                                        {u.name}
                                      </span>
                                      <span className="block text-[11px] text-slate-400 truncate">{u.email}</span>
                                    </span>
                                    {isSelected && (
                                      <CheckCircle className="w-4 h-4 text-violet-500 flex-shrink-0" />
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          {users.filter((u) =>
                            !recipientSearch ||
                            u.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
                            u.email.toLowerCase().includes(recipientSearch.toLowerCase())
                          ).length === 0 && (
                            <li className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                              Nenhum utilizador encontrado
                            </li>
                          )}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Título */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Título
                  {sendEmail && (
                    <span className="ml-1.5 text-[10px] font-normal text-slate-400">(visível na notificação in-app)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={255}
                  placeholder="Ex: Chamado TI-042 atualizado"
                  className="w-full px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all"
                />
              </div>

              {/* Mensagem — oculta quando template de e-mail está ativo */}
              <AnimatePresence initial={false}>
                {!sendEmail ? (
                  <motion.div
                    key="msg-editor"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Mensagem
                      </label>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required={!sendEmail}
                        rows={3}
                        placeholder="Corpo da notificação…"
                        className="w-full px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all resize-none"
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="msg-template-info"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    <div className="flex items-start gap-3 px-3.5 py-3 bg-violet-50/60 dark:bg-violet-900/10 border border-violet-200/60 dark:border-violet-800/40 rounded-xl">
                      <Mail className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                          Corpo gerido pelo template
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          O conteúdo do e-mail será renderizado a partir do template{' '}
                          <span className="font-mono text-violet-600 dark:text-violet-400">
                            {selectedTemplateSlug}
                          </span>.
                          {' '}O campo "Mensagem" é preenchido automaticamente para a notificação in-app.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Módulo + Tipo */}
              <div className="grid grid-cols-2 gap-3">

                {/* Módulo */}
                <div className="space-y-1.5" ref={moduleDropdownRef}>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Módulo</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModuleDropdownOpen((v) => !v)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5
                        bg-slate-50/50 dark:bg-slate-800/50 border rounded-xl text-sm transition-all
                        ${
                          moduleDropdownOpen
                            ? 'border-violet-400 dark:border-violet-500 ring-4 ring-violet-500/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'
                        }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-violet-500 flex-shrink-0">
                          {MODULE_OPTIONS.find((m) => m.value === module)?.icon}
                        </span>
                        <span className="text-slate-800 dark:text-slate-100 truncate">
                          {MODULE_OPTIONS.find((m) => m.value === module)?.label}
                        </span>
                      </span>
                      <motion.span animate={{ rotate: moduleDropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0">
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </motion.span>
                    </button>
                    <AnimatePresence>
                      {moduleDropdownOpen && (
                        <motion.ul
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.12, ease: 'easeOut' }}
                          className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 py-1
                                     bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                                     rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden"
                        >
                          {MODULE_OPTIONS.map((m) => (
                            <li key={m.value}>
                              <button
                                type="button"
                                onClick={() => { setModule(m.value); setModuleDropdownOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                                  module === m.value
                                    ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <span className={module === m.value ? 'text-violet-500' : 'text-slate-400'}>{m.icon}</span>
                                {m.label}
                                {module === m.value && <CheckCircle className="w-3.5 h-3.5 ml-auto text-violet-500" />}
                              </button>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Tipo */}
                <div className="space-y-1.5" ref={typeDropdownRef}>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Tipo</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTypeDropdownOpen((v) => !v)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5
                        bg-slate-50/50 dark:bg-slate-800/50 border rounded-xl text-sm transition-all
                        ${
                          typeDropdownOpen
                            ? 'border-violet-400 dark:border-violet-500 ring-4 ring-violet-500/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'
                        }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0">{TYPE_ICON[type]}</span>
                        <span className={`font-medium truncate ${TYPE_OPTIONS.find((t) => t.value === type)?.color}`}>
                          {TYPE_OPTIONS.find((t) => t.value === type)?.label}
                        </span>
                      </span>
                      <motion.span animate={{ rotate: typeDropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0">
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </motion.span>
                    </button>
                    <AnimatePresence>
                      {typeDropdownOpen && (
                        <motion.ul
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.12, ease: 'easeOut' }}
                          className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 py-1
                                     bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                                     rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden"
                        >
                          {TYPE_OPTIONS.map((t) => (
                            <li key={t.value}>
                              <button
                                type="button"
                                onClick={() => { setType(t.value); setTypeDropdownOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                                  type === t.value
                                    ? 'bg-violet-50 dark:bg-violet-900/20'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                              >
                                <span className="flex-shrink-0">{TYPE_ICON[t.value]}</span>
                                <span className={`font-medium ${t.color}`}>{t.label}</span>
                                {type === t.value && <CheckCircle className="w-3.5 h-3.5 ml-auto text-violet-500" />}
                              </button>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

              </div>

              {/* Toggle enviar email + selector de template */}
              <div className={`rounded-xl border transition-colors ${
                sendEmail
                  ? 'bg-violet-50/60 dark:bg-violet-900/20 border-violet-200/70 dark:border-violet-800/50'
                  : 'bg-slate-50/40 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700'
              }`}>
                <div className="p-3">
                  <ToggleSwitch
                    checked={sendEmail}
                    onChange={setSendEmail}
                    label="Testar SMTP (enviar e-mail)"
                    description={
                      !globalEmailEnabled
                        ? '⚠ E-mails globalmente desabilitados — ative o toggle acima.'
                        : 'Envia também um e-mail para o destinatário via SMTP configurado.'
                    }
                  />
                </div>

                {/* Seletor de template — visível quando sendEmail está ativo */}
                <AnimatePresence>
                  {sendEmail && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      <div
                        className="px-3 pb-3 pt-2 border-t border-violet-200/60 dark:border-violet-800/40 space-y-1.5"
                        ref={templateDropdownRef}
                      >
                        <label className="text-xs font-medium text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                          <Mail className="w-3 h-3" />
                          Template de E-mail
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            disabled={loadingTemplates}
                            onClick={() => setTemplateDropdownOpen((v) => !v)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2
                              bg-white/70 dark:bg-slate-800/70 border rounded-xl text-sm transition-all
                              disabled:opacity-60 disabled:cursor-not-allowed
                              ${
                                templateDropdownOpen
                                  ? 'border-violet-400 dark:border-violet-500 ring-4 ring-violet-500/10'
                                  : 'border-violet-200 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600'
                              }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {loadingTemplates ? (
                                <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0" />
                              ) : (
                                <Mail className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                              )}
                              <span className="min-w-0">
                                {(() => {
                                  const t = templates.find((t) => t.slug === selectedTemplateSlug);
                                  return t ? (
                                    <>
                                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{t.name}</span>
                                      <span className="block text-[10px] font-mono text-slate-400 truncate">{t.slug}</span>
                                    </>
                                  ) : (
                                    <span className="text-slate-400">
                                      {loadingTemplates ? 'Carregando templates…' : selectedTemplateSlug}
                                    </span>
                                  );
                                })()}
                              </span>
                            </span>
                            <motion.span animate={{ rotate: templateDropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0">
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            </motion.span>
                          </button>
                          <AnimatePresence>
                            {templateDropdownOpen && (
                              <motion.ul
                                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                transition={{ duration: 0.12, ease: 'easeOut' }}
                                className="absolute z-50 bottom-[calc(100%+4px)] left-0 right-0 py-1
                                           bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                                           rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden max-h-52 overflow-y-auto"
                              >
                                {templates.length === 0 ? (
                                  <li className="px-4 py-5 text-center text-xs text-slate-400">
                                    Nenhum template encontrado.<br />
                                    <span className="text-violet-500 cursor-pointer hover:underline" onClick={() => { setShowTemplateManager(true); setTemplateDropdownOpen(false); }}>
                                      Criar um template
                                    </span>
                                  </li>
                                ) : templates.map((t) => (
                                  <li key={t.slug}>
                                    <button
                                      type="button"
                                      onClick={() => { setSelectedTemplateSlug(t.slug); setTemplateDropdownOpen(false); }}
                                      className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                                        selectedTemplateSlug === t.slug
                                          ? 'bg-violet-50 dark:bg-violet-900/20'
                                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                      }`}
                                    >
                                      <Mail className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                        selectedTemplateSlug === t.slug ? 'text-violet-500' : 'text-slate-400'
                                      }`} />
                                      <span className="min-w-0 flex-1">
                                        <span className={`block text-sm font-medium truncate ${
                                          selectedTemplateSlug === t.slug ? 'text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-100'
                                        }`}>{t.name}</span>
                                        <span className="block text-[10px] font-mono text-slate-400 truncate">{t.slug}</span>
                                      </span>
                                      {selectedTemplateSlug === t.slug && <CheckCircle className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 mt-0.5" />}
                                    </button>
                                  </li>
                                ))}
                              </motion.ul>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Botão submit */}
              <button
                type="submit"
                disabled={isSubmitting || !recipientId || !title.trim() || (!sendEmail && !content.trim())}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-violet-500/20 font-medium text-sm"
              >
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
                  : <><Send className="w-4 h-4" /> Disparar Notificação</>
                }
              </button>

            </form>
          </div>
        </div>

        {/* ══ Coluna Direita: Logs recentes ═════════════════════════════════════ */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl shadow-sm flex flex-col">

          {/* Header dos logs */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Logs Recentes
              </h3>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                (últimas 10)
              </span>
            </div>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Lista de logs */}
          <div className="flex-1 overflow-y-auto">
            {loadingLogs ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="px-5 py-3.5 flex items-start gap-3 animate-pulse">
                    <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                  Nenhuma notificação enviada ainda.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100/80 dark:divide-slate-800/80">
                {logs.map((log) => {
                  const moduleOption = MODULE_OPTIONS.find((m) => m.value === log.module);
                  // Enriquece nome/email a partir da lista de utilizadores já carregada
                  const recipient = users.find((u) => u.id === log.user_id);
                  const recipientName  = recipient?.name  ?? log.user_id.slice(0, 8) + '…';
                  const recipientEmail = recipient?.email ?? '';
                  return (
                    <li key={log.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Ícone do módulo */}
                      <span className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                        {moduleOption?.icon ?? <Bell className="w-4 h-4" />}
                      </span>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {log.title}
                          </p>
                          <span className="flex-shrink-0">{TYPE_ICON[log.type] ?? TYPE_ICON.info}</span>
                          {/* Badge lido/não-lido */}
                          <span className={`ml-auto flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            log.is_read
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                          }`}>
                            {log.is_read
                              ? <><Eye className="w-2.5 h-2.5" /> Lido</>
                              : <><EyeOff className="w-2.5 h-2.5" /> Não lido</>
                            }
                          </span>
                        </div>

                        {/* Destinatário + data */}
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {recipientName}
                          </span>
                          {recipientEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {recipientEmail}
                            </span>
                          )}
                          <span className="ml-auto flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {logs.length > 0 && (
            <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                Exibindo as 10 notificações mais recentes do sistema
              </p>
            </div>
          )}
        </div>

      </div>
    </div>

      {showTemplateManager && (
        <TemplateManagerModal onClose={() => setShowTemplateManager(false)} />
      )}
    </>
  );
};

export default NotificationAdminPanel;
