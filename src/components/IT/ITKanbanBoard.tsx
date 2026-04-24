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
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { supabase } from '../../lib/supabase';
import Notification from '../Notification';
import ITTaskDrawer from './ITTaskDrawer';

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
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  // ITSM upgrade fields
  is_internal?: boolean;
  estimated_hours?: number | null;
  due_date?: string | null;
  tags?: string[];
  // Joined
  requester_name?: string;
  assignee_name?: string;
}

export type KanbanColumn = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

type FilterType = 'all' | 'suporte' | 'desenvolvimento' | 'consultoria';
type FilterAssignee = 'all' | 'me';

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
  onContextMenu: (e: React.MouseEvent, task: ITRequest) => void;
}> = ({ item, index, onCardClick, onContextMenu }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCardClick(item);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, item);
  };

  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        /* ═══ CAMADA 1: CASCA FÍSICA (Atomic Wrapper) ═══════════════════
           PROIBIDO aqui: margin, backdrop-blur, scale, rotate, transition.
           Qualquer dessas cria um Containing Block que corrompe
           o position:fixed usado pelo @hello-pangea/dnd durante o drag. */
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className="outline-none block w-full"
        >
          {/* ═══ CAMADA 2: DESIGN VISUAL ═══════════════════════════════
               ZERO backdrop-blur em QUALQUER estado.
               Cores sólidas apenas. */}
          <div
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            className={`relative w-full rounded-2xl border p-4 select-none ${
              snapshot.isDragging
                ? 'bg-white dark:bg-slate-800 shadow-2xl border-violet-500/50 ring-2 ring-violet-500/20 cursor-grabbing'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-violet-400 dark:hover:border-violet-500 cursor-grab active:cursor-grabbing transition-shadow duration-200'
            }`}
          >
            {/* Tags row */}
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

            {/* Top row */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400">{item.codigo}</span>
              {(() => {
                const conf = TYPE_CONFIG[item.request_type];
                const Icon = conf.icon;
                return (
                  <div className={`w-6 h-6 rounded-lg ${conf.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                  </div>
                );
              })()}
            </div>

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
              <div className="flex items-center gap-1 min-w-0">
                <User className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {item.assignee_name || item.requester_name || '—'}
                </span>
              </div>
            </div>
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
  onContextMenu: (e: React.MouseEvent, task: ITRequest) => void;
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
}> = ({ column, items, onCardClick, onContextMenu, draggingOverColumn, isAnyDragging, inlineAddColumn, inlineAddText, onInlineAddOpen, onInlineAddClose, onInlineAddTextChange, onInlineAddSubmit, isAddingTask }) => {
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
              {items.map((item, index) => (
                <DraggableCard
                  key={item.id}
                  item={item}
                  index={index}
                  onCardClick={onCardClick}
                  onContextMenu={onContextMenu}
                />
              ))}

              {/* Empty column state */}
              {items.length === 0 && !isAddingHere && !snapshot.isDraggingOver && (
                <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 transition-colors">
                  <Icon className="w-6 h-6 text-gray-300 dark:text-gray-600 mb-1.5" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">Solte aqui</span>
                </div>
              )}

              {provided.placeholder}

              {/* Inline Add UI */}
              <AnimatePresence mode="wait">
                {isAddingHere ? (
                  <motion.div
                    key="inline-add-form"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="mt-2.5"
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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onInlineAddOpen(column.id)}
                    className="mt-2.5 w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-white/70 dark:hover:bg-gray-800/70 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Nova Tarefa
                  </motion.button>
                )}
              </AnimatePresence>
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
  const { notification, showError, showSuccess, hideNotification } = useNotification();
  const [requests, setRequests] = useState<ITRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ITRequest | null>(null);

  // ─── Filter states ─────────────────────────────────────────────────────────
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterAssignee, setFilterAssignee] = useState<FilterAssignee>('all');

  // ─── Inline Add states ─────────────────────────────────────────────────────
  const [inlineAddColumn, setInlineAddColumn] = useState<KanbanColumn | null>(null);
  const [inlineAddText, setInlineAddText] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // ─── Context Menu state ────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [draggingOverColumn, setDraggingOverColumn] = useState<KanbanColumn | null>(null);

  const handleCardClick = (item: ITRequest) => setSelectedTask(item);

  const handleTaskUpdate = (updated: Partial<ITRequest> & { id: string }) => {
    setRequests((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
    setSelectedTask((prev) => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
  };

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('it_requests')
        .select(`
          *,
          requester:user_profiles!requested_by(name),
          assignee:user_profiles!assigned_to(name)
        `)
        .neq('status', 'cancelled')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setRequests(
        (data || []).map((r: any) => ({
          ...r,
          requester_name: r.requester?.name,
          assignee_name: r.assignee?.name,
        }))
      );
    } catch (err) {
      console.error('Erro ao buscar chamados para Kanban:', err);
      showError('Erro ao carregar o quadro Kanban.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ─── Columns data (with filters applied) ─────────────────────────────────────
  const columnItems = useMemo(() => {
    // First, apply filters
    let filtered = requests;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter((r) => r.request_type === filterType);
    }

    // Filter by assignee
    if (filterAssignee === 'me' && userId) {
      filtered = filtered.filter((r) => r.assigned_to === userId || r.requested_by === userId);
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
  }, [requests, filterType, filterAssignee, userId]);

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
      const { error } = await supabase.from('it_requests').insert({
        title: title.trim(),
        request_type: 'desenvolvimento',
        priority: 'medium',
        status: 'pending',
        kanban_status: columnId,
        requested_by: userId,
        is_internal: true,
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

  const handleContextDelete = async () => {
    if (!contextMenu) return;
    setIsDeletingTask(true);
    try {
      const { error } = await supabase
        .from('it_requests')
        .update({ status: 'cancelled' })
        .eq('id', contextMenu.task.id);
      
      if (error) throw error;
      
      setRequests((prev) => prev.filter((r) => r.id !== contextMenu.task.id));
      showSuccess('Tarefa excluída!');
    } catch (err) {
      console.error('Erro ao excluir tarefa:', err);
      showError('Erro ao excluir tarefa.');
    } finally {
      setIsDeletingTask(false);
      handleContextMenuClose();
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent flex items-center gap-2.5">
            <KanbanSquare className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            Quadro Kanban
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Arraste os chamados entre as colunas para atualizar o progresso
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchRequests(); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Filter Pills — SEM animate-fade-in-up */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type filters */}
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterType === 'all'
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Todos
            </span>
          </button>
          <button
            onClick={() => setFilterType('suporte')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterType === 'suporte'
                ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              Suporte
            </span>
          </button>
          <button
            onClick={() => setFilterType('desenvolvimento')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterType === 'desenvolvimento'
                ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5" />
              Dev
            </span>
          </button>
          <button
            onClick={() => setFilterType('consultoria')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterType === 'consultoria'
                ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              Consultoria
            </span>
          </button>
        </div>

        {/* Assignee filter */}
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          <button
            onClick={() => setFilterAssignee('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterAssignee === 'all'
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Todas Tarefas
          </button>
          <button
            onClick={() => setFilterAssignee('me')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterAssignee === 'me'
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <UserCircle className="w-3.5 h-3.5" />
              Minhas
            </span>
          </button>
        </div>

        {/* Active filter indicator */}
        {(filterType !== 'all' || filterAssignee !== 'all') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {filteredCount} de {requests.length} tarefas
            </span>
            <button
              onClick={() => { setFilterType('all'); setFilterAssignee('all'); }}
              className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium transition-colors"
            >
              Limpar filtros
            </button>
          </motion.div>
        )}
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
                onContextMenu={handleContextMenuOpen}
                draggingOverColumn={draggingOverColumn}
                isAnyDragging={Boolean(activeDragId)}
                inlineAddColumn={inlineAddColumn}
                inlineAddText={inlineAddText}
                onInlineAddOpen={handleInlineAddOpen}
                onInlineAddClose={handleInlineAddClose}
                onInlineAddTextChange={setInlineAddText}
                onInlineAddSubmit={handleInlineAddSubmit}
                isAddingTask={isAddingTask}
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

      {/* Context Menu Portal */}
      <AnimatePresence>
        {contextMenu && ReactDOM.createPortal(
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
          </>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
};

export default ITKanbanBoard;
