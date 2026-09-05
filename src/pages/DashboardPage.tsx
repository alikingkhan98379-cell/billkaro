import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  FileText, 
  CheckCircle, 
  Clock, 
  PlusCircle, 
  Users, 
  Package, 
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Download,
  Share2,
  Building2,
  AlertCircle,
  ChevronRight,
  Percent,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { formatINR } from '../utils/currency';
import { Badge } from '../components/common/Badge';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { shareInvoicePDF } from '../utils/shareService';
import { CompanySwitcher } from '../components/common/CompanySwitcher';

interface DashboardPageProps {
  setCurrentTab: (tab: any) => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setCurrentTab }) => {
  const { user, businessProfile, isPremium, planId } = useAuth();
  const { activeCompany, companies, currentCount, maxCompanies } = useCompany();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customersCount, setCustomersCount] = useState<number>(0);
  const [productsCount, setProductsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [dismissedOnboarding, setDismissedOnboarding] = useState<boolean>(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

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
    .filter(inv => inv.status === 'UNPAID' || inv.status === 'OVERDUE' || inv.status === 'PARTIAL')
    .reduce((acc, inv) => acc + (Number(inv.grand_total) || 0), 0);
  const totalGst = invoices.reduce(
    (acc, inv) => acc + (Number(inv.cgst || 0) + Number(inv.sgst || 0) + Number(inv.igst || 0)), 
    0
  );

  // Free Tier Monthly Limit Check (5 invoices per calendar month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthInvoices = invoices.filter(inv => {
    const d = new Date(inv.invoice_date || inv.created_at || '');
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const monthlyInvoicesCount = currentMonthInvoices.length;

  // Profile Completion Score Calculation
  const currentProfile = activeCompany || businessProfile;
  const isProfileConfigured = Boolean(
    currentProfile && 
    currentProfile.name && 
    currentProfile.name !== 'My Business' && 
    (currentProfile.phone || currentProfile.gstin || currentProfile.address)
  );

  const calculateCompletionPercentage = () => {
    if (!currentProfile) return 0;
    let score = 0;
    if (currentProfile.name && currentProfile.name !== 'My Business') score += 25;
    if (currentProfile.phone) score += 15;
    if (currentProfile.email) score += 15;
    if (currentProfile.gstin) score += 20;
    if (currentProfile.address) score += 15;
    if (currentProfile.bank_name || currentProfile.upi_id) score += 10;
    return score;
  };

  const completionPercentage = calculateCompletionPercentage();

  const handleDownloadPDF = async (inv: Invoice) => {
    if (!businessProfile) return;
    setDownloadingId(inv.id);
    setShareNotice(null);
    try {
      const doc = await generateInvoicePDF(inv, businessProfile, inv.customer);
      const safeCustomer = (inv.customer?.name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeNumber = (inv.invoice_number || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`BillKaro_${safeNumber}_${safeCustomer}.pdf`);
      setShareNotice('Invoice PDF downloaded successfully.');
      setTimeout(() => setShareNotice(null), 4000);
    } catch (e) {
      console.error('PDF error:', e);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShare = async (inv: Invoice) => {
    if (!businessProfile) return;
    setSharingId(inv.id);
    setShareNotice(null);
    try {
      const res = await shareInvoicePDF(inv, businessProfile, inv.customer);
      setShareNotice(res.message);
      setTimeout(() => setShareNotice(null), 5000);
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
      {/* Toast Notice */}
      {shareNotice && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-semibold">{shareNotice}</span>
          </div>
          <button onClick={() => setShareNotice(null)} className="text-blue-400 hover:text-blue-600 text-sm">✕</button>
        </div>
      )}

      {/* 1. TOP HERO SECTION: ONBOARDING CARD OR COMMERCIAL IDENTITY */}
      {!isProfileConfigured && !dismissedOnboarding ? (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/10">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold tracking-wide uppercase text-blue-200 border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Step 1 of 2 • Business Setup</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
              Set up your business profile
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              Add your business name, GSTIN, address, and contact details to create professional GST invoices with instant UPI payment QR codes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setCurrentTab('business-profile')}
              className="px-6 py-3 bg-white hover:bg-blue-50 text-blue-700 text-xs sm:text-sm font-bold rounded-2xl shadow-lg hover:shadow-xl transition active:scale-98 flex items-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Building2 className="w-4 h-4" />
              <span>Add Business Profile</span>
            </button>
            <button
              onClick={() => setDismissedOnboarding(true)}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-2xl transition cursor-pointer min-h-[44px]"
            >
              Do this later
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4 transition-colors">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
              {currentProfile?.logo_url ? (
                <img src={currentProfile.logo_url} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <span>{currentProfile?.name ? currentProfile.name.charAt(0).toUpperCase() : 'B'}</span>
              )}
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate max-w-full">
                  {currentProfile?.name || 'My Business'}
                </h2>
                {currentProfile?.gstin ? (
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono text-[10px] font-bold">
                    GST: {currentProfile.gstin}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono text-[10px] font-medium">
                    Unregistered GST
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {currentProfile?.phone && (
                  <span>{currentProfile.phone}</span>
                )}
                {currentProfile?.phone && currentProfile?.address && <span>•</span>}
                <span>{currentProfile?.address ? currentProfile.address.split(',')[0] : 'State: Delhi'}</span>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Profile {completionPercentage}% complete
                </span>
              </div>
            </div>
          </div>

          {/* Action Row - Seamless mobile layout with no overflow */}
          <div className="flex items-center gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 justify-between">
            <div className="flex-1 md:flex-initial min-w-0">
              <CompanySwitcher className="w-full" />
            </div>
            <button
              onClick={() => setCurrentTab('business-profile')}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer min-h-[38px] shrink-0"
              title="Edit Business Profile & UPI Settings"
            >
              <span>Profile</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. QUICK ACTIONS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setCurrentTab('create-invoice')}
          className="p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition flex flex-col items-start gap-2 cursor-pointer active:scale-98 min-h-[88px]"
        >
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <PlusCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-black tracking-tight">Create Invoice</div>
            <div className="text-[10px] text-blue-100">GST billing with UPI QR</div>
          </div>
        </button>

        <button
          onClick={() => setCurrentTab('customers')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 transition flex flex-col items-start gap-2 cursor-pointer min-h-[88px]"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Customers ({customersCount})</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Manage client directory</div>
          </div>
        </button>

        <button
          onClick={() => setCurrentTab('products')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 transition flex flex-col items-start gap-2 cursor-pointer min-h-[88px]"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Products ({productsCount})</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Item catalog & rates</div>
          </div>
        </button>

        <button
          onClick={() => setCurrentTab('invoices')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 transition flex flex-col items-start gap-2 cursor-pointer min-h-[88px]"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">All Invoices ({invoices.length})</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">View & download history</div>
          </div>
        </button>
      </div>

      {/* 3. BUSINESS METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Sales</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatINR(totalBilled)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Across {invoices.length} invoices
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Collected / Paid</span>
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Dues</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
            {formatINR(totalPending)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {invoices.filter(i => i.status !== 'PAID').length} invoices pending
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total GST</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
            {formatINR(totalGst)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            CGST + SGST + IGST tax
          </div>
        </div>
      </div>

      {/* 4. RECENT INVOICES SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Invoices</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Latest billing activity for {activeCompany?.name || 'your business'}
            </p>
          </div>

          <button
            onClick={() => setCurrentTab('invoices')}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {invoices.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No invoices yet</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Create your first GST invoice with automated tax calculations and instant WhatsApp sharing.
              </p>
            </div>
            <button
              onClick={() => setCurrentTab('create-invoice')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Invoice</span>
            </button>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pl-2">Invoice #</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices.slice(0, 6).map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 pl-2 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {inv.customer?.name || 'Cash Customer'}
                      </td>
                      <td className="py-3 text-slate-500 dark:text-slate-400">
                        {new Date(inv.invoice_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 font-black text-slate-900 dark:text-white">
                        {formatINR(inv.grand_total)}
                      </td>
                      <td className="py-3">
                        <Badge status={inv.status} size="sm" />
                      </td>
                      <td className="py-3 text-right pr-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="Download PDF"
                            disabled={downloadingId === inv.id}
                            onClick={() => handleDownloadPDF(inv)}
                            className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            {downloadingId === inv.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            title="WhatsApp PDF Share"
                            disabled={sharingId === inv.id}
                            onClick={() => handleShare(inv)}
                            className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            {sharingId === inv.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(inv.id, inv.status === 'PAID' ? 'UNPAID' : 'PAID')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer min-h-[32px] ${
                              inv.status === 'PAID'
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            {inv.status === 'PAID' ? 'Mark Unpaid' : 'Mark Paid'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
              {invoices.slice(0, 5).map(inv => (
                <div 
                  key={inv.id} 
                  className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                        {inv.invoice_number}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {inv.customer?.name || 'Cash Customer'}
                      </h4>
                    </div>
                    <Badge status={inv.status} size="sm" />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 dark:border-slate-800 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      {new Date(inv.invoice_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {formatINR(inv.grand_total)}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleDownloadPDF(inv)}
                      disabled={downloadingId === inv.id}
                      className="flex-1 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={() => handleShare(inv)}
                      disabled={sharingId === inv.id}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
