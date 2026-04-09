import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  DollarSign,
  Wrench,
  ArrowRight,
  Package,
  CreditCard,
  Settings
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../utils/permissions';

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color: string;
  gradient: string;
  iconBg: string;
  permission?: string;
}

const RequestHub: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const userRole = userProfile?.role || 'requester';
  const userPermissions = userProfile?.permissions || [];

  const modules: ModuleCard[] = [
    {
      id: 'purchases',
      title: 'Compras / Material',
      description: 'Solicitações de compra (SC) e solicitações de material (SM) do estoque',
      icon: Package,
      path: '/requests/purchases',
      color: 'text-blue-600',
      gradient: 'from-blue-500 to-indigo-500',
      iconBg: 'bg-blue-100',
      permission: 'canViewRequests'
    },
    {
      id: 'payments',
      title: 'Pagamentos',
      description: 'Solicitações de pagamento, reembolso e adiantamento',
      icon: DollarSign,
      path: '/requests/payments',
      color: 'text-emerald-600',
      gradient: 'from-emerald-500 to-teal-500',
      iconBg: 'bg-emerald-100',
      permission: 'canViewRequests'
    },
    {
      id: 'maintenance',
      title: 'Manutenção',
      description: 'Solicitações de manutenção predial e de equipamentos',
      icon: Wrench,
      path: '/requests/maintenance',
      color: 'text-orange-600',
      gradient: 'from-orange-500 to-amber-500',
      iconBg: 'bg-orange-100',
      permission: 'canViewRequests'
    }
  ];

  // Filter modules based on permissions
  const accessibleModules = modules.filter(
    module => !module.permission || hasPermission(userPermissions, module.permission)
  );

  return (
    <div className="min-h-[calc(100vh-180px)] flex flex-col justify-center space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up text-center">
        <div className="flex items-center justify-center gap-4 mb-2">
          <div className="w-14 h-14 bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800 rounded-2xl flex items-center justify-center shadow-lg shadow-gray-900/20">
            <FileText className="w-7 h-7 text-white" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mt-4">
          Central de Solicitações
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Selecione o tipo de solicitação que deseja acessar</p>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto w-full px-4">
        {accessibleModules.map((module, index) => {
          const Icon = module.icon;
          
          return (
            <div
              key={module.id}
              onClick={() => navigate(module.path)}
              className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-xl hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Gradient Header */}
              <div className={`h-2 bg-gradient-to-r ${module.gradient}`} />
              
              <div className="p-6">
                {/* Icon */}
                <div className={`w-14 h-14 ${module.iconBg} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-7 h-7 ${module.color}`} />
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  {module.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                  {module.description}
                </p>

                {/* Action */}
                <div className={`flex items-center gap-2 ${module.color} text-sm font-medium group-hover:gap-3 transition-all duration-300`}>
                  <span>Acessar módulo</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 animate-fade-in-up max-w-5xl mx-auto w-full" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Sobre os módulos</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cada módulo possui seu próprio fluxo de aprovação e histórico independente. 
              Selecione o módulo correspondente ao tipo de solicitação que deseja criar ou gerenciar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestHub;
