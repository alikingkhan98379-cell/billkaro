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
  Bell
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  mobileOpen,
  setMobileOpen
}) => {
  const { subscription } = useAuth();
  const { unreadCount } = useNotifications();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices History', icon: FileText },
    { id: 'create-invoice', label: 'Create Invoice', icon: PlusCircle, highlight: true },
    { id: 'customers', label: 'Customers Master', icon: Users },
    { id: 'products', label: 'Products Master', icon: Package },
    { id: 'business-profile', label: 'Business Profile & UPI', icon: Building2 },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'premium', label: 'Premium Plan', icon: Sparkles, gold: true },
    { id: 'privacy-terms', label: 'Privacy & Terms', icon: ShieldCheck }
  ];

  const handleNav = (id: string) => {
    setCurrentTab(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 bg-white border-r border-slate-200 transition-transform duration-200 ease-in-out shrink-0 overflow-y-auto flex flex-col justify-between p-4 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <nav className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : item.highlight
                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    : item.gold
                    ? 'text-indigo-700 hover:bg-indigo-50 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : item.gold ? 'text-indigo-600' : ''}`} />
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

        {/* Security & Plan Footer Box */}
        <div className="mt-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>256-bit Secure GST Suite</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Data isolated with Postgres RLS & passwordless OTP security.
          </p>
        </div>
      </aside>
    </>
  );
};
