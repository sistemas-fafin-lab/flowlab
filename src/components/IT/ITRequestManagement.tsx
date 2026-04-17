import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
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
  request_type: 'suporte' | 'desenvolvimento';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'resolved' | 'cancelled';
  kanban_status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  requested_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
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
  suporte:        { label: 'Suporte',        icon: Wrench, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', ring: 'ring-orange-500' },
  desenvolvimento: { label: 'Desenvolvimento', icon: Code,   color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30', ring: 'ring-violet-500' },
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

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    request_type: 'suporte' as 'suporte' | 'desenvolvimento',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
  });

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
      const { error } = await supabase.from('it_requests').insert({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        request_type: formData.request_type,
        priority: formData.priority,
        requested_by: userId,
      });

      if (error) throw error;

      showSuccess('Chamado criado com sucesso!');
      setFormData({ title: '', description: '', request_type: 'suporte', priority: 'medium' });
      setShowForm(false);
      await fetchRequests();
    } catch (error) {
      console.error('Erro ao criar chamado:', error);
      showError('Erro ao criar chamado. Tente novamente.');
    } finally {
      setIsSubmitting(false);
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
              ? 'Gerencie todos os chamados de suporte e desenvolvimento'
              : 'Acompanhe seus chamados de suporte e desenvolvimento'}
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
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-gray-50/50 dark:bg-gray-900/50 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                placeholder="Descreva brevemente o problema ou necessidade"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-gray-50/50 dark:bg-gray-900/50 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all resize-none"
                placeholder="Detalhes do chamado (opcional)"
              />
            </div>

            {/* Type — Tactile cards */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo do Chamado</label>
              <div className="grid grid-cols-2 gap-4">
                {(Object.entries(TYPE_CONFIG) as [string, typeof TYPE_CONFIG[keyof typeof TYPE_CONFIG]][]).map(([key, conf]) => {
                  const Icon = conf.icon;
                  const isActive = formData.request_type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, request_type: key as any }))}
                      className={`relative flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        isActive
                          ? `${conf.bg} border-transparent ring-2 ${conf.ring} shadow-sm`
                          : 'bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? conf.bg : 'bg-gray-100 dark:bg-gray-800'} transition-colors`}>
                        <Icon className={`w-5 h-5 ${isActive ? conf.color : 'text-gray-400 dark:text-gray-500'} transition-colors`} />
                      </div>
                      <span className={`text-sm font-semibold transition-colors ${isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                        {conf.label}
                      </span>
                    </button>
                  );
                })}
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
              className="group bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-gray-100 dark:border-gray-700 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-200"
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
                        onClick={() => handleAssignToMe(req.id)}
                        className="px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-all whitespace-nowrap"
                      >
                        Assumir
                      </button>
                    )}
                    <div className="relative">
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
    </div>
  );
};

export default ITRequestManagement;
