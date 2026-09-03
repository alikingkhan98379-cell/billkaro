import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Eye, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink,
  DollarSign,
  UserCheck,
  Building,
  FileCheck
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
      setActionMessage({ type: 'success', text: result.message || 'Payment marked as rejected.' });
      setShowRejectModal(false);
      setSelectedPayment(null);
      setAdminNote('');
      loadPayments();
    }
  };

  const stats = {
    total: payments.length,
    pending: payments.filter(p => p.status === 'PENDING_ADMIN' || p.status === 'SUBMITTED').length,
    approved: payments.filter(p => p.status === 'APPROVED').length,
    rejected: payments.filter(p => p.status === 'REJECTED').length
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Verification Desk Alert */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-amber-400 text-xs font-bold border border-slate-700 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Admin Authorization Desk</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            UPI Premium Payment Verifications
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Independently verify Bank of Baroda UPI receipts & approve premium plan activations.
          </p>
        </div>

        <button
          onClick={loadPayments}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs ${
          actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total Loaded</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
          <div className="text-2xl font-black text-amber-900 mt-1">{stats.pending}</div>
        </div>
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{stats.approved}</div>
        </div>
        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 shadow-xs">
          <span className="text-[11px] font-bold text-rose-700 uppercase flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
          <div className="text-2xl font-black text-rose-900 mt-1">{stats.rejected}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {[
            { id: 'PENDING_ADMIN', label: 'Pending Review', count: stats.pending },
            { id: 'ALL', label: 'All Payments' },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'REJECTED', label: 'Rejected' },
            { id: 'WAITING_FOR_PAYMENT', label: 'Unpaid / Created' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-900 font-black">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Quick UTR / Order Search Form */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search UTR, Order ID, or Email..."
            className="w-full pl-9 pr-16 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
            <span>Loading payment records...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <FileCheck className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-700">No payment records found</p>
            <p className="text-slate-400">Try adjusting your search query or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3.5 pl-4">Order ID & Date</th>
                  <th className="p-3.5">User Details</th>
                  <th className="p-3.5">Plan & Amount</th>
                  <th className="p-3.5">UTR / Ref Number</th>
                  <th className="p-3.5">Proof</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {payments.map(p => {
                  const isPending = p.status === 'PENDING_ADMIN' || p.status === 'SUBMITTED';
                  const isApproved = p.status === 'APPROVED';
                  const isRejected = p.status === 'REJECTED';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      {/* Order & Date */}
                      <td className="p-3.5 pl-4">
                        <div className="font-mono font-bold text-slate-900">{p.order_id}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(p.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* User Info */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{p.user_name || 'Business Account'}</div>
                        <div className="text-[11px] text-slate-500 font-mono truncate max-w-[180px]">{p.user_email || p.user_id}</div>
                      </td>

                      {/* Plan & Amount */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">₹{p.amount}</div>
                        <div className="text-[10px] font-bold text-blue-600 uppercase mt-0.5">
                          {p.plan_id.replace('_', ' ')}
                        </div>
                      </td>

                      {/* UTR */}
                      <td className="p-3.5">
                        {p.utr ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {p.utr}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(p.utr!)}
                              title="Copy UTR"
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                            >
                              {copiedUtr === p.utr ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not submitted</span>
                        )}
                      </td>

                      {/* Proof Screenshot */}
                      <td className="p-3.5">
                        {p.screenshot_path ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(p)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-2 py-1 rounded-lg border border-blue-200/60 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No image</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Rejected
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Review
                          </span>
                        )}
                        {!isApproved && !isRejected && !isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            {p.status}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPayment(p);
                                  setShowApproveModal(true);
                                }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPayment(p);
                                  setShowRejectModal(true);
                                }}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {!isPending && (
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(p)}
                              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: PROOF PREVIEW MODAL */}
      {selectedPayment && previewProofUrl && !showApproveModal && !showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Payment Screenshot Proof</h3>
                <p className="text-xs text-slate-500 font-mono">Order: {selectedPayment.order_id}</p>
              </div>
              <button onClick={() => setSelectedPayment(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
            </div>

            <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <img src={previewProofUrl} alt="Proof" className="max-h-80 mx-auto rounded-xl object-contain shadow-xs" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 text-[10px]">Claimed UTR:</span>
                <p className="font-mono font-bold text-slate-900">{selectedPayment.utr || 'None'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">Expected Amount:</span>
                <p className="font-bold text-emerald-700">₹{selectedPayment.amount} ({selectedPayment.plan_id})</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM APPROVAL MODAL */}
      {showApproveModal && selectedPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-1">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Approve & Activate Premium</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Confirm that the payment has been independently verified in the <strong className="text-slate-900">Bank of Baroda</strong> account?
              </p>
            </div>

            {/* Payment Summary Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">User Email:</span>
                <span className="font-bold text-slate-900 font-mono truncate max-w-[200px]">{selectedPayment.user_email || selectedPayment.user_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Plan:</span>
                <span className="font-bold text-blue-600 uppercase">{selectedPayment.plan_id.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Verified Amount:</span>
                <span className="font-black text-slate-900">₹{selectedPayment.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">UTR / Ref:</span>
                <span className="font-mono font-bold text-emerald-700">{selectedPayment.utr}</span>
              </div>
            </div>

            {/* Optional Admin Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Internal Admin Note (Optional)</label>
              <input
                type="text"
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="e.g. Verified in Bank of Baroda App ref #..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedPayment(null);
                }}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveConfirm}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Approve Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REJECT PAYMENT MODAL */}
      {showRejectModal && selectedPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-1">
              <XCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Reject Payment Proof</h3>
              <p className="text-xs text-slate-500">
                Select a valid reason for rejecting Order #{selectedPayment.order_id}.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rejection Reason *</label>
              <select
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="Payment not found in Bank of Baroda statement.">Payment not found in Bank of Baroda statement</option>
                <option value="Incorrect payment amount received.">Incorrect payment amount received</option>
                <option value="Duplicate or already claimed UTR reference.">Duplicate or already claimed UTR reference</option>
                <option value="Payment screenshot is unclear or unreadable.">Payment screenshot is unclear or unreadable</option>
                <option value="Invalid transaction reference format.">Invalid transaction reference format</option>
                <option value="Suspicious transaction submission.">Suspicious transaction submission</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Internal Note (Optional)</label>
              <input
                type="text"
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="Reason details..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedPayment(null);
                }}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
