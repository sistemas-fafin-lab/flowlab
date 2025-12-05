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
  Calculator
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission, getRoleLabel } from '../utils/permissions';

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
      name: 'Usuários', 
      href: '/users', 
      icon: Users,
      permission: 'canManageUsers'
    },
    {
      name: 'Configurar Períodos',
      href: '/request-periods',
      icon: Clock,
      permission: 'canConfigureRequestPeriods'
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
      <div key={item.name}>
        <div className="flex items-center">
          <Link
            to={item.href}
            onClick={isMobile ? () => setSidebarOpen(false) : undefined}
            className={`flex items-center flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </Link>
          {hasAccessibleSubItems && (
            <button
              onClick={() => toggleExpanded(item.name)}
              className={`p-1 rounded transition-colors ${
                isActive ? 'text-blue-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        
        {hasAccessibleSubItems && isExpanded && (
          <div className="ml-6 mt-1 space-y-1">
            {accessibleSubItems.map((subItem) => (
              <Link
                key={subItem.name}
                to={subItem.href}
                onClick={isMobile ? () => setSidebarOpen(false) : undefined}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isSubItemActive(subItem.href)
                    ? 'bg-blue-50 text-blue-600 border-l-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
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
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        {/* Mobile sidebar - usando mesma estrutura do desktop */}
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
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-700 hover:text-gray-900 p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        
        <div className="flex items-center flex-1 justify-center">
          <Link to="/" className="flex items-center">
            <img 
              src="/LOGO-HOR.svg" 
              alt="LAB Logo"
              className="h-12 w-auto mr-2"
            />
          </Link>
        </div>
          
          {/* Espaço para manter o logo centralizado */}
          <div className="w-10"></div>
        </div>

        {/* Page content */}
        <main className="py-4 px-4 sm:px-6 lg:px-8 bg-gray-50 min-h-screen">
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
  return (
    <div className={`flex flex-col h-full bg-white ${isMobile ? 'fixed inset-y-0 left-0 w-64 shadow-xl' : 'border-r border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-center h-20 px-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 relative">
    <Link to="/" className="flex items-center">        
        <img 
          src="/LOGO-HOR.svg" 
          alt="LAB Logo" 
          className="h-12 w-auto"
        />
      </Link>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-white/50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      
      {/* Subtitle */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800 text-center">Sistema de Gestão</h2>
        <p className="text-xs text-gray-600 text-center">Compras e Estoque</p>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {navigation.map((item) => renderNavigationItem(item))}
      </nav>
      
      {/* User info and logout */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
            <Shield className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate" title={userProfile?.name || user?.email}>
              {userProfile?.name || user?.email}
            </p>
            <p className="text-xs text-gray-600">{getRoleLabel(userRole)}</p>
            <p className="text-xs text-blue-600">{userProfile?.department}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center w-full px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Layout;