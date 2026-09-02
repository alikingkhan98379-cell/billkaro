import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
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

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-2xl mb-4 animate-bounce">
          ?
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {currentTab === 'dashboard' && <DashboardPage setCurrentTab={setCurrentTab} />}
          {currentTab === 'create-invoice' && <InvoiceCreatePage setCurrentTab={setCurrentTab} />}
          {currentTab === 'invoices' && <InvoiceHistoryPage setCurrentTab={setCurrentTab} />}
          {currentTab === 'customers' && <CustomersPage />}
          {currentTab === 'products' && <ProductsPage />}
          {currentTab === 'business-profile' && <BusinessProfilePage />}
          {currentTab === 'notifications' && <NotificationsPage />}
          {currentTab === 'premium' && <PremiumPage />}
          {currentTab === 'privacy-terms' && <PrivacyTermsPage />}
        </main>
      </div>

      <PWAInstallPrompt />
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
