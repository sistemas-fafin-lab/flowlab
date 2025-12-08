// src/components/Home.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../utils/permissions';
import {
  LayoutDashboard,
  Package,
  PlusSquare,
  History,
  FileText,
  AlertCircle,
  RefreshCw,
  Users,
  Building2,
  DollarSign,
  Calendar,
  Wallet,
} from 'lucide-react';

const Home: React.FC = () => {
  const { userProfile } = useAuth();
  const role = userProfile?.role || 'requester';
  
  const pages = [
    { path: '/dashboard', label: 'Dashboard', permission: 'canViewDashboard', icon: LayoutDashboard },
    { path: '/products', label: 'Produtos', permission: 'canViewProducts', icon: Package },
    { path: '/add-product', label: 'Adicionar Produto', permission: 'canAddProducts', icon: PlusSquare },
    { path: '/movements', label: 'Movimentações', permission: 'canViewMovements', icon: History },
    { path: '/requests', label: 'Solicitações', permission: 'canViewRequests', icon: FileText },
    { path: '/payment-requests', label: 'Solicitações de Pagamento', permission: 'canViewRequests', icon: Wallet },
    { path: '/expiration', label: 'Validade', permission: 'canViewExpiration', icon: AlertCircle },
    { path: '/changelog', label: 'Alterações', permission: 'canViewChangelog', icon: RefreshCw },
    { path: '/users', label: 'Usuários', permission: 'canManageUsers', icon: Users },
    { path: '/suppliers', label: 'Fornecedores', permission: 'canManageSuppliers', icon: Building2 },
    { path: '/quotations', label: 'Cotações', permission: 'canManageQuotations', icon: DollarSign },
    { path: '/request-periods', label: 'Períodos de Solicitação', permission: 'canConfigureRequestPeriods', icon: Calendar },
  ];

  // Filtra apenas as páginas acessíveis para o usuário
  const accessiblePages = pages.filter((p) =>
    hasPermission(role as any, p.permission as any)
  );

  // Se só tiver 1 página, centraliza. Caso contrário, usa a grid normal.
  const gridClasses =
    accessiblePages.length === 1
      ? 'grid grid-cols-1 place-items-center gap-6 max-w-5xl w-full'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full';

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 sm:px-6 pt-16 sm:pt-20 pb-16 sm:pb-24">
      <div className="text-center mb-8 sm:mb-12 animate-fade-in-down">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-gray-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
          Bem-vindo(a), {userProfile?.name}!
        </h1>
        <p className="text-gray-500 mt-2 sm:mt-3 text-base sm:text-lg">
          Escolha abaixo a área que deseja acessar
        </p>
      </div>

      <div className={gridClasses}>
        {accessiblePages.map((p, index) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.path}
              to={p.path}
              className={`group p-6 sm:p-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-md hover:shadow-2xl border border-gray-100 hover:border-blue-400 transition-all duration-300 flex flex-col items-center justify-center text-center min-w-0 w-full hover-lift animate-fade-in-up stagger-${Math.min(index + 1, 5)}`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center mb-3 sm:mb-4 group-hover:from-blue-100 group-hover:to-indigo-200 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 group-hover:text-blue-700 transition-colors" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">
                {p.label}
              </h3>
              <div className="mt-2 w-0 h-0.5 bg-blue-500 group-hover:w-12 transition-all duration-300 rounded-full"></div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Home;
