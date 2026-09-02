import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Share2, 
  Trash2, 
  PlusCircle, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Invoice, InvoiceStatus } from '../types';
import { formatINR } from '../utils/currency';
import { Badge } from '../components/common/Badge';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { openWhatsAppShare } from '../utils/whatsapp';
import { Modal } from '../components/common/Modal';

interface InvoiceHistoryPageProps {
  setCurrentTab: (tab: string) => void;
}

export const InvoiceHistoryPage: React.FC<InvoiceHistoryPageProps> = ({ setCurrentTab }) => {
  const { user, businessProfile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Invoices Master History
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, filter, download PDFs, and change payment statuses
          </p>
        </div>
        <button
          onClick={() => setCurrentTab('create-invoice')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Create New Invoice
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by invoice #, customer name, phone..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {['ALL', 'PAID', 'UNPAID', 'PARTIAL', 'OVERDUE'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs">Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No invoices found</h4>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Tax Type</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium">
                      <div>{inv.customer?.name || 'Cash Customer'}</div>
                      {inv.customer?.phone && (
                        <div className="text-[10px] text-slate-400">{inv.customer.phone}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {inv.invoice_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {inv.tax_type === 'CGST_SGST' ? 'CGST+SGST' : inv.tax_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {formatINR(inv.grand_total)}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={inv.status}
                        onChange={e => handleStatusChange(inv.id, e.target.value as InvoiceStatus)}
                        className="text-xs font-bold py-1 px-2.5 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-600 cursor-pointer"
                      >
                        <option value="UNPAID">?? UNPAID</option>
                        <option value="PAID">?? PAID</option>
                        <option value="PARTIAL">?? PARTIAL</option>
                        <option value="OVERDUE">?? OVERDUE</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
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
                        <button
                          onClick={() => {
                            setInvoiceToDelete(inv);
                            setDeleteModalOpen(true);
                          }}
                          title="Delete Invoice"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
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
        )}
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Delete Invoice"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Are you sure you want to delete invoice <strong className="text-slate-900">{invoiceToDelete?.invoice_number}</strong>? This will permanently remove the invoice and its line items.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="flex-1 py-2 font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              disabled={deleting}
              onClick={confirmDelete}
              className="flex-1 py-2 font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Invoice'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
