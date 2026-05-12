import React, { useState } from 'react';
import { ChevronRight, FlaskConical, Building2, TrendingUp } from 'lucide-react';
import { useCostControl } from '../hooks/useCostControl';
import ExamsScreen from '../components/CostControl/ExamsScreen';
import PayorsScreen from '../components/CostControl/PayorsScreen';
import AnalyticsScreen from '../components/CostControl/AnalyticsScreen';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type TabKey = 'exams' | 'payors' | 'analytics';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const TABS: Tab[] = [
  { key: 'exams',     label: 'Exames',                    icon: <FlaskConical className="w-4 h-4" /> },
  { key: 'payors',    label: 'Fontes Pagadoras',           icon: <Building2 className="w-4 h-4" /> },
  { key: 'analytics', label: 'Análise de Rentabilidade',   icon: <TrendingUp className="w-4 h-4" /> },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COST CONTROL DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

const CostControlDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('exams');
  const { exams, payors, addExam, updateExam, deleteExam } = useCostControl();

  return (
    <div className="min-h-full">
      {/* Page header + tab bar */}
      <div className="border-b border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md sticky top-0 z-20">
        <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Operações</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700 dark:text-gray-200 font-medium">Controle de Custos</span>
          </div>

          {/* Title + description */}
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-700 dark:from-blue-400 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent leading-tight">
            Controle de Custos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cruze custo de produção com receita por fonte pagadora para identificar rentabilidade.
          </p>

          {/* Tab bar */}
          <nav className="mt-5 flex gap-1 -mb-px overflow-x-auto">
            {TABS.map(tab => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`group relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  <span
                    className={`absolute left-3 right-3 -bottom-px h-0.5 rounded-full transition-all ${
                      active
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                        : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      <main className="px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'exams' && (
          <ExamsScreen
            exams={exams}
            addExam={addExam}
            updateExam={updateExam}
            deleteExam={deleteExam}
          />
        )}
        {activeTab === 'payors' && (
          <PayorsScreen payors={payors} exams={exams} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsScreen exams={exams} payors={payors} />
        )}
      </main>
    </div>
  );
};

export default CostControlDashboard;
