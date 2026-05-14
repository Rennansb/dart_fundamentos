import React, { Suspense, lazy } from 'react';
// Deploy Build: 2026-04-06 (Mega Update Stabilization)
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { WifiOff, Wifi, Crown, Zap, Star } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

// Lazy load all pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const WorkOrders = lazy(() => import('./pages/WorkOrders'));
const Equipment = lazy(() => import('./pages/Equipment'));
const Services = lazy(() => import('./pages/Services'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Conversations = lazy(() => import('./pages/Conversations'));
const PublicTracking = lazy(() => import('./pages/PublicTracking'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Budgets = lazy(() => import('./pages/Budgets'));
const Kanban = lazy(() => import('./pages/Kanban'));
const PublicSignature = lazy(() => import('./pages/PublicSignature'));
const CashFlow = lazy(() => import('./pages/CashFlow'));
const Payables = lazy(() => import('./pages/Payables'));
const Receivables = lazy(() => import('./pages/Receivables'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Employees = lazy(() => import('./pages/Employees'));
const OperationalReports = lazy(() => import('./pages/Reports/Operational'));
const FinancialReports = lazy(() => import('./pages/Reports/Financial'));
const SupplierFinancialReport = lazy(() => import('./pages/Reports/SupplierFinancialReport'));
const Settings = lazy(() => import('./pages/Settings'));
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const PlanSelection = lazy(() => import('./pages/PlanSelection'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const BlockedPage = lazy(() => import('./pages/BlockedPage'));
const SupplierInventory = lazy(() => import('./pages/SupplierInventory'));
const SupplierOrders = lazy(() => import('./pages/SupplierOrders'));
const ShopOrders = lazy(() => import('./pages/ShopOrders'));
const Subscription = lazy(() => import('./pages/Subscription'));
const DeliveryTracking = lazy(() => import('./pages/DeliveryTracking'));
const SupplierCustomers = lazy(() => import('./pages/SupplierCustomers'));
const SupplierBI = lazy(() => import('./pages/SupplierBI'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const SupplierDetails = lazy(() => import('./pages/SupplierDetails'));
const FloatingChat = lazy(() => import('./components/FloatingChat'));
const VehicleHistory = lazy(() => import('./pages/VehicleHistory'));
const MonthlyGoal = lazy(() => import('./pages/MonthlyGoal'));
const ABCAnalysis = lazy(() => import('./pages/Reports/ABCAnalysis'));
const SmartReplenishment = lazy(() => import('./pages/Inventory/SmartReplenishment'));
const AIHealth = lazy(() => import('./pages/Insights/AIHealth'));
const Gamification = lazy(() => import('./pages/Gamification'));
const SupplierPartsHistory = lazy(() => import('./pages/SupplierPartsHistory'));
const NotFound = lazy(() => import('./pages/NotFound'));
import SetupWizard from './components/SetupWizard';

// Protected Route Wrapper with Role-Based Access Control
const ProtectedRoute = ({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode, 
  allowedRoles?: string[] 
}) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  if (!user || !profile) {
    return <Navigate to="/login" />;
  }
  
  if (profile.status === 'blocked') {
    return <Navigate to="/blocked" />;
  }

  // Check for role-based access
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    console.warn(`Access denied for role: ${profile.role}. Required: ${allowedRoles.join(', ')}`);
    return <Navigate to="/app" replace />;
  }

  if (profile.planExpiresAt && profile.role !== 'admin' && profile.role !== 'fornecedor') {
    try {
      const expValue = profile.planExpiresAt;
      let expiresAt: Date | null = null;
      
      if (expValue && typeof expValue === 'object' && 'toDate' in expValue && typeof expValue.toDate === 'function') {
        expiresAt = expValue.toDate();
      } else if (expValue) {
        expiresAt = new Date(expValue);
      }

      if (expiresAt && !isNaN(expiresAt.getTime()) && expiresAt < new Date()) {
        return <Navigate to="/plan-selection" />;
      }
    } catch (e) {
      console.error("ProtectedRoute: Error parsing planExpiresAt:", e);
    }
  }
  
  return <>{children}</>;
};

// Elite Plan Protection Wrapper
const EliteRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <PageLoading />;
  
  // Admin and Supplier bypass all checks
  if (profile?.role === 'admin' || profile?.role === 'fornecedor') return <>{children}</>;

  if (profile?.plan !== 'elite') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-gray-800 rounded-[3rem] shadow-xl border border-indigo-100 dark:border-indigo-900/30">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-6">
          <Crown className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter">Recurso Exclusivo Hub Elite</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
          Esta funcionalidade avançada de inteligência está disponível apenas para assinantes do plano **Elite**. 
          Potencialize sua oficina com IA e automação de ponta.
        </p>
        <button 
          onClick={() => navigate('/app/subscription')}
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"
        >
          <Zap className="w-4 h-4" /> Fazer Upgrade Agora
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

// Pro/Elite Plan Protection Wrapper
const ProEliteRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <PageLoading />;
  if (profile?.role === 'admin' || profile?.role === 'fornecedor') return <>{children}</>;

  if (profile?.plan === 'free' || profile?.plan === 'start' || !profile?.plan) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-gray-800 rounded-[3rem] shadow-xl border border-indigo-100 dark:border-indigo-900/30">
        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
          <Zap className="w-10 h-10 text-indigo-600" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter">Recurso Premium Pro</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
          O Histórico Veicular avançado está disponível a partir do plano **Oficina Pro**. 
          Tenha controle total sobre o passado de cada veículo que passa pela sua oficina.
        </p>
        <button 
          onClick={() => navigate('/app/subscription')}
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"
        >
          <Star className="w-4 h-4" /> Ver Planos e Upgrade
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

// Financial Report Route Selection
const FinancialRoute = () => {
  const { profile, loading } = useAuth();
  if (loading) return <PageLoading />;
  if (profile?.role === 'fornecedor') return <SupplierFinancialReport />;
  return <EliteRoute><FinancialReports /></EliteRoute>;
};

// Loading Fallback
const PageLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-rose-600 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
      <WifiOff className="h-4 w-4 animate-pulse" />
      <span className="text-xs font-black uppercase tracking-widest">Você está offline. Algumas funções podem estar limitadas.</span>
    </div>
  );
};

// Smart Dashboard Selector based on user role
const DashboardSelector = () => {
  const { effectiveProfile, loading, selectedCompanyId, profile } = useAuth();
  
  if (loading) return <PageLoading />;
  
  // Rule: If role is admin AND not impersonating, show AdminDashboard
  if (profile?.role === 'admin' && !selectedCompanyId) {
    return <AdminDashboard />;
  }
  
  // All other cases (Shop, Manager, Employee, Supplier, or Impersonated Supplier) 
  // land on the unified role-aware Dashboard
  return <Dashboard />;
};

// Chat Wrapper to safely access Auth context
const ChatWrapper = () => {
  const { user, profile } = useAuth();
  const isLandingPage = window.location.pathname === '/';
  
  // Rule: Show if user is logged in AND has allowed role
  // OR Show if visitor on Landing Page
  const allowedRoles = ['shop', 'fornecedor', 'supplier', 'admin'];
  const isLoggedAuthorized = user && profile && allowedRoles.includes(profile.role);
  const isVisitorOnLanding = !user && isLandingPage;

  if (!isLoggedAuthorized && !isVisitorOnLanding) return null;
  
  return <FloatingChat />;
};


export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Toaster 
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0a0a0a',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              fontWeight: 'bold',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#0a0a0a' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#0a0a0a' },
            },
          }}
        />
        <AuthProvider>
          <OfflineIndicator />
          <ErrorBoundary variant="mini">
            <ChatWrapper />
            <SetupWizard />
          </ErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/plan-selection" element={<PlanSelection />} />
              <Route path="/track" element={<PublicTracking />} />
              <Route path="/delivery/:orderId" element={<DeliveryTracking />} />
              <Route path="/signature/:osId" element={<PublicSignature />} />
              <Route path="/blocked" element={<BlockedPage />} />
              
              {/* Protected Routes */}
              <Route path="/app" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<DashboardSelector />} />
                
                {/* Admin Only */}
                <Route path="admin" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                
                {/* Shop/Admin Only */}
                <Route path="customers" element={<Customers />} />
                <Route path="equipment" element={<Equipment />} />
                <Route path="work-orders" element={<WorkOrders />} />
                <Route path="kanban" element={<Kanban />} />
                
                {/* Supplier Specific */}
                <Route path="supplier/inventory" element={
                  <ProtectedRoute allowedRoles={['fornecedor', 'admin']}>
                    <SupplierInventory />
                  </ProtectedRoute>
                } />
                <Route path="supplier/orders" element={
                  <ProtectedRoute allowedRoles={['fornecedor', 'admin']}>
                    <SupplierOrders />
                  </ProtectedRoute>
                } />
                <Route path="supplier/customers" element={
                  <ProtectedRoute allowedRoles={['fornecedor', 'admin']}>
                    <SupplierCustomers />
                  </ProtectedRoute>
                } />
                <Route path="supplier/bi" element={
                  <ProtectedRoute allowedRoles={['fornecedor', 'admin']}>
                    <SupplierBI />
                  </ProtectedRoute>
                } />
                <Route path="supplier/parts-history" element={
                  <ProtectedRoute allowedRoles={['fornecedor', 'admin']}>
                    <SupplierPartsHistory />
                  </ProtectedRoute>
                } />
                
                {/* Shared/General */}
                <Route path="conversations" element={<EliteRoute><Conversations /></EliteRoute>} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="budgets" element={<Budgets />} />
                <Route path="orders" element={<ShopOrders />} />
                <Route path="subscription" element={<Subscription />} />
                <Route path="monthly-goal" element={<EliteRoute><MonthlyGoal /></EliteRoute>} />
                <Route path="gamification" element={<EliteRoute><Gamification /></EliteRoute>} />
                <Route path="services" element={<Services />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="finance/payables" element={<Payables />} />
                <Route path="finance/receivables" element={<Receivables />} />
                <Route path="cash-flow" element={<CashFlow />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="employees" element={<Employees />} />
                <Route path="reports/operational" element={<EliteRoute><OperationalReports /></EliteRoute>} />
                <Route path="reports/financial" element={<FinancialRoute />} />
                <Route path="vehicle-history" element={<ProEliteRoute><VehicleHistory /></ProEliteRoute>} />
                <Route path="settings" element={<Settings />} />
                <Route path="suppliers" element={<Suppliers />} />

                <Route path="intelligence/abc" element={<EliteRoute><ABCAnalysis /></EliteRoute>} />
                <Route path="intelligence/replenishment" element={<EliteRoute><SmartReplenishment /></EliteRoute>} />
                <Route path="intelligence/health" element={<EliteRoute><AIHealth /></EliteRoute>} />
                
                <Route path="*" element={<div className="p-8 text-center text-gray-500 dark:text-gray-400">Página não encontrada</div>} />
              </Route>
              
              {/* Fallback 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

