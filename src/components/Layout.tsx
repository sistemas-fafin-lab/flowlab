import React, { useState } from 'react';
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
  User,
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
  Receipt
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission, getRoleLabel } from '../utils/permissions';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../hooks/useTheme';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  permission?: string;
  subItems?: NavigationItem[];
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, userProfile, signOut } = useAuth();
  const { isDark } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['Produtos']);

  const userRole = userProfile?.role || 'requester';

  const navigation: NavigationItem[] = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: LayoutDashboard,
      permission: 'canViewDashboard'
    },
    { 
      name: 'Produtos', 
      href: '/products', 
      icon: Package,
      permission: 'canViewProducts',
      subItems: [
        { name: 'Lista de Produtos', href: '/products', icon: Package, permission: 'canViewProducts' },
        { name: 'Adicionar Produto', href: '/add-product', icon: Plus, permission: 'canAddProducts' },
        { name: 'Controle de Validade', href: '/expiration', icon: AlertTriangle, permission: 'canViewExpiration' },
        { name: 'Histórico de Alterações', href: '/changelog', icon: Clock, permission: 'canViewChangelog' },
      ]
    },
    { 
      name: 'Movimentações', 
      href: '/movements', 
      icon: History,
      permission: 'canViewMovements'
    },
    { 
      name: 'Solicitações', 
      href: '/requests', 
      icon: FileText,
      permission: 'canViewRequests'
    },
    { 
      name: 'Fornecedores', 
      href: '/suppliers', 
      icon: Building2,
      permission: 'canManageSuppliers'
    },
    { 
      name: 'Cotações', 
      href: '/quotations', 
      icon: Calculator,
      permission: 'canManageQuotations'
    },
    {
      name: 'Faturamento',
      href: '/faturamento/faturas',
      icon: Receipt,
      permission: 'canViewBilling',
      subItems: [
        { name: 'Faturas / Notas', href: '/faturamento/faturas', icon: FileText, permission: 'canViewBilling' },
        { name: 'Contas a Receber', href: '/faturamento/recebimentos', icon: DollarSign, permission: 'canViewBilling' },
        { name: 'Glosas e Recursos', href: '/faturamento/glosas', icon: AlertCircle, permission: 'canViewBilling' },
      ]
    },
    { 
      name: 'Usuários', 
      href: '/users', 
      icon: Users,
      permission: 'canManageUsers'
    },
    {
      name: 'Sistema',
      href: '/system',
      icon: Settings,
      permission: 'canManageUsers',
      subItems: [
        { name: 'Configurar Períodos', href: '/request-periods', icon: Clock, permission: 'canConfigureRequestPeriods' },
        { name: 'Provedores de Mensagens', href: '/messaging-settings', icon: MessageSquare, permission: 'canManageUsers' },
      ]
    }
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isItemActive = (href: string, subItems?: NavigationItem[]) => {
    if (location.pathname === href) return true;
    if (subItems) {
      return subItems.some(subItem => location.pathname === subItem.href);
    }
    return false;
  };

  const isSubItemActive = (href: string) => {
    return location.pathname === href;
  };

  const canAccessItem = (item: NavigationItem) => {
    if (!item.permission) return true;
    return hasPermission(userRole, item.permission as any);
  };

  const renderNavigationItem = (item: NavigationItem, isMobile = false) => {
    if (!canAccessItem(item)) return null;

const hasSubItems = item.subItems && item.subItems.length > 0;
const accessibleSubItems = hasSubItems ? item.subItems!.filter(canAccessItem) : [];
const hasAccessibleSubItems = accessibleSubItems.length > 0;
const isExpanded = expandedItems.includes(item.name);
const isActive = isItemActive(item.href, item.subItems);

    return (
      <div key={item.name} className="animate-fade-in" style={{ animationDelay: `${navigation.indexOf(item) * 0.05}s` }}>
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
            <item.icon className={`mr-3 h-5 w-5 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} />
            {item.name}
          </Link>
          {hasAccessibleSubItems && (
            <button
              onClick={() => toggleExpanded(item.name)}
              className={`p-1.5 rounded-lg transition-all duration-200 ${
                isActive ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        
        {hasAccessibleSubItems && (
          <div className={`ml-6 mt-1 space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
            {accessibleSubItems.map((subItem, index) => (
              <Link
                key={subItem.name}
                to={subItem.href}
                onClick={isMobile ? () => setSidebarOpen(false) : undefined}
                style={{ animationDelay: `${index * 0.05}s` }}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isExpanded ? 'animate-fade-in-up' : ''} ${
                  isSubItemActive(subItem.href)
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-l-2 border-blue-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 hover:translate-x-1'
                }`}
              >
                <subItem.icon className="mr-3 h-4 w-4" />
                {subItem.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* Mobile sidebar overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div 
          className={`fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`} 
          onClick={() => setSidebarOpen(false)} 
        />
        {/* Mobile sidebar - usando mesma estrutura do desktop */}
        <div className={`transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <SidebarContent 
            userRole={userRole}
            userProfile={userProfile}
            user={user}
            navigation={navigation}
            renderNavigationItem={(item) => renderNavigationItem(item, true)}
            handleSignOut={handleSignOut}
            onClose={() => setSidebarOpen(false)}
            isMobile={true}
          />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col h-screen">
        <SidebarContent 
          userRole={userRole}
          userProfile={userProfile}
          user={user}
          navigation={navigation}
          renderNavigationItem={renderNavigationItem}
          handleSignOut={handleSignOut}
          isMobile={false}
        />
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header - simplificado */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg px-4 shadow-sm lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>
        
        <div className="flex items-center flex-1 justify-center">
          <Link to="/" className="flex items-center">
            <img 
              src={isDark ? "/LOGO-HOR-DM.svg" : "/LOGO-HOR.svg"} 
              alt="LAB Logo"
              className="h-12 w-auto mr-2 hover:opacity-80 transition-opacity"
            />
          </Link>
        </div>
          
          {/* Theme toggle for mobile */}
          <ThemeToggle />
        </div>

        {/* Page content */}
        <main className={`min-h-screen animate-fade-in ${location.pathname === '/' ? '' : 'py-4 px-4 sm:px-6 lg:px-8'}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

// Componente reutilizável para o conteúdo da sidebar
interface SidebarContentProps {
  userRole: string;
  userProfile: any;
  user: any;
  navigation: NavigationItem[];
  renderNavigationItem: (item: NavigationItem) => React.ReactNode;
  handleSignOut: () => void;
  onClose?: () => void;
  isMobile: boolean;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  userRole,
  userProfile,
  user,
  navigation,
  renderNavigationItem,
  handleSignOut,
  onClose,
  isMobile
}) => {
  const { isDark } = useTheme();
  
  return (
    <div className={`flex flex-col ${isMobile ? 'h-screen fixed inset-y-0 left-0 w-64 shadow-2xl' : 'h-full border-r border-gray-200/80 dark:border-gray-700/80'} bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl transition-colors duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between h-20 px-4 border-b border-gray-200/80 dark:border-gray-700/80 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 relative">
        <Link to="/" className="flex items-center group flex-1 justify-center">        
          <img 
            src={isDark ? "/LOGO-HOR-DM.svg" : "/LOGO-HOR.svg"} 
            alt="LAB Logo" 
            className="h-12 w-auto transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-xl hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all duration-200 active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Subtitle */}
      <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 text-center">Sistema de Gestão</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Compras e Estoque</p>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => renderNavigationItem(item))}
      </nav>
      
      {/* User info and logout */}
      <div className="border-t border-gray-200/80 dark:border-gray-700/80 p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-gray-800">
        <div className="flex items-center mb-4 p-2 rounded-xl bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/50">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-3 flex-shrink-0 shadow-md shadow-blue-500/25">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={userProfile?.name || user?.email}>
              {userProfile?.name || user?.email}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{getRoleLabel(userRole as any)}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{userProfile?.department}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-500 rounded-xl hover:from-red-600 hover:to-rose-600 transition-all duration-200 shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/30 active:scale-98"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Layout;