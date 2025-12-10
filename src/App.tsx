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
import QuotationManagement from './components/QuotationManagement';
import RequestPeriodConfig from './components/RequestPeriodConfig';
import ResetPassword from './components/ResetPassword';
import Home from './components/Home';
import PaymentRequestManagement from './components/PaymentRequestManagement';

// Protected Route Component
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  permission?: string;
  userRole: string;
}> = ({ children, permission, userRole }) => {
  if (permission && !hasPermission(userRole as any, permission as any)) {
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

  const userRole = userProfile?.role || 'requester';

  return (
    <Layout>
      <Routes>
        {/* Página inicial */}
        <Route path="/" element={<Home />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute permission="canViewDashboard" userRole={userRole}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute permission="canViewProducts" userRole={userRole}>
              <ProductList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-product"
          element={
            <ProtectedRoute permission="canAddProducts" userRole={userRole}>
              <AddProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/movements"
          element={
            <ProtectedRoute permission="canViewMovements" userRole={userRole}>
              <MovementHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <ProtectedRoute permission="canViewRequests" userRole={userRole}>
              <RequestManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expiration"
          element={
            <ProtectedRoute permission="canViewExpiration" userRole={userRole}>
              <ExpirationMonitor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/changelog"
          element={
            <ProtectedRoute permission="canViewChangelog" userRole={userRole}>
              <ProductChangeLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute permission="canManageUsers" userRole={userRole}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute permission="canManageSuppliers" userRole={userRole}>
              <SupplierManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quotations"
          element={
            <ProtectedRoute permission="canManageQuotations" userRole={userRole}>
              <QuotationManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request-periods"
          element={
            <ProtectedRoute permission="canConfigureRequestPeriods" userRole={userRole}>
              <RequestPeriodConfig />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment-requests"
          element={
            <ProtectedRoute permission="canViewRequests" userRole={userRole}>
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
        
        {/* Todas as outras rotas passam pelo componente de autenticação */}
        <Route path="/*" element={<AuthenticatedApp />} />
      </Routes>
    </Router>
  );
}

export default App;
