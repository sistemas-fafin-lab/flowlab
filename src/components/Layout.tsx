import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Plus,
  History,
  FileText,
  AlertTriangle,
  Menu,
  X,
  LogOut,
  Clock,
  ChevronDown,
  ChevronRight,
  Users,
  Shield,
  Building2,
  Calculator,
  DollarSign,
  MessageSquare,
  Settings,
  AlertCircle,
  Receipt,
  GripVertical,
  Save,
  RotateCcw,
  Pencil,
  LucideIcon,
  Monitor,
  Headphones,
  KanbanSquare,
  Server,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { hasPermission, getRoleLabel } from '../utils/permissions';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LayoutProps {
  children: React.ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  permission?: string;
  category?: string;
  subItems?: NavigationItem[];
}

interface CategoryConfig {
  id: string;
  name: string;
  sort_order: number;
  items: string[]; // navigation item names
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'gerencial', name: 'GERENCIAL', sort_order: 0, items: ['Dashboard'] },
  {
    id: 'operacoes',
    name: 'OPERAÇÕES',
    sort_order: 1,
    items: ['Produtos', 'Movimentações', 'Solicitações', 'Fornecedores', 'Cotações', 'Faturamento'],
  },
  {
    id: 'administracao',
    name: 'ADMINISTRAÇÃO',
    sort_order: 2,
    items: ['Usuários', 'Sistema'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR COLLAPSE PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

const COLLAPSE_KEY = 'flowLab_sidebar_collapsed';

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY EDITOR MODAL (Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

interface CategoryEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryConfig[];
  allItems: string[];
  onSave: (categories: CategoryConfig[]) => void;
}

const CategoryEditorModal: React.FC<CategoryEditorModalProps> = ({
  isOpen,
  onClose,
  categories,
  allItems,
  onSave,
}) => {
  const [draft, setDraft] = useState<CategoryConfig[]>([]);
  const dragItem = useRef<{ item: string; fromCatId: string } | null>(null);

  useEffect(() => {
    if (isOpen) setDraft(categories.map((c) => ({ ...c, items: [...c.items] })));
  }, [isOpen, categories]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const assignedItems = draft.flatMap((c) => c.items);
  const unassigned = allItems.filter((i) => !assignedItems.includes(i));

  const moveItem = (item: string, fromCatId: string, toCatId: string) => {
    setDraft((prev) =>
      prev.map((c) => {
        if (c.id === fromCatId) return { ...c, items: c.items.filter((i) => i !== item) };
        if (c.id === toCatId) return { ...c, items: [...c.items, item] };
        return c;
      })
    );
  };

  const addCategory = () => {
    const id = `cat_${Date.now()}`;
    setDraft((prev) => [...prev, { id, name: 'NOVA CATEGORIA', sort_order: prev.length, items: [] }]);
  };

  const removeCategory = (catId: string) => {
    setDraft((prev) => prev.filter((c) => c.id !== catId));
  };

  const renameCat = (catId: string, name: string) => {
    setDraft((prev) => prev.map((c) => (c.id === catId ? { ...c, name } : c)));
  };

  // Drag handlers for cross-category drag
  const handleDragStart = (item: string, fromCatId: string) => {
    dragItem.current = { item, fromCatId };
  };

  const handleDropOnCategory = (toCatId: string) => {
    if (dragItem.current && dragItem.current.fromCatId !== toCatId) {
      moveItem(dragItem.current.item, dragItem.current.fromCatId, toCatId);
    }
    dragItem.current = null;
  };

  const handleDropOnUnassigned = () => {
    if (dragItem.current) {
      setDraft((prev) =>
        prev.map((c) =>
          c.id === dragItem.current!.fromCatId
            ? { ...c, items: c.items.filter((i) => i !== dragItem.current!.item) }
            : c
        )
      );
    }
    dragItem.current = null;
  };

  const handleDragFromUnassigned = (item: string) => {
    dragItem.current = { item, fromCatId: '__unassigned__' };
  };

  const handleDropFromUnassigned = (toCatId: string) => {
    if (dragItem.current && dragItem.current.fromCatId === '__unassigned__') {
      setDraft((prev) =>
        prev.map((c) =>
          c.id === toCatId ? { ...c, items: [...c.items, dragItem.current!.item] } : c
        )
      );
    }
    dragItem.current = null;
  };

  const modalContent = (
    <motion.div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative z-10 w-full max-w-2xl flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl"
        style={{ maxHeight: 'min(85vh, 680px)' }}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <GripVertical className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100">Categorias do Menu</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Arraste módulos entre categorias</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {draft.map((cat) => (
            <motion.div
              key={cat.id}
              layout
              className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                handleDropOnCategory(cat.id);
                handleDropFromUnassigned(cat.id);
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) => renameCat(cat.id, e.target.value)}
                  className="flex-1 text-xs font-bold uppercase tracking-wider bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-blue-500 pb-1"
                />
                <button
                  onClick={() => removeCategory(cat.id)}
                  className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
                  title="Remover categoria"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <Reorder.Group
                axis="y"
                values={cat.items}
                onReorder={(newItems) =>
                  setDraft((prev) => prev.map((c) => (c.id === cat.id ? { ...c, items: newItems } : c)))
                }
                className="space-y-1"
              >
                <AnimatePresence mode="popLayout">
                  {cat.items.map((item) => (
                    <Reorder.Item
                      key={item}
                      value={item}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm text-gray-700 dark:text-gray-300 cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={() => handleDragStart(item, cat.id)}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -30, transition: { duration: 0.15 } }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      whileDrag={{
                        scale: 1.03,
                        boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                        zIndex: 50,
                      }}
                    >
                      <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="flex-1">{item}</span>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) moveItem(item, cat.id, e.target.value);
                          e.target.value = '';
                        }}
                        className="text-xs bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 text-gray-500"
                      >
                        <option value="">Mover...</option>
                        {draft
                          .filter((c) => c.id !== cat.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </Reorder.Item>
                  ))}
                </AnimatePresence>
              </Reorder.Group>

              {cat.items.length === 0 && (
                <p className="text-xs text-gray-400 italic px-3 py-2">Arraste módulos aqui</p>
              )}
            </motion.div>
          ))}

          {/* Unassigned */}
          <AnimatePresence>
            {unassigned.length > 0 && (
              <motion.div
                layout
                className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4"
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); handleDropOnUnassigned(); }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              >
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Sem Categoria</p>
                <div className="space-y-1">
                  {unassigned.map((item) => (
                    <motion.div
                      key={item}
                      layout
                      draggable
                      onDragStart={() => handleDragFromUnassigned(item)}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300 cursor-grab active:cursor-grabbing"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      whileHover={{ scale: 1.01 }}
                    >
                      <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="flex-1">{item}</span>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setDraft((prev) =>
                              prev.map((c) => (c.id === e.target.value ? { ...c, items: [...c.items, item] } : c))
                            );
                          }
                        }}
                        className="text-xs bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 text-gray-500"
                      >
                        <option value="">Adicionar a...</option>
                        {draft.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={addCategory}
            className="w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            + Nova Categoria
          </button>
        </div>

        {/* Footer */}
        <div className="flex-none flex items-center justify-between p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
          >
            <Save className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLTIP WRAPPER (for collapsed sidebar)
// ═══════════════════════════════════════════════════════════════════════════════

const SidebarTooltip: React.FC<{ label: string; show: boolean; children: React.ReactNode }> = ({
  label,
  show,
  children,
}) => (
  <div className="relative group/tip">
    {children}
    {show && (
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium rounded-lg shadow-lg opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-[60]">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-700" />
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LAYOUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, userProfile, signOut } = useAuth();
  const { isDark } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['Produtos']);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [categories, setCategories] = useState<CategoryConfig[]>(DEFAULT_CATEGORIES);
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false);

  const userRole = userProfile?.role || 'requester';
  const userPermissions = userProfile?.permissions || [];
  const isAdmin = hasPermission(userPermissions, 'canManageUsers');

  // ─── Persist collapsed state ────────────────────────────────────────────────
  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  // ─── Load categories from Supabase ──────────────────────────────────────────
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('module_categories')
          .select('*')
          .order('sort_order');
        if (!error && data && data.length > 0) {
          setCategories(
            data.map((row: any) => ({
              id: row.id,
              name: row.name,
              sort_order: row.sort_order,
              items: row.items || [],
            }))
          );
        }
      } catch {
        // Table may not exist yet — use defaults
      }
    };
    loadCategories();
  }, []);

  // ─── Save categories to Supabase ───────────────────────────────────────────
  const handleSaveCategories = useCallback(async (newCategories: CategoryConfig[]) => {
    setCategories(newCategories);
    try {
      // Upsert all categories
      for (let i = 0; i < newCategories.length; i++) {
        const cat = newCategories[i];
        await supabase.from('module_categories').upsert(
          { id: cat.id, name: cat.name, sort_order: i, items: cat.items },
          { onConflict: 'id' }
        );
      }
      // Delete removed categories
      const currentIds = newCategories.map((c) => c.id);
      await supabase.from('module_categories').delete().not('id', 'in', `(${currentIds.join(',')})`);
    } catch {
      // Silent fail — categories still saved locally
    }
  }, []);

  // ─── Navigation Items ───────────────────────────────────────────────────────
  const navigation: NavigationItem[] = useMemo(
    () => [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permission: 'canViewDashboard',
        category: 'GERENCIAL',
      },
      {
        name: 'Produtos',
        href: '/products',
        icon: Package,
        permission: 'canViewProducts',
        category: 'OPERAÇÕES',
        subItems: [
          { name: 'Lista de Produtos', href: '/products', icon: Package, permission: 'canViewProducts' },
          { name: 'Adicionar Produto', href: '/add-product', icon: Plus, permission: 'canAddProducts' },
          { name: 'Controle de Validade', href: '/expiration', icon: AlertTriangle, permission: 'canViewExpiration' },
          { name: 'Histórico de Alterações', href: '/changelog', icon: Clock, permission: 'canViewChangelog' },
        ],
      },
      {
        name: 'Movimentações',
        href: '/movements',
        icon: History,
        permission: 'canViewMovements',
        category: 'OPERAÇÕES',
      },
      {
        name: 'Solicitações',
        href: '/requests',
        icon: FileText,
        permission: 'canViewRequests',
        category: 'OPERAÇÕES',
      },
      {
        name: 'Fornecedores',
        href: '/suppliers',
        icon: Building2,
        permission: 'canManageSuppliers',
        category: 'OPERAÇÕES',
      },
      {
        name: 'Cotações',
        href: '/quotations',
        icon: Calculator,
        permission: 'canManageQuotations',
        category: 'OPERAÇÕES',
      },
      {
        name: 'Faturamento',
        href: '/faturamento/faturas',
        icon: Receipt,
        permission: 'canViewBilling',
        category: 'OPERAÇÕES',
        subItems: [
          { name: 'Faturas / Notas', href: '/faturamento/faturas', icon: FileText, permission: 'canViewBilling' },
          { name: 'Contas a Receber', href: '/faturamento/recebimentos', icon: DollarSign, permission: 'canViewBilling' },
          { name: 'Glosas e Recursos', href: '/faturamento/glosas', icon: AlertCircle, permission: 'canViewBilling' },
        ],
      },
      {
        name: 'Usuários',
        href: '/users',
        icon: Users,
        permission: 'canManageUsers',
        category: 'ADMINISTRAÇÃO',
      },
      {
        name: 'Sistema',
        href: '/system',
        icon: Settings,
        permission: 'canManageUsers',
        category: 'ADMINISTRAÇÃO',
        subItems: [
          { name: 'Configurar Períodos', href: '/request-periods', icon: Clock, permission: 'canConfigureRequestPeriods' },
          { name: 'Provedores de Mensagens', href: '/messaging-settings', icon: MessageSquare, permission: 'canManageUsers' },
        ],
      },
      {
        name: 'Tecnologia',
        href: '/it/dashboard',
        icon: Server,
        permission: 'canManageIT',
        category: 'TECNOLOGIA',
        subItems: [
          { name: 'Hub de Aplicações', href: '/it/dashboard', icon: Server, permission: 'canManageIT' },
          { name: 'Kanban / Sprints', href: '/it/kanban', icon: KanbanSquare, permission: 'canManageIT' },
        ],
      },
    ],
    []
  );

  // ─── Navigation helpers ─────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await signOut();
  };

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName) ? prev.filter((name) => name !== itemName) : [...prev, itemName]
    );
  };

  const isItemActive = (href: string, subItems?: NavigationItem[]) => {
    if (location.pathname === href) return true;
    if (subItems) return subItems.some((sub) => location.pathname === sub.href);
    return false;
  };

  const isSubItemActive = (href: string) => location.pathname === href;

  const canAccessItem = (item: NavigationItem) => {
    if (!item.permission) return true;
    return hasPermission(userPermissions, item.permission);
  };

  // ─── Group items by categories ──────────────────────────────────────────────
  const groupedNavigation = useMemo(() => {
    const accessibleItems = navigation.filter(canAccessItem);
    const groups: { category: string; items: NavigationItem[] }[] = [];

    for (const cat of categories) {
      const items = cat.items
        .map((name) => accessibleItems.find((nav) => nav.name === name))
        .filter(Boolean) as NavigationItem[];
      if (items.length > 0) {
        groups.push({ category: cat.name, items });
      }
    }

    // Any remaining accessible items not in any category
    const assignedNames = categories.flatMap((c) => c.items);
    const uncategorized = accessibleItems.filter((nav) => !assignedNames.includes(nav.name));
    if (uncategorized.length > 0) {
      groups.push({ category: 'OUTROS', items: uncategorized });
    }

    return groups;
  }, [navigation, categories, userPermissions]);

  // All nav item names (for category editor)
  const allNavItemNames = useMemo(() => navigation.map((n) => n.name), [navigation]);

  // ─── Render Navigation Item ─────────────────────────────────────────────────
  const renderNavigationItem = (item: NavigationItem, isMobile = false, collapsed = false) => {
    if (!canAccessItem(item)) return null;

    const hasSubItems = item.subItems && item.subItems.length > 0;
    const accessibleSubItems = hasSubItems ? item.subItems!.filter(canAccessItem) : [];
    const hasAccessibleSubItems = accessibleSubItems.length > 0;
    const isExpanded = expandedItems.includes(item.name);
    const isActive = isItemActive(item.href, item.subItems);

    // ── Collapsed mode ──
    if (collapsed) {
      return (
        <SidebarTooltip key={item.name} label={item.name} show={true}>
          <Link
            to={item.href}
            className={`flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
          </Link>
        </SidebarTooltip>
      );
    }

    // ── Expanded mode ──
    return (
      <motion.div
        key={item.name}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      >
        <div className="flex items-center">
          <Link
            to={item.href}
            onClick={isMobile ? () => setSidebarOpen(false) : undefined}
            className={`flex items-center flex-1 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <item.icon className="mr-3 h-5 w-5 flex-shrink-0 transition-transform duration-200" />
            <span className="truncate">{item.name}</span>
          </Link>
          {hasAccessibleSubItems && (
            <button
              onClick={() => toggleExpanded(item.name)}
              className={`p-1.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </button>
          )}
        </div>

        {hasAccessibleSubItems && (
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                className="ml-6 mt-2 space-y-1 border-l border-slate-200 dark:border-slate-700/60 pl-3 overflow-hidden"
                initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -4, scaleY: 0.97 }}
                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ originY: 0 }}
              >
                {accessibleSubItems.map((subItem, index) => (
                  <motion.div
                    key={subItem.name}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.14, delay: index * 0.03, ease: 'easeOut' }}
                  >
                    <Link
                      to={subItem.href}
                      onClick={isMobile ? () => setSidebarOpen(false) : undefined}
                      className={`block px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        isSubItemActive(subItem.href)
                          ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {subItem.name}
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </motion.div>
    );
  };

  // ─── Render Grouped Navigation ──────────────────────────────────────────────
  const renderGroupedNav = (isMobile = false, collapsed = false) => {
    return groupedNavigation.map((group, groupIndex) => (
      <div key={group.category}>
        {/* Category divider/label */}
        {groupIndex > 0 && collapsed && (
          <div className="my-3 mx-1 border-t border-gray-200/60 dark:border-gray-700/60" />
        )}
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: groupIndex * 0.08 }}
          >
            <p className={`text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 mb-3 ${
              groupIndex > 0 ? 'mt-8' : 'mt-0'
            }`}>
              {group.category}
            </p>
          </motion.div>
        )}
        {/* Items */}
        <div className={collapsed ? 'space-y-1' : 'space-y-2'}>
          {group.items.map((item) => renderNavigationItem(item, isMobile, collapsed))}
        </div>
      </div>
    ));
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* ─── Mobile drawer ─── */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        {/* Panel */}
        <aside
          className={`absolute inset-y-0 left-0 w-[280px] z-10 transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl">
            {/* Mobile Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200/80 dark:border-gray-700/80 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800">
              <Link to="/" className="flex items-center flex-1 justify-center" onClick={() => setSidebarOpen(false)}>
                <img
                  src={isDark ? '/LOGO-HOR-DM.svg' : '/LOGO-HOR.svg'}
                  alt="LAB Logo"
                  className="h-10 w-auto"
                />
              </Link>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
              {renderGroupedNav(true, false)}
            </nav>

            {/* Mobile User Footer */}
            <div className="border-t border-gray-200/80 dark:border-gray-700/80 p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-gray-800">
              <div className="flex items-center gap-3 p-2 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/25">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {userProfile?.name || user?.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {userProfile?.roleName || getRoleLabel(userRole as any)}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                  title="Sair"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ─── Desktop sidebar ─── */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col h-screen overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="flex flex-col h-full w-full overflow-hidden border-r border-gray-200/80 dark:border-gray-700/80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl">
          {/* Desktop Header */}
          <div className={`flex items-center h-16 border-b border-gray-200/80 dark:border-gray-700/80 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 transition-all duration-200 ${isCollapsed ? 'px-2 justify-center' : 'px-4'}`}>
            <Link to="/" className={`flex items-center ${isCollapsed ? 'justify-center' : 'flex-1 justify-center'}`}>
              <AnimatePresence mode="wait">
                {isCollapsed ? (
                  <motion.img
                    key="icon"
                    src={isDark ? '/LOGO BRANCA.png' : '/LOGO.png'}
                    alt="LAB"
                    className="h-10 w-10 object-contain"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  />
                ) : (
                  <motion.img
                    key="full"
                    src={isDark ? '/LOGO-HOR-DM.svg' : '/LOGO-HOR.svg'}
                    alt="LAB Logo"
                    className="h-10 w-auto"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  />
                )}
              </AnimatePresence>
            </Link>
            {!isCollapsed && <ThemeToggle />}
          </div>

          {/* Desktop Navigation */}
          <nav className={`flex-1 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar ${isCollapsed ? 'px-1.5' : 'px-3'}`}>
            {renderGroupedNav(false, isCollapsed)}

            {/* Admin: Edit Categories button */}
            <AnimatePresence>
              {isAdmin && !isCollapsed && (
                <motion.div
                  className="mt-5 px-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <button
                    onClick={() => setIsCategoryEditorOpen(true)}
                    className="flex items-center gap-2 text-[10px] font-medium text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors uppercase tracking-wider"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar categorias
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>

          {/* Desktop User Footer */}
          <div className="border-t border-gray-200/80 dark:border-gray-700/80 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-gray-800 overflow-hidden">
            <AnimatePresence mode="wait">
              {isCollapsed ? (
                /* Collapsed: stacked avatar + logout */
                <motion.div
                  key="collapsed-footer"
                  className="flex flex-col items-center gap-2 py-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <SidebarTooltip label={userProfile?.name || user?.email || 'Usuário'} show={true}>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/25">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                  </SidebarTooltip>
                  <SidebarTooltip label="Tema" show={true}>
                    <ThemeToggle />
                  </SidebarTooltip>
                  <SidebarTooltip label="Sair" show={true}>
                    <button
                      onClick={handleSignOut}
                      className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </SidebarTooltip>
                </motion.div>
              ) : (
                /* Expanded: user card with inline logout */
                <motion.div
                  key="expanded-footer"
                  className="p-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/50">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/25">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={userProfile?.name || user?.email}>
                        {userProfile?.name || user?.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {userProfile?.roleName || getRoleLabel(userRole as any)}
                      </p>
                      {userProfile?.department && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{userProfile.department}</p>
                      )}
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0"
                      title="Sair"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Collapse Toggle Button */}
            <div className="px-3 pb-3 flex justify-center">
              <button
                onClick={toggleCollapsed}
                className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-xs"
                title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
              >
                <motion.div
                  animate={{ rotate: isCollapsed ? 0 : 180 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                >
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      Recolher
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div className={`min-h-screen transition-[padding] duration-300 ${isCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* Mobile header */}
        <div className="sticky top-0 z-40 flex h-16 items-center px-4 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center flex-1 justify-center">
            <Link to="/" className="flex items-center">
              <img
                src={isDark ? '/LOGO-HOR-DM.svg' : '/LOGO-HOR.svg'}
                alt="LAB Logo"
                className="h-12 w-auto mr-2 hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
          <ThemeToggle />
        </div>

        {/* Page content */}
        <main className={`min-h-screen ${location.pathname === '/' ? '' : 'py-4 px-4 sm:px-6 lg:px-8'}`}>
          {children}
        </main>
      </div>

      {/* Category Editor Modal */}
      <CategoryEditorModal
        isOpen={isCategoryEditorOpen}
        onClose={() => setIsCategoryEditorOpen(false)}
        categories={categories}
        allItems={allNavItemNames}
        onSave={handleSaveCategories}
      />
    </div>
  );
};

export default Layout;