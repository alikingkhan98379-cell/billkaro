import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Plus, 
  Users, 
  Package, 
  Menu
} from 'lucide-react';
import { AppRoute, useRouter } from '../../context/RouterContext';

interface MobileBottomBarProps {
  onOpenMore: () => void;
  unreadNotifications?: number;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  onOpenMore,
  unreadNotifications = 0
}) => {
  const { currentRoute, navigate } = useRouter();

  const navItems: Array<{ id: AppRoute; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'products', label: 'Products', icon: Package }
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom,0px)] shadow-lg transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 h-16 relative">
        {/* 1. Dashboard */}
        <button
          onClick={() => navigate('dashboard')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 transition cursor-pointer ${
            currentRoute === 'dashboard'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 ${currentRoute === 'dashboard' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5">Home</span>
        </button>

        {/* 2. Invoices */}
        <button
          onClick={() => navigate('invoices')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 transition cursor-pointer ${
            currentRoute === 'invoices'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <FileText className={`w-5 h-5 ${currentRoute === 'invoices' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5">Invoices</span>
        </button>

        {/* 3. CENTER FLOATING ACTION BUTTON: Create Invoice */}
        <div className="relative -top-3">
          <button
            onClick={() => navigate('create-invoice')}
            className={`w-13 h-13 rounded-full flex items-center justify-center text-white shadow-xl transition transform active:scale-95 cursor-pointer ${
              currentRoute === 'create-invoice'
                ? 'bg-blue-700 ring-4 ring-blue-400/30'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
            }`}
            title="Create Invoice"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* 4. Customers */}
        <button
          onClick={() => navigate('customers')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 transition cursor-pointer ${
            currentRoute === 'customers'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Users className={`w-5 h-5 ${currentRoute === 'customers' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5">Party</span>
        </button>

        {/* 5. More Menu */}
        <button
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition cursor-pointer relative"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">More</span>
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>
      </div>
    </div>
  );
};
