import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { MobileBottomBar } from './components/common/MobileBottomBar';
import { NetworkIndicator } from './components/common/NetworkIndicator';
import { PWAInstallPrompt } from './components/common/PWAInstallPrompt';

import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoiceCreatePage } from './pages/InvoiceCreatePage';
import { InvoiceHistoryPage } from './pages/InvoiceHistoryPage';
import { CustomersPage } from './pages/CustomersPage';
import { ProductsPage } from './pages/ProductsPage';
import { BusinessProfilePage } from './pages/BusinessProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PremiumPage } from './pages/PremiumPage';
import { PrivacyTermsPage } from './pages/PrivacyTermsPage';
import { AdminPaymentsPage } from './pages/AdminPaymentsPage';
import { HelpSupportPage } from './pages/HelpSupportPage';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { currentRoute, navigate, intendedRoute, setIntendedRoute } = useRouter();
  const { unreadCount } = useNotifications();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Restore intended route after user logs in
  useEffect(() => {
    if (user && intendedRoute) {
      navigate(intendedRoute, true);
      setIntendedRoute(null);
    }
  }, [user, intendedRoute, navigate, setIntendedRoute]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-2xl mb-4 animate-bounce">
          ₹
        </div>
        <h2 className="text-xl font-black tracking-tight">BillKaro</h2>
        <p className="text-xs text-slate-400 mt-1 animate-pulse">Initializing Secure GST Suite...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <Navbar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto flex pb-20 lg:pb-6">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
        />

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {currentRoute === 'dashboard' && <DashboardPage setCurrentTab={navigate} />}
          {currentRoute === 'create-invoice' && <InvoiceCreatePage setCurrentTab={navigate} />}
          {currentRoute === 'invoices' && <InvoiceHistoryPage setCurrentTab={navigate} />}
          {currentRoute === 'customers' && <CustomersPage />}
          {currentRoute === 'products' && <ProductsPage />}
          {currentRoute === 'business-profile' && <BusinessProfilePage />}
          {currentRoute === 'notifications' && <NotificationsPage />}
          {currentRoute === 'premium' && <PremiumPage />}
          {currentRoute === 'privacy-terms' && <PrivacyTermsPage />}
          {currentRoute === 'admin-payments' && <AdminPaymentsPage />}
          {currentRoute === 'help-support' && <HelpSupportPage />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomBar
        onOpenMore={() => setMobileMenuOpen(true)}
        unreadNotifications={unreadCount}
      />

      <NetworkIndicator />
      <PWAInstallPrompt />
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <CompanyProvider>
            <NotificationProvider>
              <RouterProvider>
                <AppContent />
              </RouterProvider>
            </NotificationProvider>
          </CompanyProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
