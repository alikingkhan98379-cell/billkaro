import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  Users, 
  Package, 
  Building2, 
  Sparkles, 
  ShieldCheck,
  Bell,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { AppRoute, useRouter } from '../../context/RouterContext';
import { CompanySwitcher } from './CompanySwitcher';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen,
  setMobileOpen
}) => {
  const { isPremium, isAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const { currentRoute, navigate } = useRouter();

  const navItems: Array<{
    id: AppRoute;
    label: string;
    icon: React.FC<{ className?: string }>;
    highlight?: boolean;
    gold?: boolean;
    admin?: boolean;
    badge?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices History', icon: FileText },
    { id: 'create-invoice', label: 'Create Invoice', icon: PlusCircle, highlight: true },
    { id: 'customers', label: 'Customers Master', icon: Users },
    { id: 'products', label: 'Products Master', icon: Package },
    { id: 'business-profile', label: 'Business Profile & UPI', icon: Building2 },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'premium', label: isPremium ? 'Pro Active (Ads OFF)' : 'Upgrade to Pro', icon: Sparkles, gold: true },
    ...(isAdmin ? [{ id: 'admin-payments' as AppRoute, label: 'Admin Payments', icon: ShieldCheck, admin: true }] : []),
    { id: 'privacy-terms', label: 'Privacy & Terms', icon: ShieldCheck }
  ];

  const handleNav = (id: AppRoute) => {
    navigate(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs lg:hidden animate-in fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200 ease-in-out shrink-0 overflow-y-auto flex flex-col justify-between p-4 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-4">
          {/* Mobile Header with close button */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 lg:hidden">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Navigation Menu</span>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Company Switcher for Mobile Drawer */}
          <div className="lg:hidden pb-1">
            <CompanySwitcher className="w-full" />
          </div>

          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = currentRoute === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition min-h-[44px] cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : item.highlight
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                      : item.gold
                      ? 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : item.gold ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        active ? 'bg-white text-blue-600' : 'bg-rose-500 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Security & Plan Footer Box */}
        <div className="mt-6 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>256-bit Secure GST Suite</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Data isolated with Postgres RLS & passwordless OTP security.
          </p>
        </div>
      </aside>
    </>
  );
};
