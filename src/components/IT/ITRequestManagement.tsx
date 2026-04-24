import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Headphones,
  Plus,
  Search,
  X,
  Code,
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Loader2,
  Calendar,
  UserCheck,
  ChevronDown,
  Lightbulb,
  UploadCloud,
  FileText,
  ImageIcon,
  Send,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { hasPermission } from '../../utils/permissions';
import { supabase } from '../../lib/supabase';
import Notification from '../Notification';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ITRequest {
  id: string;
  codigo: string;
  title: string;
  description: string | null;
  request_type: 'suporte' | 'desenvolvimento' | 'consultoria';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'resolved' | 'cancelled';
  kanban_status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  requested_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  attachments?: { url: string; name: string; size: number }[];
  requester_name?: string;
  requester_email?: string;
  assignee_name?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PRIORITY_CONFIG: Record<string, { label: string; badge: string; dot: string; pill: string; pillActive: string }> = {
  low:      { label: 'Baixa',   badge: 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300',       dot: 'bg-gray-400',  pill: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60', pillActive: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 ring-1 ring-gray-300 dark:ring-gray-600' },
  medium:   { label: 'Média',   badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',       dot: 'bg-blue-500',  pill: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',  pillActive: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 ring-1 ring-blue-300 dark:ring-blue-700' },
  high:     { label: 'Alta',    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300', dot: 'bg-orange-500', pill: 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20', pillActive: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-200 ring-1 ring-orange-300 dark:ring-orange-700' },
  critical: { label: 'Crítica', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',           dot: 'bg-red-500',   pill: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',      pillActive: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 ring-1 ring-red-300 dark:ring-red-700' },
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:     { label: 'Pendente',      badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',     icon: Clock },
  in_progress: { label: 'Em Andamento',  badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',         icon: Loader2 },
  resolved:    { label: 'Resolvido',     badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelado',     badge: 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400',         icon: XCircle },
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; ring: string }> = {
  suporte:        { label: 'Suporte',        icon: Wrench,    color: 'text-orange-600 dark:text-orange-400',    bg: 'bg-orange-100 dark:bg-orange-900/30',    ring: 'ring-orange-500' },
  desenvolvimento: { label: 'Desenvolvimento', icon: Code,      color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-100 dark:bg-violet-900/30',   ring: 'ring-violet-500' },
  consultoria:     { label: 'Consultoria',    icon: Lightbulb, color: 'text-teal-600 dark:text-teal-400',     bg: 'bg-teal-100 dark:bg-teal-900/30',     ring: 'ring-teal-500' },
};

const STATUS_FILTER_ITEMS: [string, string][] = [
  ['all', 'Todos'],
  ['pending', 'Pendente'],
  ['in_progress', 'Em andamento'],
  ['resolved', 'Resolvido'],
  ['cancelled', 'Cancelado'],
];

const TYPE_FILTER_ITEMS: [string, string][] = [
  ['all', 'Todos'],
  ['suporte', 'Suporte'],
  ['desenvolvimento', 'Dev'],
  ['consultoria', 'Consultoria'],
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const ITRequestManagement: React.FC = () => {
  const { userProfile } = useAuth();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const userId = userProfile?.id || '';
  const userPermissions = userProfile?.permissions || [];

  // ─── Permission layer ───────────────────────────────────────────────────────
  const isITManager =
    userProfile?.roleName === 'Desenvolvedor' ||
    hasPermission(userPermissions, 'canManageIT');

  // ─── State ──────────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<ITRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<ITRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');

  // ─── Chat state ──────────────────────────────────────────────────────────────
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Reset tab to 'details' whenever a new request is opened
  useEffect(() => {
    if (selectedRequest) setActiveTab('details');
  }, [selectedRequest?.id]);

  // Fetch comments when modal opens on chat tab or when switching to chat
  useEffect(() => {
    if (selectedRequest && activeTab === 'chat') {
      fetchComments(selectedRequest.id);
    }
  }, [selectedRequest?.id, activeTab]);

  // Auto-scroll to newest message (only when chat tab is visible)
  useEffect(() => {
    if (activeTab === 'chat' && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, activeTab]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    request_type: 'suporte' as 'suporte' | 'desenvolvimento' | 'consultoria',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
  });

  // ─── Attachment state ────────────────────────────────────────────────────────
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<(string | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Dynamic description placeholder ────────────────────────────────────────
  const descriptionPlaceholder = useMemo(() => {
    if (formData.request_type === 'suporte')
      return 'Por favor, detalhe:\n1. O que você estava tentando fazer?\n2. O que aconteceu (mensagens de erro)?\n3. Como podemos reproduzir o problema?';
    if (formData.request_type === 'desenvolvimento')
      return 'Descreva a necessidade:\n1. Qual o objetivo desta nova ferramenta/funcionalidade?\n2. Quem será o usuário principal?\n3. Qual o resultado esperado?';
    return 'Como podemos ajudar? Forneça o máximo de contexto possível sobre a sua dúvida ou problema de negócio.';
  }, [formData.request_type]);

  // ─── Attachment handlers ─────────────────────────────────────────────────────
  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const maxSize = 10 * 1024 * 1024;
    const validFiles: File[] = [];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        showError('Tipo de arquivo inválido. Apenas PDF, PNG e JPEG são permitidos.');
        continue;
      }
      if (file.size > maxSize) {
        showError(`"${file.name}" excede o limite de 10MB.`);
        continue;
      }
      validFiles.push(file);
    }

    if (!validFiles.length) return;

    setAttachments((prev) => [...prev, ...validFiles]);
    validFiles.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setAttachmentPreviews((prev) => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      } else {
        setAttachmentPreviews((prev) => [...prev, null]);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setAttachmentPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRequests = async () => {
    try {
      let query = supabase
        .from('it_requests')
        .select(`
          *,
          requester:user_profiles!requested_by(name, email),
          assignee:user_profiles!assigned_to(name)
        `)
        .order('created_at', { ascending: false });

      // Non-managers see only their own requests
      if (!isITManager) {
        query = query.eq('requested_by', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted: ITRequest[] = (data || []).map((r: any) => ({
        ...r,
        requester_name: r.requester?.name,
        requester_email: r.requester?.email,
        assignee_name: r.assignee?.name,
      }));

      setRequests(formatted);
    } catch (error) {
      console.error('Erro ao carregar chamados:', error);
      showError('Erro ao carregar chamados de TI.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchRequests();
  }, [userId, isITManager]);

  // ─── Filtered list ──────────────────────────────────────────────────────────
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        r.codigo.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.requester_name || '').toLowerCase().includes(q);
      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchesType = filterType === 'all' || r.request_type === filterType;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [requests, searchQuery, filterStatus, filterType]);

  // ─── Create request ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    setIsSubmitting(true);

    try {
      // 1. Upload attachments to storage first
      const uploadedAttachments: { url: string; name: string; size: number }[] = [];

      for (const file of attachments) {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${userId}/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('it-attachments')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('it-attachments')
          .getPublicUrl(filePath);

        uploadedAttachments.push({
          url: urlData.publicUrl,
          name: file.name,
          size: file.size,
        });
      }

      // 2. Insert the request record with attachments
      const { error } = await supabase.from('it_requests').insert({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        request_type: formData.request_type,
        priority: formData.priority,
        requested_by: userId,
        attachments: uploadedAttachments,
      });

      if (error) throw error;

      showSuccess('Chamado criado com sucesso!');
      setFormData({ title: '', description: '', request_type: 'suporte', priority: 'medium' });
      setAttachments([]);
      setAttachmentPreviews([]);
      setShowForm(false);
      await fetchRequests();
    } catch (error) {
      console.error('Erro ao criar chamado:', error);
      showError('Erro ao criar chamado. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Fetch comments ────────────────────────────────────────────────────────
  const fetchComments = async (requestId: string) => {
    const { data } = await supabase
      .from('it_task_comments')
      .select('*, author:user_profiles!user_id(name)')
      .eq('task_id', requestId)
      .order('created_at', { ascending: true });
    setComments((data || []).map((c: any) => ({ ...c, author_name: c.author?.name })));
  };

  // ─── Submit comment ────────────────────────────────────────────────────────
  const handleCommentSubmit = async () => {
    const text = commentText.trim();
    if (!text || !userId || !selectedRequest) return;
    setIsSubmittingComment(true);
    try {
      const { error } = await supabase.from('it_task_comments').insert({
        task_id: selectedRequest.id,
        user_id: userId,
        content: text,
      });
      if (!error) {
        setCommentText('');
        await fetchComments(selectedRequest.id);
      }
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // ─── Status update (IT managers only) ───────────────────────────────────────
  const handleStatusChange = async (requestId: string, newStatus: string) => {
    if (!isITManager) return;
    try {
      const { error } = await supabase
        .from('it_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;
      showSuccess('Status atualizado!');
      await fetchRequests();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showError('Erro ao atualizar status.');
    }
  };

  // ─── Assign (IT managers only) ──────────────────────────────────────────────
  const handleAssignToMe = async (requestId: string) => {
    if (!isITManager) return;
    try {
      const { error } = await supabase
        .from('it_requests')
        .update({ assigned_to: userId, status: 'in_progress' })
        .eq('id', requestId);

      if (error) throw error;
      showSuccess('Chamado atribuído a você!');
      await fetchRequests();
    } catch (error) {
      console.error('Erro ao atribuir chamado:', error);
      showError('Erro ao atribuir chamado.');
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-violet-600 border-t-transparent" />
          <span className="mt-3 text-gray-500 dark:text-gray-400 font-medium">Carregando chamados…</span>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            Solicitações de TI
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isITManager
              ? 'Gerencie todos os chamados de suporte, desenvolvimento e consultoria'
              : 'Acompanhe seus chamados de suporte, desenvolvimento e consultoria'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-violet-500/25 font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Chamado
        </button>
      </div>

      {/* ─── New Request Form ─────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/60 dark:border-gray-700/60 p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Novo Chamado</h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Título *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                required
                className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all duration-200"
                placeholder="Descreva brevemente o problema ou necessidade"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                rows={4}
                className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all duration-200 resize-none min-h-[120px]"
                placeholder={descriptionPlaceholder}
              />
            </div>

            {/* Type — Radio Cards */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo do Chamado</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card: Suporte */}
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, request_type: 'suporte' }))}
                  className={`relative flex flex-col items-start text-left p-4 rounded-2xl border transition-all duration-200 ${
                    formData.request_type === 'suporte'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-500 shadow-md ring-1 ring-green-500/50'
                      : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-green-400/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${formData.request_type === 'suporte' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Wrench className={`w-5 h-5 transition-colors ${formData.request_type === 'suporte' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-3 mb-1">Suporte</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Estou tendo um bug no meu sistema, identifiquei algum erro numa ferramenta
                    <span className="italic text-[10px] block mt-1">(Obs: não atendemos solicitações de infraestrutura)</span>
                  </p>
                </button>

                {/* Card: Desenvolvimento */}
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, request_type: 'desenvolvimento' }))}
                  className={`relative flex flex-col items-start text-left p-4 rounded-2xl border transition-all duration-200 ${
                    formData.request_type === 'desenvolvimento'
                      ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-500 shadow-md ring-1 ring-violet-500/50'
                      : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-violet-400/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${formData.request_type === 'desenvolvimento' ? 'bg-violet-100 dark:bg-violet-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Code className={`w-5 h-5 transition-colors ${formData.request_type === 'desenvolvimento' ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-3 mb-1">Desenvolvimento</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Criação de ferramentas, soluções ou desenvolvimento de novas funcionalidades em ferramentas existentes.
                  </p>
                </button>

                {/* Card: Consultoria */}
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, request_type: 'consultoria' }))}
                  className={`relative flex flex-col items-start text-left p-4 rounded-2xl border transition-all duration-200 ${
                    formData.request_type === 'consultoria'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 shadow-md ring-1 ring-yellow-500/50'
                      : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-yellow-400/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${formData.request_type === 'consultoria' ? 'bg-yellow-100 dark:bg-yellow-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Lightbulb className={`w-5 h-5 transition-colors ${formData.request_type === 'consultoria' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-3 mb-1">Consultoria</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Quero receber ajuda do time de TI para resolver um problema, seja ele relacionado a uma solução técnica ou não.
                  </p>
                </button>
              </div>
            </div>

            {/* Priority — Pill group */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prioridade</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(PRIORITY_CONFIG) as [string, typeof PRIORITY_CONFIG[keyof typeof PRIORITY_CONFIG]][]).map(([key, conf]) => {
                  const isActive = formData.priority === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, priority: key as any }))}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                        isActive ? conf.pillActive : conf.pill
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                      {conf.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Attachments */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Anexos <span className="text-slate-400 font-normal">(opcional)</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFilesChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/30 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-violet-400 transition-colors group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-5 h-5 text-violet-500" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Clique ou arraste arquivos aqui</p>
                <p className="text-xs text-slate-400 mt-1">Imagens, PDFs ou documentos (max. 10MB)</p>
              </button>

              {/* File list */}
              {attachments.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {attachments.map((file, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    >
                      {attachmentPreviews[idx] ? (
                        <img src={attachmentPreviews[idx]!} alt={file.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-violet-500" />
                        </div>
                      )}
                      <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{file.name}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center font-medium shadow-lg shadow-violet-500/25"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Criando…
                  </>
                ) : (
                  'Criar Chamado'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Filters & Search ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-3 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        {/* Search bar */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código, título ou solicitante…"
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Segmented controls row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status — Segmented control */}
          <div className="bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl flex gap-0.5 overflow-x-auto">
            {STATUS_FILTER_ITEMS.map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                  filterStatus === val
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Type — Segmented control */}
          <div className="bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl flex gap-0.5">
            {TYPE_FILTER_ITEMS.map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterType(val)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                  filterType === val
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap">
            {filteredRequests.length} de {requests.length}
          </span>
        </div>
      </div>

      {/* ─── Backlog Card List ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {filteredRequests.map((req) => {
          const typeConf = TYPE_CONFIG[req.request_type];
          const prioConf = PRIORITY_CONFIG[req.priority];
          const statusConf = STATUS_CONFIG[req.status];
          const StatusIcon = statusConf.icon;
          const TypeIcon = typeConf.icon;

          return (
            <div
              key={req.id}
              onClick={() => setSelectedRequest(req)}
              className="group bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-gray-100 dark:border-gray-700 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-200 cursor-pointer"
            >
              {/* Left — Type icon + Info */}
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-xl ${typeConf.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <TypeIcon className={`w-5 h-5 ${typeConf.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400">{req.codigo}</span>
                    <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{typeConf.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{req.title}</p>
                  {req.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{req.description}</p>
                  )}
                  {/* Requester info */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <User className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {isITManager ? (req.requester_name || '—') : 'Você'}
                    </span>
                    {req.assignee_name && (
                      <>
                        <span className="text-xs text-gray-300 dark:text-gray-600 mx-1">→</span>
                        <UserCheck className="w-3 h-3 text-violet-500 dark:text-violet-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">{req.assignee_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right — Badges + Date + Actions */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 sm:flex-shrink-0">
                {/* Priority badge */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg ${prioConf.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${prioConf.dot}`} />
                  {prioConf.label}
                </span>

                {/* Status badge */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg ${statusConf.badge}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusConf.label}
                </span>

                {/* Date */}
                <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap">
                  <Calendar className="w-3 h-3" />
                  {new Date(req.created_at).toLocaleDateString('pt-BR')}
                </span>

                {/* Manager actions */}
                {isITManager && (
                  <div className="flex items-center gap-2 sm:ml-1 sm:pl-3 sm:border-l sm:border-gray-200 sm:dark:border-gray-700">
                    {!req.assigned_to && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAssignToMe(req.id); }}
                        className="px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-all whitespace-nowrap"
                      >
                        Assumir
                      </button>
                    )}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={req.status}
                        onChange={(e) => handleStatusChange(req.id, e.target.value)}
                        className="appearance-none pl-3 pr-7 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 cursor-pointer focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                      >
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em Andamento</option>
                        <option value="resolved">Resolvido</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {filteredRequests.length === 0 && (
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-gray-100 dark:border-gray-700 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Headphones className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {requests.length === 0 ? 'Nenhum chamado encontrado' : 'Nenhum resultado para os filtros aplicados'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {requests.length === 0
                ? 'Clique em "Novo Chamado" para abrir sua primeira solicitação de TI.'
                : 'Tente ajustar a busca ou os filtros acima.'}
            </p>
            {(searchQuery || filterStatus !== 'all' || filterType !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setFilterStatus('all'); setFilterType('all'); }}
                className="mt-4 px-4 py-2 text-sm font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-all"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Modal de Detalhamento do Chamado (Portal) ────────────────────────────── */}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {selectedRequest && (() => {
            const modalTypeConf   = TYPE_CONFIG[selectedRequest.request_type];
            const modalPrioConf   = PRIORITY_CONFIG[selectedRequest.priority];
            const modalStatusConf = STATUS_CONFIG[selectedRequest.status];
            const ModalStatusIcon = modalStatusConf.icon;
            const ModalTypeIcon   = modalTypeConf.icon;
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedRequest(null)}
                className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
              >
                {/* Modal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-4xl h-[90vh] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                >
                  {/* ── Header ─────────────────────────────────────────────── */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 flex-shrink-0">
                    {/* Left: type icon + title stack */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl ${modalTypeConf.bg} flex items-center justify-center flex-shrink-0`}>
                        <ModalTypeIcon className={`w-5 h-5 ${modalTypeConf.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">{selectedRequest.codigo}</span>
                          {/* Status badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md ${modalStatusConf.badge}`}>
                            <ModalStatusIcon className="w-3 h-3" />
                            {modalStatusConf.label}
                          </span>
                          {/* Priority badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md ${modalPrioConf.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${modalPrioConf.dot}`} />
                            {modalPrioConf.label}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5 truncate">{selectedRequest.title}</h3>
                      </div>
                    </div>
                    {/* Right: close */}
                    <button
                      onClick={() => setSelectedRequest(null)}
                      className="p-2 ml-4 flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* ── Tab Switcher ────────────────────────────────────────── */}
                  <div className="flex gap-8 px-6 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md flex-shrink-0">
                    {([
                      { id: 'details', label: 'Detalhes Técnicos', icon: FileText },
                      { id: 'chat',    label: 'Conversa com TI',   icon: Headphones },
                    ] as const).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-all ${
                          activeTab === tab.id
                            ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* ── Body ───────────────────────────────────────────────── */}
                  {(() => {
                    const isClosed = selectedRequest.status === 'resolved' || selectedRequest.status === 'cancelled';
                    return (
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeTab === 'details' ? (
                      <div className="p-6 space-y-6">
                        {/* Meta row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Tipo</p>
                            <p className={`text-sm font-semibold ${modalTypeConf.color}`}>{modalTypeConf.label}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Solicitante</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {selectedRequest.requester_name || 'Você'}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Responsável</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {selectedRequest.assignee_name || '—'}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Aberto em</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {new Date(selectedRequest.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Descrição</h4>
                          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5">
                            {selectedRequest.description ? (
                              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {selectedRequest.description}
                              </p>
                            ) : (
                              <p className="text-sm text-slate-400 dark:text-slate-500 italic">Nenhuma descrição fornecida.</p>
                            )}
                          </div>
                        </div>

                        {/* Attachments */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Anexos</h4>
                          {selectedRequest.attachments && selectedRequest.attachments.length > 0 ? (
                            <ul className="space-y-2">
                              {selectedRequest.attachments.map((att, idx) => (
                                <li key={idx} className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                                  <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4 text-violet-500" />
                                  </div>
                                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{att.name}</span>
                                  <span className="text-xs text-slate-400 whitespace-nowrap">{(att.size / 1024).toFixed(0)} KB</span>
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                                  >
                                    <UploadCloud className="w-3.5 h-3.5 rotate-180" />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                              <FileText className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                              <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum anexo enviado.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full">
                        {/* Messages list */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 pb-6">
                          {comments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <MessageSquare className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                              </div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma mensagem ainda</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">Seja o primeiro a comentar neste chamado</p>
                            </div>
                          ) : (
                            comments.map((c) => {
                              const isOwn = c.user_id === userId;
                              const initials = (c.author_name || '?')[0].toUpperCase();
                              const time = new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                              return (
                                <div key={c.id} className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                                  {/* Avatar */}
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow-sm ${
                                    isOwn
                                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/20'
                                      : 'bg-gradient-to-br from-slate-500 to-slate-600'
                                  }`}>
                                    {initials}
                                  </div>
                                  {/* Bubble */}
                                  <div className={`max-w-[72%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                    <div className={`flex items-baseline gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {isOwn ? 'Você' : (c.author_name || '—')}
                                      </span>
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">{time}</span>
                                    </div>
                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                                      isOwn
                                        ? 'bg-violet-500 text-white rounded-tr-md'
                                        : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-md'
                                    }`}>
                                      {c.content}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div ref={commentsEndRef} />
                        </div>
                      </div>
                    )}
                  </div>
                    );
                  })()}

                  {/* ── Chat Footer (visible only on chat tab) ───────────────────── */}
                  {activeTab === 'chat' && (() => {
                    const isClosed = selectedRequest.status === 'resolved' || selectedRequest.status === 'cancelled';
                    return (
                    <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
                      {isClosed ? (
                        <div className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                          <Lock className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Este chamado foi encerrado. A conversa encontra-se em modo de leitura.
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2">
                          <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleCommentSubmit();
                              }
                            }}
                            placeholder="Escreva uma mensagem… (Enter para enviar)"
                            rows={1}
                            className="flex-1 bg-transparent resize-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none py-1.5 max-h-32"
                            style={{ fieldSizing: 'content' } as React.CSSProperties}
                          />
                          <button
                            onClick={handleCommentSubmit}
                            disabled={isSubmittingComment || !commentText.trim()}
                            className="p-2 mb-0.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all flex-shrink-0"
                          >
                            {isSubmittingComment
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Send className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </div>
                    );
                  })()}
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default ITRequestManagement;
