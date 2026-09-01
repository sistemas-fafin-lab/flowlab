// Módulo Qualidade — exports (Ocorrências, Cortesias, IHQ, Registro de Câncer).
// Portado de flowlab-qualidade. Acesso gated por canViewQualidade/canManageQualidade
// via <ProtectedRoute> em App.tsx, como os demais módulos (não por department —
// ver histórico do /add-module para o porte original baseado em department).

export { QualidadeProviders } from './providers/QualidadeProviders';

export { QualidadeDashboardPage } from './components/DashboardPage';

export { Ocorrencias as OcorrenciasPage } from './components/OcorrenciasPage';

export { Cortesias as CortesiasPage } from './components/CortesiasPage';
export { CortesiasCotas as CortesiasCotasPage } from './components/CortesiasCotasPage';

export { Ihq as IhqPage } from './components/IhqPage';

export { Cancer as CancerPage } from './components/CancerPage';

export { RiscosDashboard as RiscosDashboardPage } from './components/RiscosDashboardPage';
export { Riscos as RiscosMatrizPage } from './components/RiscosPage';
export { MapaRiscosPorSetor as MapaRiscosPorSetorPage } from './components/MapaRiscosPorSetorPage';
export { Contingencias as ContingenciasPage } from './components/ContingenciasPage';
