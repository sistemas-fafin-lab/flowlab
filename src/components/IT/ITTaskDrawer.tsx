import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Code,
  Wrench,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  Send,
  ChevronDown,
  Inbox,
  ListTodo,
  Play,
  Eye,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Paperclip,
  Maximize2,
  Minimize2,
  Tag,
  Plus,
  Lightbulb,
} from 'lucide-react';
import type { ITRequest, KanbanColumn } from './ITKanbanBoard';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
}

interface Attachment {
  id: string;
  task_id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
}

interface UserOption {
  id: string;
  name: string;
}

export interface ITTaskDrawerProps {
  task: ITRequest;
  onClose: () => void;
  onUpdate: (updated: Partial<ITRequest> & { id: string }) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS (aligned with ITRequestManagement.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Baixa',   dot: 'bg-gray-400',  text: 'text-gray-600 dark:text-gray-300' },
  { value: 'medium',   label: 'Média',   dot: 'bg-blue-500',  text: 'text-blue-700 dark:text-blue-300' },
  { value: 'high',     label: 'Alta',    dot: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  { value: 'critical', label: 'Crítica', dot: 'bg-red-500',   text: 'text-red-700 dark:text-red-300' },
] as const;

const STATUS_OPTIONS: { value: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'pending',     label: 'Pendente',     icon: Clock,        color: 'text-amber-600 dark:text-amber-400' },
  { value: 'in_progress', label: 'Em Andamento', icon: Loader2,      color: 'text-blue-600 dark:text-blue-400' },
  { value: 'resolved',    label: 'Resolvido',    icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'cancelled',   label: 'Cancelado',    icon: XCircle,      color: 'text-red-600 dark:text-red-400' },
];

const KANBAN_OPTIONS: { value: KanbanColumn; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'backlog',     label: 'Backlog',      icon: Inbox,        color: 'text-gray-500 dark:text-gray-400' },
  { value: 'todo',        label: 'A Fazer',      icon: ListTodo,     color: 'text-blue-600 dark:text-blue-400' },
  { value: 'in_progress', label: 'Em Progresso', icon: Play,         color: 'text-amber-600 dark:text-amber-400' },
  { value: 'review',      label: 'Revisão',      icon: Eye,          color: 'text-violet-600 dark:text-violet-400' },
  { value: 'done',        label: 'Concluído',    icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
];

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  suporte:         { label: 'Suporte',        icon: Wrench,    color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  desenvolvimento: { label: 'Desenvolvimento', icon: Code,      color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  consultoria:     { label: 'Consultoria',    icon: Lightbulb, color: 'text-teal-600 dark:text-teal-400',  bg: 'bg-teal-100 dark:bg-teal-900/30' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Editable click-to-edit field ─────────────────────────────────────────────
const EditableField: React.FC<{
  value: string;
  onSave: (val: string) => void;
  multiline?: boolean;
  placeholder?: string;
  displayClassName?: string;
}> = ({ value, onSave, multiline = false, placeholder = '—', displayClassName = '' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    const trimmed = local.trim();
    if (trimmed !== value) onSave(trimmed || value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setLocal(value); setIsEditing(false); }
  };

  const baseInputCls = 'w-full bg-gray-50/80 dark:bg-gray-800/80 border border-violet-400 dark:border-violet-500 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all';

  if (isEditing) {
    const shared = {
      ref: inputRef,
      value: local,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setLocal(e.target.value),
      onBlur: commit,
      onKeyDown: handleKeyDown,
      placeholder,
      className: baseInputCls,
    };
    return multiline ? <textarea {...shared} rows={4} style={{ resize: 'none' }} /> : <input type="text" {...shared} />;
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      title="Clique para editar"
      className={`-mx-3 px-3 py-2 rounded-xl cursor-text hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${displayClassName}`}
    >
      {value || <span className="text-gray-400 dark:text-gray-500 italic text-sm">{placeholder}</span>}
    </div>
  );
};

// ── Attribute row ─────────────────────────────────────────────────────────────
const AttributeRow: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`relative flex items-start gap-3 py-3 border-b border-slate-200/60 dark:border-slate-700/40 last:border-0 ${className}`}>
    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/3 min-w-[90px] flex-shrink-0 pt-1">{label}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

// ── Custom Dropdown (Premium Select) ──────────────────────────────────────────
interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  dot?: string;
  color?: string;
  avatar?: string;
}

const CustomDropdown: React.FC<{
  value: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  renderTrigger?: (selected: DropdownOption | undefined) => React.ReactNode;
  renderOption?: (option: DropdownOption, isSelected: boolean) => React.ReactNode;
}> = ({ value, options, onChange, disabled, placeholder = 'Selecionar...', renderTrigger, renderOption }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  // Default trigger render
  const defaultTriggerContent = () => {
    if (!selected) return <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>;
    const Icon = selected.icon;
    return (
      <span className="flex items-center gap-2">
        {selected.dot && <span className={`w-2 h-2 rounded-full ${selected.dot}`} />}
        {Icon && <Icon className={`w-4 h-4 ${selected.color || 'text-slate-500'}`} />}
        <span className={`text-slate-800 dark:text-slate-200 ${selected.color || ''}`}>{selected.label}</span>
      </span>
    );
  };

  // Default option render
  const defaultOptionContent = (option: DropdownOption, isSelected: boolean) => {
    const Icon = option.icon;
    return (
      <span className="flex items-center gap-2.5">
        {option.dot && <span className={`w-2 h-2 rounded-full ${option.dot}`} />}
        {Icon && <Icon className={`w-4 h-4 ${option.color || 'text-slate-500'}`} />}
        <span className={isSelected ? 'font-medium' : ''}>{option.label}</span>
      </span>
    );
  };

  if (disabled) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/60 dark:border-slate-700/40 opacity-70 cursor-not-allowed">
        {renderTrigger ? renderTrigger(selected) : defaultTriggerContent()}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-500 transition-colors rounded-xl px-3 py-2 text-sm cursor-pointer group"
      >
        <span className="flex-1 text-left truncate">
          {renderTrigger ? renderTrigger(selected) : defaultTriggerContent()}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 flex-shrink-0" />
        </motion.div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.13, ease: 'easeOut' }}
            className="absolute top-[calc(100%+4px)] left-0 w-full min-w-max z-[100]
                       bg-white dark:bg-slate-800 
                       border border-slate-200 dark:border-slate-700 
                       rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30
                       max-h-[240px] overflow-y-auto overflow-x-hidden custom-scrollbar py-1"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-3 py-2 text-sm text-left transition-colors flex items-center justify-between gap-2
                    ${isSelected 
                      ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' 
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                >
                  {renderOption ? renderOption(option, isSelected) : defaultOptionContent(option, isSelected)}
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const formatFileSize = (bytes: number | null): string => {
  if (bytes == null || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const isImageFile = (fileName: string): boolean =>
  /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);

const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 0) return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays === 1) return `Ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const ITTaskDrawer: React.FC<ITTaskDrawerProps> = ({ task, onClose, onUpdate }) => {
  const { userProfile } = useAuth();
  const userId = userProfile?.id ?? '';
  const userPermissions = userProfile?.permissions ?? [];
  const isITManager = userProfile?.roleName === 'Desenvolvedor' || hasPermission(userPermissions, 'canManageIT');

  // ─── States ────────────────────────────────────────────────────────────────
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(760);
  const isResizingRef = useRef(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const isWideLayout = isFullscreen || drawerWidth >= 640;

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startW = drawerWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = startX - ev.clientX;
      setDrawerWidth(Math.max(420, Math.min(1200, startW + delta)));
    };
    const onUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [drawerWidth]);

  // ─── Fetch comments ────────────────────────────────────────────────────────
  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('it_task_comments')
      .select('*, author:user_profiles!user_id(name)')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true });
    setComments((data || []).map((c: any) => ({ ...c, author_name: c.author?.name })));
  }, [task.id]);

  // ─── Fetch attachments ─────────────────────────────────────────────────────
  const fetchAttachments = useCallback(async () => {
    const { data } = await supabase
      .from('it_task_attachments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false });
    setAttachments(data || []);
  }, [task.id]);

  // ─── Fetch users (for assigned_to select) ─────────────────────────────────
  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('user_profiles').select('id, name').order('name');
    setUsers(data || []);
  }, []);

  useEffect(() => {
    fetchComments();
    fetchAttachments();
    fetchUsers();
  }, [fetchComments, fetchAttachments, fetchUsers]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // ─── Save a single field to DB + propagate to kanban ──────────────────────
  const saveField = useCallback(async (field: string, value: unknown) => {
    onUpdate({ id: task.id, [field]: value } as Partial<ITRequest> & { id: string });
    await supabase.from('it_requests').update({ [field]: value }).eq('id', task.id);
  }, [task.id, onUpdate]);

  // ─── Submit comment ────────────────────────────────────────────────────────
  const handleCommentSubmit = async () => {
    const text = commentText.trim();
    if (!text || !userId) return;
    setIsSubmittingComment(true);
    try {
      const { error } = await supabase.from('it_task_comments').insert({
        task_id: task.id,
        user_id: userId,
        content: text,
      });
      if (!error) {
        setCommentText('');
        await fetchComments();
      }
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // ─── File upload handler ───────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    if (!userId) return;
    setIsUploading(true);
    try {
      // Generate unique path: userId/taskId/timestamp_filename
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${userId}/${task.id}/${timestamp}_${safeName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('it-attachments')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('it-attachments')
        .getPublicUrl(filePath);

      // Insert record in DB
      const { error: dbError } = await supabase.from('it_task_attachments').insert({
        task_id: task.id,
        user_id: userId,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      await fetchAttachments();
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Delete attachment ─────────────────────────────────────────────────────
  const handleDeleteAttachment = async (attachment: Attachment) => {
    if (attachment.user_id !== userId && !isITManager) return;
    try {
      // Extract storage path from URL
      const urlParts = attachment.file_url.split('/it-attachments/');
      if (urlParts.length > 1) {
        const storagePath = decodeURIComponent(urlParts[1]);
        await supabase.storage.from('it-attachments').remove([storagePath]);
      }
      await supabase.from('it_task_attachments').delete().eq('id', attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // ─── Drag & Drop handlers ──────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await handleFileUpload(file);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await handleFileUpload(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Tag handlers ──────────────────────────────────────────────────────────
  const handleAddTag = async () => {
    const tag = newTagInput.trim().toLowerCase();
    if (!tag || !isITManager) return;
    
    const currentTags = task.tags || [];
    if (currentTags.includes(tag)) {
      setNewTagInput('');
      return;
    }

    const updatedTags = [...currentTags, tag];
    setIsAddingTag(true);
    try {
      await supabase.from('it_requests').update({ tags: updatedTags }).eq('id', task.id);
      onUpdate({ id: task.id, tags: updatedTags });
      setNewTagInput('');
    } catch (err) {
      console.error('Erro ao adicionar tag:', err);
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!isITManager) return;
    
    const currentTags = task.tags || [];
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    
    try {
      await supabase.from('it_requests').update({ tags: updatedTags }).eq('id', task.id);
      onUpdate({ id: task.id, tags: updatedTags });
    } catch (err) {
      console.error('Erro ao remover tag:', err);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTag();
    }
    if (e.key === 'Escape') {
      setNewTagInput('');
    }
  };

  const typeConf = TYPE_CONFIG[task.request_type];
  const TypeIcon = typeConf.icon;
  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === task.priority);

  return ReactDOM.createPortal(
    <>
      {/* ── Backdrop ────────────────────────────────────────────────────── */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* ── Drawer panel ────────────────────────────────────────────────── */}
      <motion.div
        key="panel"
        initial={isFullscreen ? { opacity: 0, scale: 0.97 } : { x: '100%', opacity: 0.5 }}
        animate={isFullscreen ? { opacity: 1, scale: 1 } : { x: 0, opacity: 1 }}
        exit={isFullscreen ? { opacity: 0, scale: 0.97 } : { x: '100%', opacity: 0.5 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        style={!isFullscreen ? { width: drawerWidth, maxWidth: '100vw' } : undefined}
        className={`
          fixed z-50 flex flex-col overflow-hidden
          ${isFullscreen
            ? 'inset-4 sm:inset-6 md:inset-8 lg:inset-12 sm:rounded-[2rem] bg-white/90 dark:bg-slate-900/95 shadow-2xl shadow-black/25 dark:shadow-black/50 border border-slate-200/80 dark:border-slate-800/70'
            : 'inset-y-2 right-2 rounded-[2rem] bg-white/90 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/15 dark:shadow-black/40'
          }
          backdrop-blur-2xl
        `}
      >
        {/* Resize handle (non-fullscreen only) */}
        {!isFullscreen && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-[60] group flex items-center"
          >
            <div className="absolute inset-y-0 left-0 w-full hover:bg-violet-500/10 active:bg-violet-500/20 transition-colors" />
            <div className="relative w-1 h-12 rounded-full bg-slate-300/0 group-hover:bg-slate-400 dark:group-hover:bg-slate-500 transition-colors ml-0.5" />
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════════════
            STICKY HEADER
        ══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <div className={`w-10 h-10 rounded-xl ${typeConf.bg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <TypeIcon className={`w-5 h-5 ${typeConf.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400 tracking-wide">{task.codigo}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
              <span className="text-xs text-slate-600 dark:text-gray-400">{typeConf.label}</span>
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">{task.title}</h2>
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
            aria-label={isFullscreen ? 'Minimizar' : 'Expandir'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-2.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SCROLLABLE BODY (Two-column layout on lg+)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className={`flex ${isWideLayout ? 'flex-row' : 'flex-col'}`}>

            {/* ── Main Content Column ─────────────────────────────────────── */}
            <div className={`flex-1 min-w-0 px-6 py-6 space-y-8 bg-transparent ${isWideLayout ? 'border-r border-slate-200 dark:border-slate-800' : ''}`}>

              {/* Title (editable) */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-widest mb-1 px-3">
                  Título
                </p>
                <EditableField
                  value={task.title}
                  onSave={(v) => saveField('title', v)}
                  placeholder="Título do chamado"
                  displayClassName="text-base font-semibold text-slate-900 dark:text-white leading-snug"
                />
              </div>

              {/* Description (editable) */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-widest mb-1 px-3">
                  Descrição
                </p>
                <EditableField
                  value={task.description ?? ''}
                  onSave={(v) => saveField('description', v || null)}
                  multiline
                  placeholder="Nenhuma descrição. Clique para adicionar…"
                  displayClassName="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap min-h-[36px]"
                />
              </div>

              {/* ── Attachments Zone ──────────────────────────────────────── */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 px-1">
                  <Paperclip className="w-3.5 h-3.5" />
                  Anexos
                  <span className="text-slate-300 dark:text-gray-600">({attachments.length})</span>
                </p>

                {/* Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 text-center cursor-pointer
                    ${isDragging
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 scale-[1.02]'
                      : 'border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-900/10'
                    }
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileInputChange}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                  />

                  <AnimatePresence mode="wait">
                    {isUploading ? (
                      <motion.div
                        key="uploading"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex flex-col items-center"
                      >
                        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">Fazendo upload...</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex flex-col items-center"
                      >
                        <div className={`
                          w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors
                          ${isDragging
                            ? 'bg-violet-100 dark:bg-violet-900/40'
                            : 'bg-gray-100 dark:bg-gray-800'
                          }
                        `}>
                          <UploadCloud className={`w-6 h-6 transition-colors ${isDragging ? 'text-violet-500' : 'text-gray-400 dark:text-gray-500'}`} />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">
                          {isDragging ? 'Solte os arquivos aqui' : 'Arraste arquivos aqui'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          ou clique para fazer upload
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Attachments Grid */}
                {attachments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                    {attachments.map((att) => (
                      <motion.div
                        key={att.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all"
                      >
                        {/* File icon */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${
                          isImageFile(att.file_name)
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                          {isImageFile(att.file_name) ? (
                            <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>

                        {/* File info */}
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate mb-0.5" title={att.file_name}>
                          {att.file_name}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {formatFileSize(att.file_size)}
                        </p>

                        {/* Actions (hover) */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-violet-100 dark:hover:bg-violet-900/50 rounded-lg transition-colors"
                            title="Baixar"
                          >
                            <Download className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                          </a>
                          {(att.user_id === userId || isITManager) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAttachment(att);
                              }}
                              className="p-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Activity Timeline ─────────────────────────────────────── */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-1.5 px-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Atividade
                  <span className="text-slate-300 dark:text-gray-600">({comments.length})</span>
                </p>

                <div className="relative">
                  {/* Timeline line */}
                  {comments.length > 0 && (
                    <div className="absolute left-[14px] top-4 bottom-4 w-px bg-gradient-to-b from-violet-200 via-gray-200 to-transparent dark:from-violet-800 dark:via-gray-700 dark:to-transparent" />
                  )}

                  <div className="space-y-5">
                    {comments.map((c, idx) => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex gap-3 relative"
                      >
                        {/* Avatar */}
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-500/20 ring-2 ring-white dark:ring-gray-900 z-10">
                          <span className="text-[10px] font-bold text-white select-none">
                            {(c.author_name || '?')[0].toUpperCase()}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-semibold text-slate-900 dark:text-gray-200">
                              {c.author_name || '—'}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-gray-500 tabular-nums">
                              {getRelativeTime(c.created_at)}
                            </span>
                          </div>
                          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm">
                            <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                              {c.content}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {comments.length === 0 && (
                      <div className="flex flex-col items-center py-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                          <MessageSquare className="w-7 h-7 text-gray-300 dark:text-gray-600" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Nenhuma atividade ainda</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">Seja o primeiro a comentar</p>
                      </div>
                    )}

                    <div ref={commentsEndRef} />
                  </div>
                </div>
              </div>

            </div>

            {/* ── Sidebar (Attributes) ────────────────────────────────────── */}
            <div className={`${isWideLayout ? 'w-[300px] border-l border-slate-200/60 dark:border-slate-800/60' : 'w-full border-t border-slate-200/60 dark:border-slate-800/60'} flex-shrink-0 px-6 py-6 bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-sm overflow-visible`}>
              <p className={`text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 px-1 ${isWideLayout ? '' : 'hidden'}`}>
                Detalhes
              </p>
              <div className="rounded-2xl px-4 py-1 bg-white/70 dark:bg-slate-800/20 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30">

                {/* Status */}
                <AttributeRow label="Status" className="z-[70]">
                  <CustomDropdown
                    value={task.status}
                    options={STATUS_OPTIONS}
                    onChange={(v) => saveField('status', v)}
                    disabled={!isITManager}
                    renderTrigger={(selected) => {
                      if (!selected) return <span className="text-gray-400">Selecionar...</span>;
                      const Icon = selected.icon;
                      return (
                        <span className="flex items-center gap-2">
                          {Icon && <Icon className={`w-4 h-4 ${selected.color}`} />}
                          <span className={selected.color}>{selected.label}</span>
                        </span>
                      );
                    }}
                    renderOption={(option, isSelected) => {
                      const Icon = option.icon;
                      return (
                        <span className="flex items-center gap-2.5">
                          {Icon && <Icon className={`w-4 h-4 ${option.color}`} />}
                          <span className={isSelected ? 'font-medium' : ''}>{option.label}</span>
                        </span>
                      );
                    }}
                  />
                </AttributeRow>

                {/* Priority */}
                <AttributeRow label="Prioridade" className="z-[60]">
                  {isITManager ? (
                    <CustomDropdown
                      value={task.priority}
                      options={PRIORITY_OPTIONS.map(p => ({ value: p.value, label: p.label, dot: p.dot, color: p.text }))}
                      onChange={(v) => saveField('priority', v)}
                      renderTrigger={(selected) => {
                        if (!selected) return <span className="text-gray-400">Selecionar...</span>;
                        return (
                          <span className={`flex items-center gap-2 ${selected.color}`}>
                            <span className={`w-2 h-2 rounded-full ${selected.dot}`} />
                            <span>{selected.label}</span>
                          </span>
                        );
                      }}
                      renderOption={(option, isSelected) => (
                        <span className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${option.dot}`} />
                          <span className={isSelected ? 'font-medium' : ''}>{option.label}</span>
                        </span>
                      )}
                    />
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${currentPriority?.text}`}>
                      <span className={`w-2 h-2 rounded-full ${currentPriority?.dot}`} />
                      {currentPriority?.label}
                    </span>
                  )}
                </AttributeRow>

                {/* Kanban column */}
                <AttributeRow label="Coluna" className="z-[50]">
                  <CustomDropdown
                    value={task.kanban_status}
                    options={KANBAN_OPTIONS}
                    onChange={(v) => saveField('kanban_status', v as KanbanColumn)}
                    disabled={!isITManager}
                    renderTrigger={(selected) => {
                      if (!selected) return <span className="text-gray-400">Selecionar...</span>;
                      const Icon = selected.icon;
                      return (
                        <span className="flex items-center gap-2">
                          {Icon && <Icon className={`w-4 h-4 ${selected.color}`} />}
                          <span>{selected.label}</span>
                        </span>
                      );
                    }}
                    renderOption={(option, isSelected) => {
                      const Icon = option.icon;
                      return (
                        <span className="flex items-center gap-2.5">
                          {Icon && <Icon className={`w-4 h-4 ${option.color}`} />}
                          <span className={isSelected ? 'font-medium' : ''}>{option.label}</span>
                        </span>
                      );
                    }}
                  />
                </AttributeRow>

                {/* Assigned to */}
                <AttributeRow label="Responsável" className="z-[40]">
                  <CustomDropdown
                    value={task.assigned_to ?? ''}
                    options={[
                      { value: '', label: 'Não atribuído', color: 'text-gray-400' },
                      ...users.map(u => ({ value: u.id, label: u.name, avatar: u.name[0]?.toUpperCase() || '?' }))
                    ]}
                    onChange={(v) => saveField('assigned_to', v || null)}
                    disabled={!isITManager}
                    placeholder="Não atribuído"
                    renderTrigger={(selected) => {
                      if (!selected || !selected.value) {
                        return <span className="text-gray-400">Não atribuído</span>;
                      }
                      return (
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white">
                            {selected.avatar || selected.label[0]?.toUpperCase()}
                          </span>
                          <span className="truncate">{selected.label}</span>
                        </span>
                      );
                    }}
                    renderOption={(option, isSelected) => (
                      <span className="flex items-center gap-2.5">
                        {option.value ? (
                          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                            {option.avatar || option.label[0]?.toUpperCase()}
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <User className="w-3 h-3 text-gray-400" />
                          </span>
                        )}
                        <span className={isSelected ? 'font-medium' : ''}>{option.label}</span>
                      </span>
                    )}
                  />
                </AttributeRow>

                {/* Tags */}
                <AttributeRow label="Tags" className="z-[30]">
                  <div className="space-y-2">
                    {/* Current Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {(task.tags || []).map((tag, idx) => (
                        <motion.span
                          key={tag}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-lg group"
                        >
                          <Tag className="w-3 h-3 text-gray-400" />
                          {tag}
                          {isITManager && (
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-0.5 p-0.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                              aria-label={`Remover tag ${tag}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </motion.span>
                      ))}
                      {(task.tags || []).length === 0 && !isITManager && (
                        <span className="text-sm text-gray-400 italic">Nenhuma tag</span>
                      )}
                    </div>
                    
                    {/* Add Tag Input (IT Manager only) */}
                    {isITManager && (
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={tagInputRef}
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={handleTagInputKeyDown}
                          placeholder="Nova tag..."
                          disabled={isAddingTag}
                          className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-slate-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-400 transition-all"
                        />
                        <button
                          onClick={handleAddTag}
                          disabled={!newTagInput.trim() || isAddingTag}
                          className="p-1.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                          aria-label="Adicionar tag"
                        >
                          {isAddingTag ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </AttributeRow>

                {/* Due date */}
                <AttributeRow label="Prazo">
                  {isITManager ? (
                    <input
                      type="date"
                      value={task.due_date ? task.due_date.split('T')[0] : ''}
                      onChange={(e) => saveField('due_date', e.target.value ? new Date(e.target.value).toISOString() : null)}
                      className="text-sm font-medium bg-transparent text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  ) : (
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {task.due_date
                        ? new Date(task.due_date).toLocaleDateString('pt-BR')
                        : <span className="text-gray-400 italic">Não definido</span>}
                    </span>
                  )}
                </AttributeRow>

                {/* Estimated hours */}
                <AttributeRow label="Horas est.">
                  {isITManager ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={task.estimated_hours ?? ''}
                        onChange={(e) => saveField('estimated_hours', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="—"
                        className="w-16 text-sm bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-0 border-b border-gray-300 dark:border-gray-600 focus:border-violet-500 transition-colors"
                      />
                      <span className="text-xs text-gray-400">h</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {task.estimated_hours != null ? `${task.estimated_hours}h` : <span className="text-gray-400 italic">—</span>}
                    </span>
                  )}
                </AttributeRow>

                {/* Requester */}
                <AttributeRow label="Solicitante">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <User className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{task.requester_name || '—'}</span>
                  </div>
                </AttributeRow>

                {/* Created at */}
                <AttributeRow label="Criado em">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(task.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </AttributeRow>

              </div>
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            STICKY FOOTER (Comment Input)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md">
          <div className="flex gap-3 items-end">
            {/* User avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-500/20">
              <span className="text-[10px] font-bold text-white select-none">
                {(userProfile?.name || '?')[0].toUpperCase()}
              </span>
            </div>

            {/* Input */}
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200/80 dark:border-transparent focus-within:border-violet-400 dark:focus-within:border-violet-500 rounded-full px-4 py-2.5 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommentSubmit();
                  }
                }}
                placeholder="Escreva um comentário..."
                className="w-full text-sm text-slate-800 dark:text-gray-100 bg-transparent focus:outline-none placeholder-slate-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Send button */}
            <button
              onClick={handleCommentSubmit}
              disabled={!commentText.trim() || isSubmittingComment}
              className={`
                p-2.5 rounded-full transition-all flex-shrink-0 shadow-lg
                ${commentText.trim()
                  ? 'bg-violet-500 hover:bg-violet-600 text-white shadow-violet-500/30'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed shadow-none'
                }
              `}
            >
              {isSubmittingComment ? (
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </>,
    document.body
  );
};

export default ITTaskDrawer;
