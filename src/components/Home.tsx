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

  // Se só tiver 1 página, centraliza. Caso contrário, usa a grid normal.
  const gridClasses =
    accessiblePages.length === 1
      ? 'grid grid-cols-1 place-items-center gap-6 max-w-5xl w-full'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full';

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-6 pt-20 pb-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-800">
          Bem-vindo(a) {userProfile?.name} 👋
        </h1>
        <p className="text-gray-600 mt-2">
          Escolha abaixo a área que deseja acessar
        </p>
      </div>

      <div className={gridClasses}>
        {accessiblePages.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.path}
              to={p.path}
              className="group p-8 bg-white rounded-2xl shadow-md hover:shadow-xl border border-gray-200 hover:border-blue-500 transition-all duration-200 flex flex-col items-center justify-center text-center min-w-[200px]"
            >
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <Icon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 group-hover:text-blue-600">
                {p.label}
              </h3>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Home;
