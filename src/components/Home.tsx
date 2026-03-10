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

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 px-4 sm:px-6 pt-16 sm:pt-20 pb-16 sm:pb-24 transition-colors duration-300">
      <div className="w-full max-w-5xl flex flex-col items-center">
        <div className="text-center mb-8 sm:mb-12 animate-fade-in-down">
          <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-gray-800 via-blue-800 to-indigo-800 dark:from-gray-100 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent">
            Bem-vindo(a), {userProfile?.name}!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 sm:mt-3 text-base sm:text-lg">
            Escolha abaixo a área que deseja acessar
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 w-full">
          {accessiblePages.map((p, index) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.path}
                to={p.path}
                className="group p-6 sm:p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-md hover:shadow-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 flex flex-col items-center justify-center text-center hover-lift animate-fade-in-up w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-xs"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 flex items-center justify-center mb-3 sm:mb-4 group-hover:from-blue-100 group-hover:to-indigo-200 dark:group-hover:from-blue-800/50 dark:group-hover:to-indigo-800/50 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {p.label}
                </h3>
                <div className="mt-2 w-0 h-0.5 bg-blue-500 group-hover:w-12 transition-all duration-300 rounded-full"></div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Home;