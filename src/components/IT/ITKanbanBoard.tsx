import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DragStart,
  type DragUpdate,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  KanbanSquare,
  Code,
  Wrench,
  User,
  RefreshCw,
  Inbox,
  ListTodo,
  Play,
  Eye,
  CheckCircle2,
  Plus,
  X,
  Filter,
  UserCircle,
  Trash2,
  Edit3,
  Tag,
  Lightbulb,
  MoreVertical,
  GripVertical,
  FolderOpen,
  Layers,
  Zap,
  Search,
  ChevronDown,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { supabase } from '../../lib/supabase';
import Notification from '../Notification';
import ITTaskDrawer from './ITTaskDrawer';
import ITProjectManager from './ITProjectManager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ITRequest {
  id: string;
  codigo: string;
  title: string;
  description: string | null;
  request_type: 'suporte' | 'desenvolvimento' | 'consultoria';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'resolved' | 'cancelled';
  kanban_status: KanbanColumn;
  requested_by: string;
  assigned_to: string[];
  created_at: string;
  updated_at: string;
  // ITSM upgrade fields
  is_internal?: boolean;
  estimated_hours?: number | null;
  due_date?: string | null;
  tags?: string[];
  // Project / Sprint
  project_id?: string | null;
  sprint_id?: string | null;
  // Joined
  requester_name?: string;
  assignee_names?: string[];
  project_name?: string;
  project_color?: string;
  sprint_name?: string;
}

export interface ITProject {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ITSprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'planned' | 'active' | 'completed';
  created_at: string;
  updated_at: string;
}

export type KanbanColumn = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

type FilterType = 'all' | 'suporte' | 'desenvolvimento' | 'consultoria';
type ViewMode = 'all' | 'by_project' | 'by_sprint';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const COLUMNS: { id: KanbanColumn; label: string; icon: React.ComponentType<{ className?: string }>; accent: string; dotColor: string }[] = [
  { id: 'backlog',     label: 'Backlog',      icon: Inbox,        accent: 'text-gray-500 dark:text-gray-400',    dotColor: 'bg-gray-400' },
  { id: 'todo',        label: 'A Fazer',      icon: ListTodo,     accent: 'text-blue-600 dark:text-blue-400',    dotColor: 'bg-blue-500' },
  { id: 'in_progress', label: 'Em Progresso', icon: Play,         accent: 'text-amber-600 dark:text-amber-400',  dotColor: 'bg-amber-500' },
  { id: 'review',      label: 'Revisão',      icon: Eye,          accent: 'text-violet-600 dark:text-violet-400', dotColor: 'bg-violet-500' },
  { id: 'done',        label: 'Concluído',    icon: CheckCircle2, accent: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
];

const PRIORITY_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  low:      { label: 'Baixa',   badge: 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300',       dot: 'bg-gray-400' },
  medium:   { label: 'Média',   badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',       dot: 'bg-blue-500' },
  high:     { label: 'Alta',    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  critical: { label: 'Crítica', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',           dot: 'bg-red-500' },
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  suporte:         { label: 'Suporte',   icon: Wrench,    color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  desenvolvimento: { label: 'Dev',       icon: Code,      color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  consultoria:     { label: 'Consultoria', icon: Lightbulb, color: 'text-teal-500 dark:text-teal-400',  bg: 'bg-teal-100 dark:bg-teal-900/30' },
};

// Nenhum helper de estilo necessário — a casca física usa provided.draggableProps.style diretamente.

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT MENU TYPE
// ═══════════════════════════════════════════════════════════════════════════════

interface ContextMenuState {
  x: number;
  y: number;
  task: ITRequest;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAGGABLE CARD
// ═══════════════════════════════════════════════════════════════════════════════

const DraggableCard: React.FC<{
  item: ITRequest;
  index: number;
  onCardClick: (item: ITRequest) => void;
  onMenuOpen: (e: React.MouseEvent, task: ITRequest) => void;
  onDeleteClick: (task: ITRequest) => void;
}> = ({ item, index, onCardClick, onMenuOpen, onDeleteClick }) => {
  // @hello-pangea/dnd has built-in `isEventInInteractiveElement` detection:
  // when the click target is a <button>, it does NOT initiate drag and does NOT
  // call event.preventDefault() — so dragHandleProps on the whole card is safe
  // and buttons inside it work normally.

  const handleClick = (e: React.MouseEvent) => {
    onCardClick(item);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[ITKanbanBoard/DraggableCard] Delete button clicked for task:', item.id, item.title);
    onDeleteClick(item);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMenuOpen(e, item);
  };

  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className="outline-none block w-full"
        >
          <div
            onClick={handleClick}
            className={`relative w-full rounded-2xl border p-3 select-none ${
              snapshot.isDragging
                ? 'bg-white dark:bg-slate-800 shadow-2xl border-violet-500/50 ring-2 ring-violet-500/20 cursor-grabbing'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-violet-400 dark:hover:border-violet-500 cursor-grab active:cursor-grabbing transition-shadow duration-200'
            }`}
          >
            {/* Top row: code + type icon + action buttons */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 flex-1 truncate">{item.codigo}</span>
              {(() => {
                const conf = TYPE_CONFIG[item.request_type];
                const Icon = conf.icon;
                return (
                  <div className={`w-5 h-5 rounded-md ${conf.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3 h-3 ${conf.color}`} />
                  </div>
                );
              })()}
              {/* Action buttons — always visible, dnd skips interactive elements */}
              <button
                onClick={handleMenuClick}
                onMouseDown={(e) => e.stopPropagation()}
                title="Opções"
                className="flex-shrink-0 p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDeleteClick}
                onMouseDown={(e) => e.stopPropagation()}
                title="Excluir do Kanban"
                className="flex-shrink-0 p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {item.tags.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-md">
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1">+{item.tags.length - 3}</span>
                )}
              </div>
            )}

            {/* Title */}
            <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 mb-3 leading-snug">{item.title}</p>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2">
              {(() => {
                const prio = PRIORITY_CONFIG[item.priority];
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md ${prio.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                    {prio.label}
                  </span>
                );
              })()}
              {/* Requester fallback (only when no assignees) */}
              {(item.assignee_names?.length ?? 0) === 0 && (
                <div className="flex items-center gap-1 min-w-0">
                  <User className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {item.requester_name || '—'}
                  </span>
                </div>
              )}
            </div>

            {/* Assignees list (only when there are assignees) */}
            {(item.assignee_names?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-0.5 mt-2">
                {(item.assignee_names || []).slice(0, 2).map((name, i) => (
                  <div key={i} className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{name}</span>
                  </div>
                ))}
                {(item.assignee_names?.length ?? 0) > 2 && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 pl-5">
                    +{(item.assignee_names?.length ?? 0) - 2} mais
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DROPPABLE COLUMN
// ═══════════════════════════════════════════════════════════════════════════════

const KanbanColumnComponent: React.FC<{
  column: typeof COLUMNS[number];
  items: ITRequest[];
  onCardClick: (item: ITRequest) => void;
  onMenuOpen: (e: React.MouseEvent, task: ITRequest) => void;
  onDeleteClick: (task: ITRequest) => void;
  draggingOverColumn: KanbanColumn | null;
  isAnyDragging: boolean;
  // Inline add props
  inlineAddColumn: KanbanColumn | null;
  inlineAddText: string;
  onInlineAddOpen: (columnId: KanbanColumn) => void;
  onInlineAddClose: () => void;
  onInlineAddTextChange: (text: string) => void;
  onInlineAddSubmit: (columnId: KanbanColumn, title: string) => void;
  isAddingTask: boolean;
  // Project grouping
  viewMode: ViewMode;
  projectGroups?: { project: ITProject | null; items: ITRequest[] }[];
}> = ({ column, items, onCardClick, onMenuOpen, onDeleteClick, draggingOverColumn, isAnyDragging, inlineAddColumn, inlineAddText, onInlineAddOpen, onInlineAddClose, onInlineAddTextChange, onInlineAddSubmit, isAddingTask, viewMode, projectGroups }) => {
  const Icon = column.icon;
  const inputRef = useRef<HTMLInputElement>(null);
  const isAddingHere = inlineAddColumn === column.id;

  // Focus input when opened
  useEffect(() => {
    if (isAddingHere && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingHere]);

  const handleSubmit = () => {
    const trimmed = inlineAddText.trim();
    if (trimmed) {
      onInlineAddSubmit(column.id, trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onInlineAddClose();
    }
  };

  return (
    <div className="flex flex-col w-[280px] sm:w-[300px] flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2.5 px-3 py-3 mb-2">
        <span className={`w-2 h-2 rounded-full ${column.dotColor}`} />
        <Icon className={`w-4 h-4 ${column.accent}`} />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{column.label}</h3>
        <span className="ml-auto text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md tabular-nums">
          {items.length}
        </span>
      </div>

      {/* Inline Add UI — TOP of column */}
      <AnimatePresence mode="wait">
        {isAddingHere ? (
          <motion.div
            key="inline-add-form"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="mb-3"
          >
            <div className="bg-white dark:bg-gray-800 border-2 border-violet-400 dark:border-violet-500 rounded-xl p-3 shadow-lg shadow-violet-500/10">
              <input
                ref={inputRef}
                type="text"
                value={inlineAddText}
                onChange={(e) => onInlineAddTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Título da tarefa…"
                disabled={isAddingTask}
                className="w-full text-sm text-gray-800 dark:text-gray-100 bg-transparent focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 mb-3"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">Enter para criar · Esc para cancelar</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={onInlineAddClose}
                    disabled={isAddingTask}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    aria-label="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!inlineAddText.trim() || isAddingTask}
                    className="p-1.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Criar tarefa"
                  >
                    {isAddingTask ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="inline-add-button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            onClick={() => onInlineAddOpen(column.id)}
            className="mb-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50/60 dark:hover:bg-violet-900/15 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600 transition-all duration-200"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </motion.button>
        )}
      </AnimatePresence>

      {/* Column body */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-[200px] rounded-xl p-2 transition-colors duration-200 overflow-hidden ${
              snapshot.isDraggingOver
                ? 'bg-violet-50/60 dark:bg-violet-900/15 ring-2 ring-violet-400/50 ring-inset'
                : draggingOverColumn === column.id
                  ? 'bg-violet-50/35 dark:bg-violet-900/10 ring-1 ring-violet-300/40 dark:ring-violet-700/40'
                  : isAnyDragging
                    ? 'bg-gray-50/60 dark:bg-gray-800/45'
                    : 'bg-gray-50/50 dark:bg-gray-800/40'
            }`}
          >
            {/* gap-4 controla o espaçamento — casca física do card NÃO pode ter margens */}
            <div className="flex flex-col gap-4 h-full overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              {viewMode === 'by_project' && projectGroups ? (
                // Render grouped by project — visual headers are plain divs, not Draggable
                projectGroups.flatMap((group, groupIndex) => {
                  if (group.items.length === 0) return [];
                  const headerEl = (
                    <div
                      key={`group-header-${groupIndex}`}
                      className="flex items-center gap-2 px-1 mt-1 first:mt-0"
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.project?.color ?? '#94a3b8' }}
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">
                        {group.project?.name ?? 'Sem Projeto'}
                      </span>
                      <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">
                        {group.items.length}
                      </span>
                    </div>
                  );
                  const cards = group.items.map((item) => (
                    <DraggableCard
                      key={item.id}
                      item={item}
                      index={items.indexOf(item)}
                      onCardClick={onCardClick}
                      onMenuOpen={onMenuOpen}
                      onDeleteClick={onDeleteClick}
                    />
                  ));
                  return [headerEl, ...cards];
                })
              ) : (
                items.map((item, index) => (
                  <DraggableCard
                    key={item.id}
                    item={item}
                    index={index}
                    onCardClick={onCardClick}
                    onMenuOpen={onMenuOpen}
                    onDeleteClick={onDeleteClick}
                  />
                ))
              )}

              {/* Empty column state */}
              {items.length === 0 && !isAddingHere && !snapshot.isDraggingOver && (
                <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 transition-colors">
                  <Icon className="w-6 h-6 text-gray-300 dark:text-gray-600 mb-1.5" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">Solte aqui</span>
                </div>
              )}

              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const ITKanbanBoard: React.FC = () => {
  const { userProfile } = useAuth();
  const userId = userProfile?.id ?? '';
  const isITManager = userProfile?.role === 'admin' || userProfile?.department === 'TI';
  const { notification, showError, showSuccess, hideNotification } = useNotification();
  const [requests, setRequests] = useState<ITRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ITRequest | null>(null);

  // ─── Filter states ─────────────────────────────────────────────────────────
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // ─── Projects / Sprints ────────────────────────────────────────────────────
  const [projects, setProjects]       = useState<ITProject[]>([]);
  const [sprints,  setSprints]        = useState<ITSprint[]>([]);
  const [viewMode, setViewMode]       = useState<ViewMode>('all');
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [sprintDropdownOpen, setSprintDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const sprintDropdownRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // ─── Inline Add states ─────────────────────────────────────────────────────
  const [inlineAddColumn, setInlineAddColumn] = useState<KanbanColumn | null>(null);
  const [inlineAddText, setInlineAddText] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // ─── Context Menu state ────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // ─── Delete confirmation state ─────────────────────────────────────────────
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<ITRequest | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [draggingOverColumn, setDraggingOverColumn] = useState<KanbanColumn | null>(null);

  // Race-condition guard: IDs being deleted right now (optimistic + fetch filter)
  const deletingIdsRef = useRef<Set<string>>(new Set());

  const handleCardClick = (item: ITRequest) => setSelectedTask(item);

  const handleTaskUpdate = (updated: Partial<ITRequest> & { id: string }) => {
    setRequests((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
    setSelectedTask((prev) => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
  };

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    try {
      // Fetch users map for assignee name resolution (assigned_to is now UUID[])
      const [requestsResult, usersResult] = await Promise.all([
        supabase
          .from('it_requests')
          .select('*, requester:user_profiles!requested_by(name), project:it_projects!project_id(id,name,color), sprint:it_sprints!sprint_id(id,name,status)')
          .eq('kanban_hidden', false)
          .order('updated_at', { ascending: false }),
        supabase.from('user_profiles').select('id, name'),
      ]);

      let { data, error } = requestsResult;
      const usersRaw = (usersResult.data || []) as { id: string; name: string }[];
      const usersMap = Object.fromEntries(usersRaw.map((u) => [u.id, u.name]));
      setAllUsers(usersRaw.sort((a, b) => a.name.localeCompare(b.name)));

      if (error && (error as any).code === '42703') {
        // Column does not exist yet — fallback query without kanban_hidden
        const fallback = await supabase
          .from('it_requests')
          .select('*, requester:user_profiles!requested_by(name)')
          .neq('status', 'cancelled')
          .order('updated_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      const rawData = (data || []).map((r: any) => ({
        ...r,
        requester_name: r.requester?.name,
        assignee_names: (r.assigned_to || []).map((id: string) => usersMap[id]).filter(Boolean),
        project_name:   r.project?.name  ?? null,
        project_color:  r.project?.color ?? null,
        sprint_name:    r.sprint?.name   ?? null,
      }));

      // Race-condition filter: ignore cards that are being deleted right now
      const filteredData = rawData.filter((r) => !deletingIdsRef.current.has(r.id));
      if (deletingIdsRef.current.size > 0) {
        console.log('[ITKanbanBoard/fetchRequests] Race-condition guard active. Filtering out pending-delete IDs:', Array.from(deletingIdsRef.current), 'Removed from fetch:', rawData.length - filteredData.length);
      }

      setRequests(filteredData);
    } catch (err) {
      console.error('Erro ao buscar chamados para Kanban:', err);
      showError('Erro ao carregar o quadro Kanban.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('it_projects').select('*').order('created_at', { ascending: false });
      if (error && (error as any).code !== '42P01') throw error;
      setProjects((data as ITProject[]) ?? []);
    } catch (err) {
      console.error('Erro ao buscar projetos:', err);
    }
  }, []);

  const fetchSprints = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('it_sprints').select('*').order('created_at', { ascending: false });
      if (error && (error as any).code !== '42P01') throw error;
      setSprints((data as ITSprint[]) ?? []);
    } catch (err) {
      console.error('Erro ao buscar sprints:', err);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchProjects();
    fetchSprints();
  }, [fetchRequests, fetchProjects, fetchSprints]);

  // Close sprint dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sprintDropdownRef.current && !sprintDropdownRef.current.contains(e.target as Node)) {
        setSprintDropdownOpen(false);
      }
    };
    if (sprintDropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sprintDropdownOpen]);

  // Close project dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    if (projectDropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [projectDropdownOpen]);

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    if (userDropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userDropdownOpen]);

  // ─── Columns data (with filters applied) ─────────────────────────────────────
  const columnItems = useMemo(() => {
    // Race-condition guard: strip cards being deleted so they never reappear
    let filtered = requests.filter((r) => !deletingIdsRef.current.has(r.id));

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter((r) => r.request_type === filterType);
    }

    // Filter by assignee/user
    if (filterUserId) {
      filtered = filtered.filter((r) => r.assigned_to.includes(filterUserId) || r.requested_by === filterUserId);
    }

    // Filter by sprint (by_sprint view mode)
    if (viewMode === 'by_sprint' && selectedSprintId) {
      filtered = filtered.filter((r) => r.sprint_id === selectedSprintId);
    }

    // Filter by project (by_project view mode)
    if (viewMode === 'by_project' && selectedProjectId) {
      filtered = filtered.filter((r) => r.project_id === selectedProjectId);
    }

    // Search across all relevant fields
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((r) => {
        const searchableStrings = [
          r.codigo,
          r.title,
          r.description ?? '',
          r.request_type,
          r.priority,
          r.status,
          r.kanban_status,
          r.requester_name ?? '',
          r.project_name ?? '',
          r.sprint_name ?? '',
          ...(r.tags ?? []),
          ...(r.assignee_names ?? []),
        ];
        return searchableStrings.some((s) => s.toLowerCase().includes(q));
      });
    }

    // Then distribute into columns
    const map: Record<KanbanColumn, ITRequest[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    filtered.forEach((r) => {
      if (map[r.kanban_status]) map[r.kanban_status].push(r);
    });
    return map;
  }, [requests, filterType, filterAssignee, userId, viewMode, selectedSprintId, selectedProjectId, searchQuery]);

  // ─── Project grouping (only used in by_project mode) ──────────────────────
  const columnItemsByProject = useMemo(() => {
    if (viewMode !== 'by_project') return null;
    const result: Record<KanbanColumn, { project: ITProject | null; items: ITRequest[] }[]> = {
      backlog: [], todo: [], in_progress: [], review: [], done: [],
    };
    (Object.keys(columnItems) as KanbanColumn[]).forEach((col) => {
      const byProjectId: Record<string, ITRequest[]> = {};
      const unassigned: ITRequest[] = [];
      columnItems[col].forEach((r) => {
        if (r.project_id) {
          if (!byProjectId[r.project_id]) byProjectId[r.project_id] = [];
          byProjectId[r.project_id].push(r);
        } else {
          unassigned.push(r);
        }
      });
      // Assigned projects first (sorted by project name)
      const assignedGroups = Object.entries(byProjectId)
        .map(([pid, items]) => ({ project: projects.find(p => p.id === pid) ?? null, items }))
        .sort((a, b) => (a.project?.name ?? '').localeCompare(b.project?.name ?? ''));
      result[col] = [
        ...assignedGroups,
        ...(unassigned.length > 0 ? [{ project: null, items: unassigned }] : []),
      ];
    });
    return result;
  }, [columnItems, projects, viewMode]);

  // ─── Total filtered count ──────────────────────────────────────────────────
  const filteredCount = useMemo(() => 
    Object.values(columnItems).reduce((acc, col) => acc + col.length, 0)
  , [columnItems]);

  // ─── Inline Add handlers ───────────────────────────────────────────────────
  const handleInlineAddOpen = (columnId: KanbanColumn) => {
    setInlineAddColumn(columnId);
    setInlineAddText('');
  };

  const handleInlineAddClose = () => {
    setInlineAddColumn(null);
    setInlineAddText('');
  };

  const handleInlineAddSubmit = async (columnId: KanbanColumn, title: string) => {
    if (!userId || !title.trim()) return;

    setIsAddingTask(true);
    try {
      const sprintContext = viewMode === 'by_sprint' && selectedSprintId
        ? {
            sprint_id: selectedSprintId,
            project_id: sprints.find(s => s.id === selectedSprintId)?.project_id ?? null,
          }
        : {};

      const { error } = await supabase.from('it_requests').insert({
        title: title.trim(),
        request_type: 'desenvolvimento',
        priority: 'medium',
        status: 'pending',
        kanban_status: columnId,
        requested_by: userId,
        is_internal: true,
        ...sprintContext,
      });

      if (error) throw error;

      showSuccess('Tarefa criada com sucesso!');
      handleInlineAddClose();
      await fetchRequests();
    } catch (err) {
      console.error('Erro ao criar tarefa:', err);
      showError('Erro ao criar tarefa.');
    } finally {
      setIsAddingTask(false);
    }
  };

  // ─── Context Menu handlers ─────────────────────────────────────────────────
  const handleContextMenuOpen = (e: React.MouseEvent, task: ITRequest) => {
    setContextMenu({ x: e.clientX, y: e.clientY, task });
  };

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        handleContextMenuClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleContextMenuClose();
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [contextMenu, handleContextMenuClose]);

  const handleContextEdit = () => {
    if (contextMenu) {
      setSelectedTask(contextMenu.task);
      handleContextMenuClose();
    }
  };

  const handleContextStatusChange = async (newStatus: KanbanColumn) => {
    if (!contextMenu) return;
    try {
      await supabase
        .from('it_requests')
        .update({ kanban_status: newStatus })
        .eq('id', contextMenu.task.id);
      
      setRequests((prev) =>
        prev.map((r) => r.id === contextMenu.task.id ? { ...r, kanban_status: newStatus } : r)
      );
      showSuccess('Status atualizado!');
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      showError('Erro ao atualizar status.');
    }
    handleContextMenuClose();
  };

  const handleContextDelete = () => {
    if (!contextMenu) return;
    setDeleteConfirmTask(contextMenu.task);
    handleContextMenuClose();
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTask) return;
    const taskId = deleteConfirmTask.id;

    // 1. Guarda o ID para bloquear reappearance em fetch concorrente
    deletingIdsRef.current.add(taskId);
    console.log('[ITKanbanBoard/delete] Race-condition guard: added ID to deletingIdsRef:', taskId);

    // 2. Optimistic removal: remove do estado local IMEDIATAMENTE
    setRequests((prev) => {
      const next = prev.filter((r) => r.id !== taskId);
      console.log('[ITKanbanBoard/delete] Optimistic local removal. Before:', prev.length, 'After:', next.length);
      return next;
    });
    setDeleteConfirmTask(null);
    setIsDeletingTask(true);

    try {
      // 3. Persiste no banco
      const { error } = await supabase
        .from('it_requests')
        .update({ kanban_hidden: true })
        .eq('id', taskId);

      if (error) throw error;

      console.log('[ITKanbanBoard/delete] DB update success for ID:', taskId);
      showSuccess('Card removido do Kanban!');
    } catch (err) {
      console.error('[ITKanbanBoard/delete] DB update failed:', err);
      showError('Erro ao remover card do Kanban. Recarregando dados...');
      // Remove do ref para não bloquear o card permanentemente
      deletingIdsRef.current.delete(taskId);
      // Força sincronização com o servidor para reverter estado
      await fetchRequests();
    } finally {
      // Delay para garantir que nenhum fetch "atrasado" venha depois
      setTimeout(() => {
        const wasDeleted = deletingIdsRef.current.delete(taskId);
        if (wasDeleted) {
          console.log('[ITKanbanBoard/delete] Cleaned up deletingIdsRef for ID:', taskId);
        }
      }, 800);
      setIsDeletingTask(false);
    }
  };

  // ─── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (start: DragStart) => {
    setActiveDragId(start.draggableId);
    setDraggingOverColumn(start.source.droppableId as KanbanColumn);
  };

  const handleDragUpdate = (update: DragUpdate) => {
    setDraggingOverColumn((update.destination?.droppableId as KanbanColumn | undefined) ?? null);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    setActiveDragId(null);
    setDraggingOverColumn(null);

    // Dropped outside
    if (!destination) return;

    const sourceCol = source.droppableId as KanbanColumn;
    const destinationCol = destination.droppableId as KanbanColumn;

    // Reordena localmente para manter a animacao de drop suave
    setRequests((prev) => {
      const columns: Record<KanbanColumn, ITRequest[]> = {
        backlog: [],
        todo: [],
        in_progress: [],
        review: [],
        done: [],
      };

      prev.forEach((request) => {
        columns[request.kanban_status].push(request);
      });

      const sourceList = [...columns[sourceCol]];
      const [moved] = sourceList.splice(source.index, 1);
      if (!moved) return prev;

      const movedWithStatus: ITRequest = {
        ...moved,
        kanban_status: destinationCol,
      };

      if (sourceCol === destinationCol) {
        sourceList.splice(destination.index, 0, movedWithStatus);
        columns[sourceCol] = sourceList;
      } else {
        const destinationList = [...columns[destinationCol]];
        destinationList.splice(destination.index, 0, movedWithStatus);
        columns[sourceCol] = sourceList;
        columns[destinationCol] = destinationList;
      }

      return COLUMNS.flatMap((column) => columns[column.id]);
    });

    if (sourceCol === destinationCol) return;

    // Persistencia apenas quando muda de coluna
    try {
      const { error } = await supabase
        .from('it_requests')
        .update({ kanban_status: destinationCol })
        .eq('id', draggableId);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao mover card:', err);
      showError('Erro ao atualizar posição do chamado.');
      console.log('[ITKanbanBoard/drag] Drag save failed — calling fetchRequests() which MAY cause race condition with pending deletes. deletingIdsRef:', Array.from(deletingIdsRef.current));
      await fetchRequests();
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-violet-600 border-t-transparent" />
          <span className="mt-3 text-gray-500 dark:text-gray-400 font-medium">Carregando quadro…</span>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 h-full">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent flex items-center gap-2.5">
            <KanbanSquare className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            Quadro Kanban
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Arraste os chamados entre as colunas para atualizar o progresso
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CONTROL BAR — Glassmorphism unified toolbar
         ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">

        {/* ── LEFT: Search + Filters ─────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">

          {/* Search — seamless into control bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar tarefas..."
              className="w-48 sm:w-56 pl-8 pr-6 py-1.5 text-sm bg-transparent border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-100 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Limpar pesquisa"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Vertical separator */}
          <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700" />

          {/* Type filter pills */}
          <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-slate-800/60 rounded-lg p-0.5">
            {([
              { value: 'all' as const, label: 'Todos', icon: Filter },
              { value: 'suporte' as const, label: 'Suporte', icon: Wrench },
              { value: 'desenvolvimento' as const, label: 'Dev', icon: Code },
              { value: 'consultoria' as const, label: 'Consultoria', icon: Lightbulb },
            ]).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setFilterType(value)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${
                  filterType === value
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* User filter dropdown */}
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all duration-200 border ${
                filterUserId
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
              }`}
            >
              <UserCircle className="w-3.5 h-3.5" />
              {filterUserId
                ? (allUsers.find((u) => u.id === filterUserId)?.name ?? 'Utilizador')
                : 'Todas pessoas'}
              <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${userDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {userDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 top-full mt-1 z-50 min-w-[180px] max-h-64 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1"
                >
                  {/* All */}
                  <button
                    onClick={() => { setFilterUserId(null); setUserDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors ${
                      !filterUserId
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    Todas pessoas
                  </button>
                  {/* Me */}
                  {userId && (
                    <button
                      onClick={() => { setFilterUserId(userId); setUserDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors ${
                        filterUserId === userId
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <UserCircle className="w-3.5 h-3.5 shrink-0" />
                      Eu
                    </button>
                  )}
                  {/* Separator */}
                  {allUsers.filter((u) => u.id !== userId).length > 0 && (
                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                  )}
                  {/* Other users */}
                  {allUsers
                    .filter((u) => u.id !== userId)
                    .map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setFilterUserId(u.id); setUserDropdownOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors ${
                          filterUserId === u.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <User className="w-3.5 h-3.5 shrink-0" />
                        {u.name}
                      </button>
                    ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Vertical separator */}
          <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700" />

          {/* View mode pills */}
          <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-slate-800/60 rounded-lg p-0.5">
            {([
              { value: 'all' as const, label: 'Tudo', icon: Layers },
              { value: 'by_project' as const, label: 'Projeto', icon: FolderOpen },
              { value: 'by_sprint' as const, label: 'Sprint', icon: Zap },
            ]).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  if (value === 'all') { setSelectedSprintId(null); setSelectedProjectId(null); }
                  if (value === 'by_project') { setSelectedSprintId(null); setSelectedProjectId(null); }
                  if (value === 'by_sprint') { setSelectedProjectId(null); }
                  setViewMode(value);
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${
                  viewMode === value
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Project selector (only in by_project mode) */}
          {viewMode === 'by_project' && (
            <div className="relative" ref={projectDropdownRef}>
              <button
                onClick={() => setProjectDropdownOpen(prev => !prev)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-transparent hover:border-violet-300 dark:hover:border-violet-600 transition-all"
              >
                <FolderOpen className="w-3 h-3 text-violet-500" />
                <span>
                  {selectedProjectId
                    ? (projects.find(p => p.id === selectedProjectId)?.name ?? 'Projeto')
                    : 'Todos'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              <AnimatePresence>
                {projectDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 top-full mt-1 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden"
                  >
                    {projects.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
                        Nenhum projeto encontrado.<br />Crie um projeto primeiro.
                      </div>
                    ) : (
                      <div className="py-1 max-h-64 overflow-y-auto">
                        {projects.map(project => (
                          <button
                            key={project.id}
                            onClick={() => { setSelectedProjectId(project.id); setProjectDropdownOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                              selectedProjectId === project.id
                                ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: project.color }}
                            />
                            <span className="flex-1 truncate">{project.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Sprint selector (only in by_sprint mode) */}
          {viewMode === 'by_sprint' && (
            <div className="relative" ref={sprintDropdownRef}>
              <button
                onClick={() => setSprintDropdownOpen(prev => !prev)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-transparent hover:border-emerald-300 dark:hover:border-emerald-600 transition-all"
              >
                <Zap className="w-3 h-3 text-emerald-500" />
                <span>
                  {selectedSprintId
                    ? (sprints.find(s => s.id === selectedSprintId)?.name ?? 'Sprint')
                    : 'Todas'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              <AnimatePresence>
                {sprintDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 top-full mt-1 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden"
                  >
                    {sprints.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
                        Nenhum sprint encontrado.<br />Crie um projeto e sprint primeiro.
                      </div>
                    ) : (
                      <div className="py-1 max-h-64 overflow-y-auto">
                        {projects.map(project => {
                          const projectSprints = sprints.filter(s => s.project_id === project.id);
                          if (projectSprints.length === 0) return null;
                          return (
                            <div key={project.id}>
                              <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-100 dark:border-gray-700 first:border-t-0">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">
                                  {project.name}
                                </span>
                              </div>
                              {projectSprints.map(sprint => (
                                <button
                                  key={sprint.id}
                                  onClick={() => { setSelectedSprintId(sprint.id); setSprintDropdownOpen(false); }}
                                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-xs transition-colors ${
                                    selectedSprintId === sprint.id
                                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  <Zap className="w-3 h-3 flex-shrink-0 text-gray-400" />
                                  <span className="flex-1 truncate">{sprint.name}</span>
                                  {sprint.status === 'active' && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-md flex-shrink-0">
                                      Ativo
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Active filter indicator */}
          {(filterType !== 'all' || filterUserId !== null || searchQuery) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {filteredCount} de {requests.length}
              </span>
              <button
                onClick={() => { setFilterType('all'); setFilterUserId(null); setSearchQuery(''); }}
                className="text-[11px] text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium transition-colors"
              >
                Limpar
              </button>
            </motion.div>
          )}
        </div>

        {/* ── RIGHT: Actions ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 w-full lg:w-auto lg:justify-end">
          {isITManager && (
            <button
              onClick={() => setShowProjectManager(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-transparent hover:border-violet-300 dark:hover:border-violet-600 transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Gerir Projetos
            </button>
          )}
          <button
            onClick={() => { setLoading(true); fetchRequests(); fetchProjects(); fetchSprints(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Kanban board — ZERO transform/animation/backdrop neste wrapper.
           animate-fade-in-up criava transform:translateY(0) via forwards fill-mode,
           que estabelece um Containing Block e quebra position:fixed do drag. */}
      <div className="overflow-x-auto pb-4 -mx-1 px-1">
        <DragDropContext onDragStart={handleDragStart} onDragUpdate={handleDragUpdate} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map((col) => (
              <KanbanColumnComponent
                key={col.id}
                column={col}
                items={columnItems[col.id]}
                onCardClick={handleCardClick}
                onMenuOpen={handleContextMenuOpen}
                onDeleteClick={(task) => {
                  console.log('[ITKanbanBoard] Opening delete modal for task:', task.id, task.title);
                  setDeleteConfirmTask(task);
                }}
                draggingOverColumn={draggingOverColumn}
                isAnyDragging={Boolean(activeDragId)}
                inlineAddColumn={inlineAddColumn}
                inlineAddText={inlineAddText}
                onInlineAddOpen={handleInlineAddOpen}
                onInlineAddClose={handleInlineAddClose}
                onInlineAddTextChange={setInlineAddText}
                onInlineAddSubmit={handleInlineAddSubmit}
                isAddingTask={isAddingTask}
                viewMode={viewMode}
                projectGroups={columnItemsByProject?.[col.id]}
              />
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* Task drawer */}
      <AnimatePresence>
        {selectedTask && (
          <ITTaskDrawer
            key={selectedTask.id}
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={handleTaskUpdate}
          />
        )}
      </AnimatePresence>

      {/* Project Manager */}
      <AnimatePresence>
        {showProjectManager && (
          <ITProjectManager
            userId={userId}
            onClose={() => setShowProjectManager(false)}
            onDataChanged={() => { fetchProjects(); fetchSprints(); fetchRequests(); }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {deleteConfirmTask && ReactDOM.createPortal(
        <AnimatePresence>
          <motion.div
            key="delete-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 dark:bg-black/60"
              onClick={() => !isDeletingTask && setDeleteConfirmTask(null)}
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-black/25 dark:shadow-black/60 border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Red top bar */}
              <div className="h-1 w-full bg-gradient-to-r from-red-500 to-rose-500" />

              <div className="p-6">
                {/* Icon + title */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                      Excluir tarefa?
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Esta ação não poderá ser desfeita.
                    </p>
                  </div>
                </div>

                {/* Task preview */}
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 mb-6">
                  <p className="text-[11px] font-mono font-bold text-violet-600 dark:text-violet-400 mb-0.5">
                    {deleteConfirmTask.codigo}
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2">
                    {deleteConfirmTask.title}
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setDeleteConfirmTask(null)}
                    disabled={isDeletingTask}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeletingTask}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 rounded-xl transition-colors disabled:opacity-70 shadow-sm shadow-red-500/30"
                  >
                    {isDeletingTask ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {isDeletingTask ? 'Excluindo…' : 'Sim, excluir'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Context Menu Portal */}
      {contextMenu && ReactDOM.createPortal(
        <AnimatePresence>
          <>
            {/* Invisible overlay to catch clicks */}
            <div 
              className="fixed inset-0 z-[100]" 
              onClick={handleContextMenuClose}
              onContextMenu={(e) => { e.preventDefault(); handleContextMenuClose(); }}
            />
            
            {/* Context Menu */}
            <motion.div
              ref={contextMenuRef}
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="fixed z-[101] bg-white/98 dark:bg-gray-800/98 backdrop-blur-xl rounded-xl shadow-xl shadow-black/15 dark:shadow-black/40 border border-gray-200/80 dark:border-gray-700 w-52 py-1.5 overflow-hidden"
              style={{
                left: Math.min(contextMenu.x, window.innerWidth - 220),
                top: Math.min(contextMenu.y, window.innerHeight - 280),
              }}
            >
              {/* Task info header */}
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-400 mb-0.5">
                  {contextMenu.task.codigo}
                </p>
                <p className="text-xs font-medium text-slate-900 dark:text-gray-100 truncate">
                  {contextMenu.task.title}
                </p>
              </div>

              {/* Actions */}
              <div className="py-1">
                <button
                  onClick={handleContextEdit}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 flex items-center gap-2.5 transition-colors"
                >
                  <Edit3 className="w-4 h-4 text-gray-400" />
                  Editar
                </button>

                {/* Move to column sub-section */}
                <div className="px-3 py-1.5">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                    Mover para
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {COLUMNS.filter(c => c.id !== contextMenu.task.kanban_status).map((col) => {
                      const Icon = col.icon;
                      return (
                        <button
                          key={col.id}
                          onClick={() => handleContextStatusChange(col.id)}
                          className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors flex items-center gap-1 ${col.accent} hover:bg-gray-100 dark:hover:bg-gray-700`}
                          title={col.label}
                        >
                          <Icon className="w-3 h-3" />
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />

                <button
                  onClick={handleContextDelete}
                  disabled={isDeletingTask}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5 transition-colors disabled:opacity-50"
                >
                  {isDeletingTask ? (
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Excluir Tarefa
                </button>
              </div>
            </motion.div>
          </>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default ITKanbanBoard;
