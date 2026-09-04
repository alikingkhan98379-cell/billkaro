import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  FileText, 
  CheckCircle, 
  Clock, 
  PlusCircle, 
  Users, 
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Download,
  Share2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { formatINR } from '../utils/currency';
import { Badge } from '../components/common/Badge';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { shareInvoicePDF } from '../utils/shareService';

interface DashboardPageProps {
  setCurrentTab: (tab: any) => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setCurrentTab }) => {
  const { user, businessProfile, subscription, isPremium } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customersCount, setCustomersCount] = useState<number>(0);
  const [productsCount, setProductsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch Invoices with customer and items
      const { data: invData } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*),
          items:invoice_items(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (invData) setInvoices(invData);

      // 2. Fetch Customers Count
      const { count: cCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setCustomersCount(cCount || 0);

      // 3. Fetch Products Count
      const { count: pCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setProductsCount(pCount || 0);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  // Calculations
  const totalBilled = invoices.reduce((acc, inv) => acc + (Number(inv.grand_total) || 0), 0);
  const totalPaid = invoices
    .filter(inv => inv.status === 'PAID')
    .reduce((acc, inv) => acc + (Number(inv.grand_total) || 0), 0);
  const totalPending = invoices
    .filter(inv => inv.status === 'UNPAID' || inv.status === 'OVERDUE')
    .reduce((acc, inv) => acc + (Number(inv.grand_total) || 0), 0);

  // Free Tier Monthly Limit Check (5 invoices per calendar month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthInvoices = invoices.filter(inv => {
    const d = new Date(inv.invoice_date || inv.created_at || '');
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const monthlyInvoicesCount = currentMonthInvoices.length;

  const handleDownloadPDF = async (inv: Invoice) => {
    if (!businessProfile) return;
    setDownloadingId(inv.id);
    try {
      const doc = await generateInvoicePDF(inv, businessProfile, inv.customer);
      doc.save(`${inv.invoice_number}_${inv.customer?.name || 'Invoice'}.pdf`);
    } catch (e) {
      console.error('PDF error:', e);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShare = async (inv: Invoice) => {
    if (!businessProfile) return;
    setSharingId(inv.id);
    try {
      await shareInvoicePDF(inv, businessProfile, inv.customer);
    } catch (e) {
      console.error('Share error:', e);
    } finally {
      setSharingId(null);
    }
  };

  const handleQuickStatusChange = async (invId: string, newStatus: 'PAID' | 'UNPAID') => {
    try {
      await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invId);

      setInvoices(prev =>
        prev.map(i => (i.id === invId ? { ...i, status: newStatus } : i))
      );
    } catch (e) {
      console.error('Status update error:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 rounded-3xl p-5 sm:p-8 text-white shadow-xl">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold border border-white/15">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Encrypted GST Suite</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-black tracking-tight">
            {businessProfile?.name || 'Welcome to BillKaro'}
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 max-w-xl">
            Create professional GST tax invoices with instant UPI payment QR codes, auto-calculations, and 1-click WhatsApp sharing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setCurrentTab('create-invoice')}
            className="px-5 py-3 bg-white text-blue-700 hover:bg-blue-50 text-xs sm:text-sm font-bold rounded-2xl shadow-lg hover:shadow-xl transition active:scale-98 flex items-center gap-2 cursor-pointer min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Monthly Plan Quota Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Plan Status: {isPremium ? 'BillKaro Pro (Ads OFF)' : 'Free Starter'}
              </span>
              <Badge status={isPremium ? 'PREMIUM' : 'FREE'} size="sm" />
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isPremium
                ? 'Unlimited invoices, custom logo, signature & zero ads active'
                : `${monthlyInvoicesCount} of 5 free invoices used this month`}
            </p>
          </div>
        </div>

        {!isPremium && (
          <button
            onClick={() => setCurrentTab('premium')}
            className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer min-h-[44px] flex items-center justify-center"
          >
            Upgrade to Pro (From ₹49)
          </button>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">Total Billed</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatINR(totalBilled)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span>{invoices.length} total invoices</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">Paid / Collected</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatINR(totalPaid)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {invoices.filter(i => i.status === 'PAID').length} invoices settled
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-rose-300 dark:hover:border-rose-700 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">Pending Dues</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
            {formatINR(totalPending)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {invoices.filter(i => i.status === 'UNPAID' || i.status === 'OVERDUE').length} pending payment
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">Master Catalog</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {customersCount} <span className="text-xs font-normal text-slate-500">Party</span> / {productsCount} <span className="text-xs font-normal text-slate-500">Items</span>
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-semibold flex items-center gap-1">
            <button onClick={() => setCurrentTab('customers')} className="hover:underline cursor-pointer">Manage Directory</button>
          </div>
        </div>
      </div>

      {/* Quick Setup Checklist if Profile or UPI is missing */}
      {(!businessProfile?.gstin || !businessProfile?.upi_id || !businessProfile?.bank_name) && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <span>⚡ Complete your business profile for automatic QR codes</span>
              </h4>
              <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-300">
                Add your GSTIN, UPI ID, and Bank Account so customers can scan and pay you directly.
              </p>
            </div>
            <button
              onClick={() => setCurrentTab('business-profile')}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shrink-0 cursor-pointer min-h-[40px]"
            >
              Configure Now
            </button>
          </div>
        </div>
      )}

      {/* Recent Invoices Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Recent Invoices</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your latest billed GST invoices</p>
          </div>
          <button
            onClick={() => setCurrentTab('invoices')}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1 cursor-pointer min-h-[40px]"
          >
            <span>View All ({invoices.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No invoices yet</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Create your very first GST invoice in less than 30 seconds.
              </p>
            </div>
            <button
              onClick={() => setCurrentTab('create-invoice')}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition cursor-pointer"
            >
              + Create First Invoice
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-6">Invoice #</th>
                    <th className="py-3 px-6">Customer</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6">Amount</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-200">
                  {invoices.slice(0, 5).map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-6 font-bold text-slate-900 dark:text-white font-mono">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-6 font-medium text-slate-900 dark:text-white">
                        {inv.customer?.name || 'Cash Customer'}
                      </td>
                      <td className="py-3.5 px-6 text-slate-500 dark:text-slate-400">
                        {inv.invoice_date}
                      </td>
                      <td className="py-3.5 px-6 font-bold text-slate-900 dark:text-white">
                        {formatINR(inv.grand_total)}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-2">
                          <Badge status={inv.status} size="sm" />
                          {inv.status !== 'PAID' && (
                            <button
                              onClick={() => handleQuickStatusChange(inv.id, 'PAID')}
                              className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2 py-0.5 rounded-md font-semibold cursor-pointer"
                            >
                              Mark Paid
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={downloadingId === inv.id}
                            onClick={() => handleDownloadPDF(inv)}
                            title="Download PDF"
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                          >
                            {downloadingId === inv.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            disabled={sharingId === inv.id}
                            onClick={() => handleShare(inv)}
                            title="Share Actual PDF"
                            className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                          >
                            {sharingId === inv.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.slice(0, 5).map(inv => (
                <div key={inv.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                        {inv.invoice_number}
                      </span>
                      <p className="text-[10px] text-slate-400">{inv.customer?.name || 'Cash Customer'}</p>
                    </div>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {formatINR(inv.grand_total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Badge status={inv.status} size="sm" />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPDF(inv)}
                        className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleShare(inv)}
                        className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
