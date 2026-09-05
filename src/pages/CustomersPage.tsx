import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  Building, 
  RefreshCw, 
  MapPin,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { supabase } from '../lib/supabase';
import { Customer } from '../types';
import { Modal } from '../components/common/Modal';
import { isValidIndianPhone, isValidGSTIN, isValidEmail } from '../utils/validators';
import { verifyGSTINWithBackend } from '../utils/gstinService';

export const CustomersPage: React.FC = () => {
  const { user } = useAuth();
  const { activeCompany, activeCompanyId, companies, isItemForActiveCompany, resolveCompany } = useCompany();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewFilter, setViewFilter] = useState<'active' | 'all'>('active');

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [fetchingGst, setFetchingGst] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [noticeMessage, setNoticeMessage] = useState<string>('');

  // Form Fields
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');
  const [state, setState] = useState<string>('Delhi');
  const [address, setAddress] = useState<string>('');

  const fetchCustomers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (!error && data) {
        setCustomers(data);
      }
    } catch (e) {
      console.error('Error loading customers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [user]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setGstin('');
    setState('Delhi');
    setAddress('');
    setErrorMessage('');
    setSuccessMessage('');
    setNoticeMessage('');
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setGstin(c.gstin || '');
    setState(c.state || 'Delhi');
    setAddress(c.address || '');
    setErrorMessage('');
    setSuccessMessage('');
    setNoticeMessage('');
    setModalOpen(true);
  };

  const handleFetchGstCustomer = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setNoticeMessage('');
    if (!gstin.trim()) {
      setErrorMessage('Please enter a 15-character GSTIN number first.');
      return;
    }

    setFetchingGst(true);
    const result = await verifyGSTINWithBackend(gstin);
    setFetchingGst(false);

    if (result.success && result.data) {
      if (result.data.company_name) setName(result.data.company_name);
      if (result.data.address) setAddress(result.data.address);
      if (result.data.state) setState(result.data.state);

      if (result.data.company_name) {
        setSuccessMessage(`✓ GST Verified: ${result.data.company_name} auto-filled!`);
      } else {
        setNoticeMessage(result.notice || `✓ State '${result.data.state}' auto-detected! (Company Name & Address require active API credits on gstincheck.co.in)`);
      }
    } else {
      setErrorMessage(result.error || 'Could not fetch details, please enter manually.');
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!user) return;

    if (!name.trim()) {
      setErrorMessage('Customer name is required.');
      return;
    }
    if (phone && !isValidIndianPhone(phone)) {
      setErrorMessage('Please enter a valid 10-digit Indian phone number.');
      return;
    }
    if (gstin && !isValidGSTIN(gstin)) {
      setErrorMessage('Please enter a valid 15-digit GSTIN (e.g. 07AAAAA0000A1Z5).');
      return;
    }
    if (email && !isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        const { data, error } = await supabase
          .from('customers')
          .update({
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            gstin: gstin.trim().toUpperCase(),
            state: state.trim(),
            address: address.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCustomer.id)
          .select()
          .single();

        if (error) {
          setErrorMessage(error.message);
        } else if (data) {
          setCustomers(prev => prev.map(c => (c.id === data.id ? data : c)));
          setModalOpen(false);
        }
      } else {
        const primaryId = companies.length > 0 ? companies[0].id : null;
        const currentId = activeCompany?.id || activeCompanyId || primaryId;

        const custPayload: Record<string, any> = {
          user_id: user.id,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          gstin: gstin.trim().toUpperCase(),
          state: state.trim(),
          address: address.trim()
        };
        if (currentId) {
          custPayload.company_id = currentId;
        }

        let { data, error } = await supabase
          .from('customers')
          .insert(custPayload)
          .select()
          .single();

        // Fallback retry if company_id column not present in schema
        if (error && (error.message?.includes('company_id') || error.code === 'PGRST204')) {
          delete custPayload.company_id;
          const retryRes = await supabase
            .from('customers')
            .insert(custPayload)
            .select()
            .single();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (error) {
          setErrorMessage(error.message);
        } else if (data) {
          setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
          setModalOpen(false);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    try {
      await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id);

      setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (viewFilter === 'active' && !isItemForActiveCompany(c)) {
      return false;
    }
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Customers Master Directory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your buyers, client GSTINs, phone numbers, and billing addresses for <strong className="text-blue-600 dark:text-blue-400">{activeCompany?.name || 'your business'}</strong>
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition self-start sm:self-auto cursor-pointer min-h-[44px]"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* View Filter Pill Bar (When multiple companies exist) */}
      {companies.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Filtering:</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-xs font-black">
              {viewFilter === 'active' ? (activeCompany?.name || 'Active Business') : 'All Businesses Combined'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewFilter('active')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer min-h-[32px] ${
                viewFilter === 'active'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {activeCompany?.name || 'Active Business'} Only
            </button>
            <button
              onClick={() => setViewFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer min-h-[32px] ${
                viewFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
              }`}
            >
              All Businesses ({customers.length})
            </button>
          </div>
        </div>
      )}

      {/* Directory Search & List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 sm:p-6 space-y-4 transition-colors">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search customers by name, phone, GSTIN..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs">Loading customer directory...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No customers found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Add your customer details once and automatically autofill them when creating invoices.
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition cursor-pointer"
            >
              + Add Customer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map(c => (
              <div
                key={c.id}
                className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xs transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</h4>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {c.state && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {c.state}
                          </span>
                        )}
                        {companies.length > 1 && (
                          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200/50">
                            {resolveCompany(c.company_id)?.name || 'Primary'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setCustomerToDelete(c);
                        setDeleteModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.gstin && (
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">GST: {c.gstin}</span>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-start gap-2 text-slate-500 dark:text-slate-400 pt-1 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{c.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {noticeMessage && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{noticeMessage}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Business Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Ramesh Trading Co."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number (10 digits)</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">GSTIN</label>
                <button
                  type="button"
                  disabled={fetchingGst || !gstin}
                  onClick={handleFetchGstCustomer}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  {fetchingGst ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                  <span>{fetchingGst ? 'Verifying...' : '⚡ Fetch Details'}</span>
                </button>
              </div>
              <input
                type="text"
                maxLength={15}
                value={gstin}
                onChange={e => setGstin(e.target.value.toUpperCase())}
                placeholder="07AAAAA0000A1Z5"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="customer@email.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Place of Supply / State</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                placeholder="e.g. Uttar Pradesh"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Billing Address</label>
            <textarea
              rows={2}
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Shop No 14, Main Commercial Complex..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              {saving ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Save Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Customer Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Customer"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{customerToDelete?.name}</strong> from your customer master? Past invoices will still preserve historical records.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 py-2.5 font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 cursor-pointer min-h-[44px]"
            >
              Delete Customer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
