import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Plus, 
  Check, 
  Sparkles, 
  AlertCircle, 
  RefreshCw, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { Modal } from './Modal';
import { verifyGSTINWithBackend } from '../../utils/gstinService';

interface CompanySwitcherProps {
  compact?: boolean;
  className?: string;
}

export const CompanySwitcher: React.FC<CompanySwitcherProps> = ({
  compact = false,
  className = ''
}) => {
  const { 
    companies, 
    activeCompany, 
    maxCompanies, 
    currentCount, 
    isLimitReached, 
    switchCompany, 
    addCompany 
  } = useCompany();
  const { isPremium, planId } = useAuth();
  const { navigate } = useRouter();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showLimitModal, setShowLimitModal] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form State for Adding Company
  const [name, setName] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [state, setState] = useState<string>('Delhi');
  const [address, setAddress] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [fetchingGst, setFetchingGst] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenAdd = () => {
    setIsOpen(false);
    if (isLimitReached) {
      setShowLimitModal(true);
    } else {
      setName('');
      setGstin('');
      setPhone('');
      setEmail('');
      setState('Delhi');
      setAddress('');
      setErrorMessage('');
      setSuccessMessage('');
      setShowAddModal(true);
    }
  };

  const handleFetchGst = async () => {
    if (!gstin.trim()) {
      setErrorMessage('Please enter a 15-digit GSTIN number first.');
      return;
    }
    setFetchingGst(true);
    setErrorMessage('');
    setSuccessMessage('');
    const res = await verifyGSTINWithBackend(gstin);
    setFetchingGst(false);

    if (res.success && res.data) {
      if (res.data.company_name) setName(res.data.company_name);
      if (res.data.address) setAddress(res.data.address);
      if (res.data.state) setState(res.data.state);
      setSuccessMessage(`✓ GST Verified: ${res.data.company_name || 'Details auto-filled'}`);
    } else {
      setErrorMessage(res.error || 'Could not verify GSTIN. Please enter company details manually.');
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!name.trim()) {
      setErrorMessage('Company Name is required.');
      return;
    }

    setSaving(true);
    const res = await addCompany({
      name: name.trim(),
      gstin: gstin.trim().toUpperCase(),
      phone: phone.trim(),
      email: email.trim(),
      state: state.trim(),
      address: address.trim()
    });
    setSaving(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setShowAddModal(false);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Switcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition text-left cursor-pointer min-h-[38px] group"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-lg bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-xs">
            <Building2 className="w-3.5 h-3.5" />
          </div>

          <div className="flex flex-col min-w-0 pr-1 flex-1">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
              Company
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[105px] sm:max-w-[160px] leading-tight mt-0.5">
              {activeCompany?.name || 'My Business'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {currentCount}/{maxCompanies}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Switch Company / Business</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {currentCount} of {maxCompanies} companies used
              </p>
            </div>
            {isLimitReached ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Limit Reached
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {maxCompanies - currentCount} Available
              </span>
            )}
          </div>

          {/* Company List */}
          <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-100 dark:divide-slate-800/60">
            {companies.map(c => {
              const isActive = activeCompany?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    switchCompany(c.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {c.name ? c.name.charAt(0).toUpperCase() : 'B'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                        {c.gstin ? `GST: ${c.gstin}` : 'No GSTIN registered'}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Add Company Action Footer */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleOpenAdd}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                isLimitReached
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-800'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800'
              }`}
            >
              {isLimitReached ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Company Limit Reached ({currentCount}/{maxCompanies}) • Upgrade</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Company ({currentCount}/{maxCompanies})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Business / Company Profile"
      >
        <form onSubmit={handleSaveCompany} className="space-y-4 text-xs">
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">GSTIN Number (Optional)</label>
              <button
                type="button"
                disabled={fetchingGst || !gstin}
                onClick={handleFetchGst}
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                {fetchingGst ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                <span>{fetchingGst ? 'Verifying...' : '⚡ Auto-Fetch Company'}</span>
              </button>
            </div>
            <input
              type="text"
              maxLength={15}
              value={gstin}
              onChange={e => setGstin(e.target.value.toUpperCase())}
              placeholder="07AAAAA0000A1Z5"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Business / Company Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Ramesh Trading Enterprises"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">State / Province</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                placeholder="Delhi"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Registered Address</label>
            <textarea
              rows={2}
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Shop No. 12, Main Market, City..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Save & Switch Company'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Limit Reached Modal */}
      <Modal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        title="Company Limit Reached"
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs border border-amber-200 dark:border-amber-800">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              You've used all {maxCompanies} company profiles
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 max-w-sm mx-auto">
              Your current <strong>{isPremium ? 'Pro Plan' : 'Free Starter'}</strong> allows managing up to <strong>{maxCompanies} businesses</strong>. Upgrade your plan to manage more companies with zero ads and watermark-free invoices.
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1 text-left border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Free Starter:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">Max 2 Companies</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Monthly Pro (₹49):</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">Max 3 Companies</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Yearly Pro (₹470):</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Max 4 Companies (Best Value)</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowLimitModal(false)}
              className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              Maybe Later
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLimitModal(false);
                navigate('premium');
              }}
              className="flex-1 py-2.5 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md flex items-center justify-center gap-1.5"
            >
              <span>Upgrade Plan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
