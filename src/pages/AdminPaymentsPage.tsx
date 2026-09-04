import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Eye, 
  RefreshCw, 
  Copy, 
  Check, 
  FileCheck, 
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PaymentRecord } from '../types';
import { getPaymentProofSignedUrl } from '../utils/storage';

export const AdminPaymentsPage: React.FC = () => {
  const { adminGetPayments, adminApprovePayment, adminRejectPayment } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_ADMIN');
  
  // Modals & Actions
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [adminNote, setAdminNote] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('Payment not found in Bank of Baroda statement.');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await adminGetPayments(searchQuery, statusFilter);
      setPayments(data);
    } catch (e) {
      console.error('Failed to load admin payments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPayments();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUtr(text);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handleOpenPreview = async (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    if (payment.screenshot_path) {
      setPreviewLoading(true);
      const url = await getPaymentProofSignedUrl(payment.screenshot_path);
      setPreviewProofUrl(url);
      setPreviewLoading(false);
    } else {
      setPreviewProofUrl(null);
    }
  };

  const handleApproveConfirm = async () => {
    if (!selectedPayment) return;
    setActionLoading(true);
    setActionMessage(null);
    const result = await adminApprovePayment(selectedPayment.id, adminNote);
    setActionLoading(false);

    if (result.error) {
      setActionMessage({ type: 'error', text: result.error });
    } else {
      setActionMessage({ type: 'success', text: result.message || 'Payment successfully approved!' });
      setShowApproveModal(false);
      setSelectedPayment(null);
      setAdminNote('');
      loadPayments();
    }
  };

  const handleRejectConfirm = async () => {
    if (!selectedPayment) return;
    setActionLoading(true);
    setActionMessage(null);
    const result = await adminRejectPayment(selectedPayment.id, rejectReason, adminNote);
    setActionLoading(false);

    if (result.error) {
      setActionMessage({ type: 'error', text: result.error });
    } else {
      setActionMessage({ type: 'success', text: result.message || 'Payment rejected.' });
      setShowRejectModal(false);
      setSelectedPayment(null);
      setAdminNote('');
      loadPayments();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 dark:bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Bank of Baroda Verification Desk</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">Admin Payment Authorizer</h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Cross-verify customer UTRs against your Bank of Baroda account statement. Approving instantly grants Pro subscription and ad-free billing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadPayments}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-2 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Desk</span>
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between animate-in fade-in ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800' 
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
        </div>
      )}

      {/* Search & Status Filter Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 sm:p-6 space-y-4 transition-colors">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, UTR, Txn ID, email..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
            {[
              { id: 'PENDING_ADMIN', label: 'Pending Verification' },
              { id: 'APPROVED', label: 'Approved' },
              { id: 'REJECTED', label: 'Rejected' },
              { id: 'ALL', label: 'All Records' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer min-h-[36px] ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </form>

        {/* Payments Table */}
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs">Loading transaction records...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <FileCheck className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-700 dark:text-slate-300">No payment records found</p>
            <p className="text-slate-400">Try adjusting your search query or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3.5 pl-4">Order ID & Date</th>
                  <th className="p-3.5">User Details</th>
                  <th className="p-3.5">Plan & Amount</th>
                  <th className="p-3.5">UTR / Ref Number</th>
                  <th className="p-3.5">Proof</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200">
                {payments.map(p => {
                  const isPending = p.status === 'PENDING_ADMIN' || p.status === 'SUBMITTED';
                  const isApproved = p.status === 'APPROVED';
                  const isRejected = p.status === 'REJECTED';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5 pl-4">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">{p.order_id}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(p.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">{p.user_name || 'Business Account'}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[180px]">{p.user_email || p.user_id}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">₹{p.amount}</div>
                        <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mt-0.5">
                          {p.plan_id.replace('_', ' ')}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-1">
                          {p.utr ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400">UTR:</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                {p.utr}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(p.utr!)}
                                title="Copy UTR"
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 cursor-pointer"
                              >
                                {copiedUtr === p.utr ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No UTR</span>
                          )}

                          {p.transaction_reference && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400">Txn:</span>
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                {p.transaction_reference}
                              </span>
                            </div>
                          )}

                          {((p.utr && p.transaction_reference && p.utr.trim().toUpperCase() === p.transaction_reference.trim().toUpperCase()) || p.verification_status === 'SUSPICIOUS') && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 mt-1">
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                              <span>SUSPICIOUS: Identical UTR & Txn ID</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        {p.screenshot_path ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-[11px] font-bold transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No Screenshot</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                          isApproved ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                          isRejected ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                          'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {isPending && <Clock className="w-3 h-3 animate-spin text-amber-600" />}
                          {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isRejected && <XCircle className="w-3 h-3 text-rose-600" />}
                          <span>{p.status}</span>
                        </span>
                      </td>

                      <td className="p-3.5 text-right pr-4">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayment(p);
                                setShowApproveModal(true);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer min-h-[36px]"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayment(p);
                                setShowRejectModal(true);
                              }}
                              className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition cursor-pointer min-h-[36px]"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proof Preview Modal */}
      {selectedPayment && previewProofUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Payment Proof Screenshot</h4>
              <button onClick={() => setPreviewProofUrl(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <img src={previewProofUrl} alt="Proof" className="w-full h-auto rounded-xl" />
            </div>
            <div className="text-right">
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Confirm Bank of Baroda Approval</span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Have you verified receipt of <strong className="text-slate-900 dark:text-white">₹{selectedPayment.amount}</strong> for Order <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedPayment.order_id}</span>?
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
              <div><strong className="text-slate-700 dark:text-slate-300">UTR:</strong> <span className="font-mono">{selectedPayment.utr || 'N/A'}</span></div>
              <div><strong className="text-slate-700 dark:text-slate-300">Plan:</strong> <span className="uppercase">{selectedPayment.plan_id}</span></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Admin Notes (Optional)</label>
              <input
                type="text"
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="e.g. Verified in BoB statement @ 03:30 PM"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowApproveModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleApproveConfirm}
                className="flex-1 py-2.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
              >
                {actionLoading ? 'Activating...' : 'Confirm & Activate Pro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span>Reject Payment Submission</span>
            </h4>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reason for Rejection</label>
              <select
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="Payment not found in Bank of Baroda statement.">Transaction not found in bank statement</option>
                <option value="Incorrect amount paid.">Incorrect amount transferred</option>
                <option value="Invalid or fake UTR reference submitted.">Invalid or unverified UTR reference</option>
                <option value="Duplicate transaction claim.">Duplicate transaction claim</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleRejectConfirm}
                className="flex-1 py-2.5 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
