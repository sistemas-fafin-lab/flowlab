import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { hasPermission } from './utils/permissions';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import AddProduct from './components/AddProduct';
import MovementHistory from './components/MovementHistory';
import RequestManagement from './components/RequestManagement';
import ExpirationMonitor from './components/ExpirationMonitor';
import ProductChangeLog from './components/ProductChangeLog';
import UserManagement from './components/UserManagement';
import SupplierManagement from './components/SupplierManagement';
import { QuotationManagementPage } from './modules/quotations';
import RequestPeriodConfig from './components/RequestPeriodConfig';
import ResetPassword from './components/ResetPassword';
import Home from './components/Home';
import { MessagingProviderSettings } from './modules/messaging';
import PaymentRequestManagement from './components/PaymentRequestManagement';
import RequestHub from './components/RequestHub';
import { MaintenanceRequestManagement } from './components/MaintenanceRequest';
import { FaturasDashboard, RecebimentosList, GlosasRecursos } from './modules/faturamento';
import ITHubDashboard from './components/IT/ITHubDashboard';
import ITRequestManagement from './components/IT/ITRequestManagement';
import ITKanbanBoard from './components/IT/ITKanbanBoard';
import TestKanban from './components/IT/TestKanban';

// Protected Route Component
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  permission?: string;
  permissions: string[];
}> = ({ children, permission, permissions }) => {
  if (permission && !hasPermission(permissions, permission)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h3 className="text-lg font-medium text-red-800 mb-2">Acesso Negado</h3>
        <p className="text-red-600">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }
  return <>{children}</>;
};

// Componente interno que gerencia as rotas autenticadas
const AuthenticatedApp: React.FC = () => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const userPermissions = userProfile?.permissions || [];

  return (
    <Layout>
      <Routes>
        {/* Página inicial */}
        <Route path="/" element={<Home />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute permission="canViewDashboard" permissions={userPermissions}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute permission="canViewProducts" permissions={userPermissions}>
              <ProductList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-product"
          element={
            <ProtectedRoute permission="canAddProducts" permissions={userPermissions}>
              <AddProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/movements"
          element={
            <ProtectedRoute permission="canViewMovements" permissions={userPermissions}>
              <MovementHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <ProtectedRoute permission="canViewRequests" permissions={userPermissions}>
              <RequestHub />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/purchases"
          element={
            <ProtectedRoute permission="canViewRequests" permissions={userPermissions}>
              <RequestManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/payments"
          element={
            <ProtectedRoute permission="canViewRequests" permissions={userPermissions}>
              <PaymentRequestManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/maintenance"
          element={
            <ProtectedRoute permission="canViewRequests" permissions={userPermissions}>
              <MaintenanceRequestManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expiration"
          element={
            <ProtectedRoute permission="canViewExpiration" permissions={userPermissions}>
              <ExpirationMonitor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/changelog"
          element={
            <ProtectedRoute permission="canViewChangelog" permissions={userPermissions}>
              <ProductChangeLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute permission="canManageUsers" permissions={userPermissions}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute permission="canManageSuppliers" permissions={userPermissions}>
              <SupplierManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quotations"
          element={
            <ProtectedRoute permission="canManageQuotations" permissions={userPermissions}>
              <QuotationManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request-periods"
          element={
            <ProtectedRoute permission="canConfigureRequestPeriods" permissions={userPermissions}>
              <RequestPeriodConfig />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messaging-settings"
          element={
            <ProtectedRoute permission="canManageUsers" permissions={userPermissions}>
              <MessagingProviderSettings />
            </ProtectedRoute>
          }
        />
        {/* Faturamento Routes */}
        <Route
          path="/faturamento/faturas"
          element={
            <ProtectedRoute permission="canViewBilling" permissions={userPermissions}>
              <FaturasDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faturamento/recebimentos"
          element={
            <ProtectedRoute permission="canViewBilling" permissions={userPermissions}>
              <RecebimentosList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faturamento/glosas"
          element={
            <ProtectedRoute permission="canViewBilling" permissions={userPermissions}>
              <GlosasRecursos />
            </ProtectedRoute>
          }
        />
        {/* IT Module Routes */}
        <Route
          path="/it/dashboard"
          element={
            <ProtectedRoute permission="canManageIT" permissions={userPermissions}>
              <ITHubDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/it"
          element={
            <ProtectedRoute permission="canViewRequests" permissions={userPermissions}>
              <ITRequestManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/it/kanban"
          element={
            <ProtectedRoute permission="canManageIT" permissions={userPermissions}>
              <ITKanbanBoard />
            </ProtectedRoute>
          }
        />
        {/* Legacy route - redirects to new hub */}
        <Route
          path="/payment-requests"
          element={
            <ProtectedRoute permission="canViewRequests" permissions={userPermissions}>
              <PaymentRequestManagement />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Layout>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Rota pública para redefinição de senha - deve ficar FORA da verificação de autenticação */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Rota de teste - sem Layout */}
        <Route path="/test-kanban" element={<TestKanban />} />
        
        {/* Todas as outras rotas passam pelo componente de autenticação */}
        <Route path="/*" element={<AuthenticatedApp />} />
      </Routes>
    </Router>
  );
}

export default App;
