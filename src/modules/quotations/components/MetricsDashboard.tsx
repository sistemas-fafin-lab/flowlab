import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ShoppingCart,
  TrendingDown,
  Users,
  DollarSign,
  Timer,
} from 'lucide-react';
import { QuotationMetrics } from '../types';

interface MetricsDashboardProps {
  metrics: QuotationMetrics;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: value >= 1000000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000000 ? 1 : 2,
  }).format(value);
};

const formatHours = (hours: number) => {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  bgColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  subValue,
  color,
  bgColor,
}) => (
  <div className={`${bgColor} rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-100`}>
    <div className="flex items-start justify-between">
      <div className={`p-2 rounded-lg ${color}`}>
        {icon}
      </div>
    </div>
    <div className="mt-3">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      {subValue && (
        <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>
      )}
    </div>
  </div>
);

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ metrics }) => {
  return (
    <div className="space-y-4">
      {/* Primary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          icon={<FileText className="w-5 h-5 text-blue-600" />}
          label="Cotações Ativas"
          value={metrics.totalActive}
          subValue={`${metrics.totalDraft} em rascunho`}
          color="bg-blue-100"
          bgColor="bg-white"
        />
        
        <MetricCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          label="Aguardando Aprovação"
          value={metrics.totalAwaitingApproval}
          color="bg-amber-100"
          bgColor="bg-white"
        />
        
        <MetricCard
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          label="Aprovadas"
          value={metrics.totalApproved}
          subValue={`${metrics.totalConverted} convertidas`}
          color="bg-green-100"
          bgColor="bg-white"
        />
        
        <MetricCard
          icon={<DollarSign className="w-5 h-5 text-indigo-600" />}
          label="Valor em Análise"
          value={formatCurrency(metrics.totalValueUnderAnalysis)}
          color="bg-indigo-100"
          bgColor="bg-white"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          icon={<Timer className="w-5 h-5 text-purple-600" />}
          label="Tempo Médio Resposta"
          value={formatHours(metrics.averageResponseTime)}
          color="bg-purple-100"
          bgColor="bg-gray-50"
        />
        
        <MetricCard
          icon={<TrendingDown className="w-5 h-5 text-emerald-600" />}
          label="Economia Média"
          value={`${metrics.averageSavingsPercentage}%`}
          subValue="vs maior proposta"
          color="bg-emerald-100"
          bgColor="bg-gray-50"
        />
        
        <MetricCard
          icon={<Users className="w-5 h-5 text-cyan-600" />}
          label="Propostas Recebidas"
          value={metrics.proposalsReceived}
          subValue={`${metrics.suppliersInvited} fornecedores`}
          color="bg-cyan-100"
          bgColor="bg-gray-50"
        />
        
        <MetricCard
          icon={<XCircle className="w-5 h-5 text-red-600" />}
          label="Rejeitadas"
          value={metrics.totalRejected}
          color="bg-red-100"
          bgColor="bg-gray-50"
        />
      </div>
    </div>
  );
};

export default MetricsDashboard;
