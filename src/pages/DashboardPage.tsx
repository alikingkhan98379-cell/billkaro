import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  FileText, 
  CheckCircle, 
  Clock, 
  PlusCircle, 
  Users, 
  Package, 
  Building2, 
  Download, 
  Share2, 
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Invoice, Customer } from '../types';
import { formatINR } from '../utils/currency';
import { Badge } from '../components/common/Badge';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { openWhatsAppShare } from '../utils/whatsapp';

interface DashboardPageProps {
  setCurrentTab: (tab: string) => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setCurrentTab }) => {
  const { user, businessProfile, subscription } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customersCount, setCustomersCount] = useState<number>(0);
  const [productsCount, setProductsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold border border-white/15">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Encrypted GST Suite</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {businessProfile?.name || 'Welcome to BillKaro'}
          </h2>
          <p className="text-sm text-blue-100 max-w-xl">
            Create professional GST tax invoices with instant UPI payment QR codes, auto-calculations, and 1-click WhatsApp sharing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setCurrentTab('create-invoice')}
            className="px-5 py-3 bg-white text-blue-700 hover:bg-blue-50 text-sm font-bold rounded-2xl shadow-lg hover:shadow-xl transition active:scale-98 flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Monthly Plan Quota Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                Plan Status: {subscription?.plan === 'premium' ? 'Premium Unlimited' : 'Free Tier'}
              </span>
              <Badge status={subscription?.plan === 'premium' ? 'PREMIUM' : 'FREE'} size="sm" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {subscription?.plan === 'premium'
                ? 'Unlimited invoices, custom logo & signature enabled'
                : `${monthlyInvoicesCount} of 5 free invoices used this month`}
            </p>
          </div>
        </div>

        {subscription?.plan !== 'premium' && (
          <button
            onClick={() => setCurrentTab('premium')}
            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            Upgrade to Pro (?499/yr)
          </button>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-blue-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Total Billed</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatINR(totalBilled)}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <span>{invoices.length} total invoices generated</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-emerald-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Paid / Collected</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            {formatINR(totalPaid)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            {invoices.filter(i => i.status === 'PAID').length} invoices settled
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-rose-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Dues</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            {formatINR(totalPending)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            {invoices.filter(i => i.status === 'UNPAID' || i.status === 'OVERDUE').length} pending payment
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-indigo-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Master Catalog</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {customersCount} <span className="text-sm font-normal text-slate-500">Cust.</span> / {productsCount} <span className="text-sm font-normal text-slate-500">Items</span>
          </div>
          <div className="text-xs text-blue-600 mt-1 font-semibold flex items-center gap-1">
            <button onClick={() => setCurrentTab('customers')} className="hover:underline">Manage Directory</button>
          </div>
        </div>
      </div>

      {/* Quick Setup Checklist if Profile or UPI is missing */}
      {(!businessProfile?.gstin || !businessProfile?.upi_id || !businessProfile?.bank_name) && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <span>? Complete your business setup for professional invoices</span>
              </h4>
              <p className="text-xs text-amber-800">
                Add your GSTIN, UPI ID, and Bank Account so customers can scan the QR code to pay you instantly.
              </p>
            </div>
            <button
              onClick={() => setCurrentTab('business-profile')}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shrink-0"
            >
              Configure Now
            </button>
          </div>
        </div>
      )}

      {/* Recent Invoices Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Invoices</h3>
            <p className="text-xs text-slate-500 mt-0.5">Manage and track your latest billed GST invoices</p>
          </div>
          <button
            onClick={() => setCurrentTab('invoices')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>View All ({invoices.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No invoices yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create your very first GST invoice in less than 30 seconds.
            </p>
            <button
              onClick={() => setCurrentTab('create-invoice')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition"
            >
              Create First Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Invoice #</th>
                  <th className="py-3 px-6">Customer</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Amount</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {invoices.slice(0, 5).map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-6 font-bold text-slate-900 font-mono">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3.5 px-6 font-medium">
                      {inv.customer?.name || 'Cash Customer'}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {inv.invoice_date}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {formatINR(inv.grand_total)}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-2">
                        <Badge status={inv.status} size="sm" />
                        {inv.status !== 'PAID' && (
                          <button
                            onClick={() => handleQuickStatusChange(inv.id, 'PAID')}
                            className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md font-semibold"
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
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                          {downloadingId === inv.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openWhatsAppShare(inv, businessProfile!, inv.customer)}
                          title="Share on WhatsApp"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
