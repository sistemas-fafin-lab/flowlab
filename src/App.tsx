import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { hasPermission } from './utils/permissions';
import { NotificationProvider } from './hooks/useNotification';
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
import InputDialog from './components/InputDialog';
import Home from './components/Home';

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

function App() {
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
    <Router>
      <Routes>
        {/* Rota pública para redefinição de senha */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Rota pública de login */}
        {!user && <Route path="*" element={<Auth />} />}

        {/* Rotas protegidas dentro do layout */}
        {user && (
          <Route
            path="*"
            element={
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
                </Routes>
              </Layout>
            }
          />
        )}
      </Routes>
    </Router>
  );
}

export default App;
