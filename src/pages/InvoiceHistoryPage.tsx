import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Download, 
  Share2, 
  Trash2, 
  PlusCircle, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Invoice, InvoiceStatus } from '../types';
import { formatINR } from '../utils/currency';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { shareInvoicePDF } from '../utils/shareService';
import { Modal } from '../components/common/Modal';

interface InvoiceHistoryPageProps {
  setCurrentTab: (tab: any) => void;
}

export const InvoiceHistoryPage: React.FC<InvoiceHistoryPageProps> = ({ setCurrentTab }) => {
  const { user, businessProfile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  
  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*),
          items:invoice_items(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setInvoices(data);
      }
    } catch (e) {
      console.error('Error fetching invoices:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  const handleStatusChange = async (invoiceId: string, newStatus: InvoiceStatus) => {
    try {
      await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId);

      setInvoices(prev =>
        prev.map(inv => (inv.id === invoiceId ? { ...inv, status: newStatus } : inv))
      );
    } catch (e) {
      console.error('Error updating status:', e);
    }
  };

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
      const res = await shareInvoicePDF(inv, businessProfile, inv.customer);
      if (res.message) {
        setShareNotice(res.message);
        setTimeout(() => setShareNotice(null), 5000);
      }
    } catch (e) {
      console.error('Share error:', e);
    } finally {
      setSharingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    setDeleting(true);
    try {
      await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceToDelete.id);

      setInvoices(prev => prev.filter(i => i.id !== invoiceToDelete.id));
      setDeleteModalOpen(false);
      setInvoiceToDelete(null);
    } catch (e) {
      console.error('Error deleting invoice:', e);
    } finally {
      setDeleting(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customer?.name && inv.customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inv.customer?.phone && inv.customer.phone.includes(searchQuery));

    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Invoices Master History
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Search, filter, share actual PDFs, and track payment collections
          </p>
        </div>
        <button
          onClick={() => setCurrentTab('create-invoice')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition self-start sm:self-auto cursor-pointer min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Invoice</span>
        </button>
      </div>

      {/* Share Notice Toast */}
      {shareNotice && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{shareNotice}</span>
          </div>
          <button onClick={() => setShareNotice(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 sm:p-6 space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, party, phone..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
            {['ALL', 'PAID', 'UNPAID', 'PARTIAL', 'OVERDUE'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer min-h-[36px] ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredInvoices.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
              <FileText className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No invoices yet</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Create your first GST invoice in under 60 seconds with 1-click customer & product auto-fill.
              </p>
            </div>
            <button
              onClick={() => setCurrentTab('create-invoice')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              + Create First Invoice
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Tax Type</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-200">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-4 font-medium">
                        <div className="font-bold text-slate-900 dark:text-white">{inv.customer?.name || 'Cash Customer'}</div>
                        {inv.customer?.phone && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{inv.customer.phone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        {inv.invoice_date}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {inv.tax_type === 'CGST_SGST' ? 'CGST+SGST' : inv.tax_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {formatINR(inv.grand_total)}
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={inv.status}
                          onChange={e => handleStatusChange(inv.id, e.target.value as InvoiceStatus)}
                          className="text-xs font-bold py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-600 cursor-pointer"
                        >
                          <option value="UNPAID">🔴 UNPAID</option>
                          <option value="PAID">🟢 PAID</option>
                          <option value="PARTIAL">🟡 PARTIAL</option>
                          <option value="OVERDUE">🟠 OVERDUE</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            disabled={downloadingId === inv.id}
                            onClick={() => handleDownloadPDF(inv)}
                            title="Download PDF"
                            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
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
                            title="Share Actual PDF File"
                            className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            {sharingId === inv.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setInvoiceToDelete(inv);
                              setDeleteModalOpen(true);
                            }}
                            title="Delete Invoice"
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {filteredInvoices.map(inv => (
                <div 
                  key={inv.id} 
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {inv.invoice_number}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{inv.invoice_date}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {formatINR(inv.grand_total)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                      {inv.customer?.name || 'Cash Customer'}
                    </div>
                    <select
                      value={inv.status}
                      onChange={e => handleStatusChange(inv.id, e.target.value as InvoiceStatus)}
                      className="text-xs font-bold py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <option value="UNPAID">🔴 UNPAID</option>
                      <option value="PAID">🟢 PAID</option>
                      <option value="PARTIAL">🟡 PARTIAL</option>
                      <option value="OVERDUE">🟠 OVERDUE</option>
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <button
                      onClick={() => handleDownloadPDF(inv)}
                      disabled={downloadingId === inv.id}
                      className="flex-1 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer min-h-[40px]"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>PDF</span>
                    </button>

                    <button
                      onClick={() => handleShare(inv)}
                      disabled={sharingId === inv.id}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer min-h-[40px]"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share PDF</span>
                    </button>

                    <button
                      onClick={() => {
                        setInvoiceToDelete(inv);
                        setDeleteModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Delete Invoice"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Are you sure you want to delete invoice <strong className="text-slate-900 dark:text-white font-mono">{invoiceToDelete?.invoice_number}</strong>? This will permanently remove the invoice and its line items.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              disabled={deleting}
              onClick={confirmDelete}
              className="flex-1 py-2.5 font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              {deleting ? 'Deleting...' : 'Delete Invoice'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
