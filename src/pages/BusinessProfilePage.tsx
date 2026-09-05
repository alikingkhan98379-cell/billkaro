import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  CreditCard, 
  Upload, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
  Lock,
  History,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Check,
  ArrowRight
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { useRouter } from '../context/RouterContext';
import { Modal } from '../components/common/Modal';
import { uploadBusinessImage } from '../utils/storage';
import { isValidGSTIN, isValidIndianPhone, isValidIFSC, isValidUPI, isValidEmail, validateStrongPassword } from '../utils/validators';
import { verifyGSTINWithBackend } from '../utils/gstinService';
import { PasswordStrengthChecker } from '../components/common/PasswordStrengthChecker';
import { AuthActivityLog } from '../types';

export const BusinessProfilePage: React.FC = () => {
  const { 
    user, 
    businessProfile, 
    updateBusinessProfile, 
    requestPasswordChangeOtp, 
    completePasswordChange,
    fetchRecentActivityLogs,
    isPremium,
    planId 
  } = useAuth();
  const { 
    companies, 
    activeCompany, 
    maxCompanies, 
    currentCount, 
    isLimitReached, 
    switchCompany, 
    addCompany, 
    updateCompany,
    deleteCompany 
  } = useCompany();
  const { navigate } = useRouter();

  // Multi-Company Add Modal State
  const [showAddCompanyModal, setShowAddCompanyModal] = useState<boolean>(false);
  const [showCompanyLimitModal, setShowCompanyLimitModal] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [newCompanyGstin, setNewCompanyGstin] = useState<string>('');
  const [newCompanyPhone, setNewCompanyPhone] = useState<string>('');
  const [newCompanyEmail, setNewCompanyEmail] = useState<string>('');
  const [newCompanyState, setNewCompanyState] = useState<string>('Delhi');
  const [newCompanyAddress, setNewCompanyAddress] = useState<string>('');
  const [addingCompany, setAddingCompany] = useState<boolean>(false);
  const [addCompanyError, setAddCompanyError] = useState<string>('');
  const [fetchingNewCompanyGst, setFetchingNewCompanyGst] = useState<boolean>(false);
  const [newCompanyGstSuccess, setNewCompanyGstSuccess] = useState<string>('');

  // Form State
  const [name, setName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [accountNo, setAccountNo] = useState<string>('');
  const [ifsc, setIfsc] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [signatureUrl, setSignatureUrl] = useState<string>('');
  const [termsConditions, setTermsConditions] = useState<string>('');

  // UI State
  const [saving, setSaving] = useState<boolean>(false);
  const [fetchingGst, setFetchingGst] = useState<boolean>(false);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);
  const [uploadingSign, setUploadingSign] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [testQrUrl, setTestQrUrl] = useState<string>('');

  // Change Password Modal & State
  const [changePassOpen, setChangePassOpen] = useState<boolean>(false);
  const [changePassStep, setChangePassStep] = useState<'current_pass' | 'otp_and_new_pass'>('current_pass');
  const [currentPass, setCurrentPass] = useState<string>('');
  const [newPass, setNewPass] = useState<string>('');
  const [confirmNewPass, setConfirmNewPass] = useState<string>('');
  const [changePassOtp, setChangePassOtp] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [changePassLoading, setChangePassLoading] = useState<boolean>(false);
  const [changePassError, setChangePassError] = useState<string>('');
  const [changePassSuccess, setChangePassSuccess] = useState<string>('');
  const [resendTimer, setResendTimer] = useState<number>(0);
  const [activityLogs, setActivityLogs] = useState<AuthActivityLog[]>([]);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => (prev <= 1 ? 0 : prev - 1)), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (user) {
      fetchRecentActivityLogs().then(logs => setActivityLogs(logs));
    }
  }, [user]);

  useEffect(() => {
    if (activeCompany) {
      setName(activeCompany.name || '');
      setAddress(activeCompany.address || '');
      setPhone(activeCompany.phone || '');
      setEmail(activeCompany.email || '');
      setGstin(activeCompany.gstin || '');
      setBankName(activeCompany.bank_name || '');
      setAccountNo(activeCompany.account_no || '');
      setIfsc(activeCompany.ifsc || '');
      setUpiId(activeCompany.upi_id || '');
      setLogoUrl(activeCompany.logo_url || '');
      setSignatureUrl(activeCompany.signature_url || '');
      setTermsConditions(activeCompany.terms_conditions || '');
    } else if (businessProfile) {
      setName(businessProfile.name || '');
      setAddress(businessProfile.address || '');
      setPhone(businessProfile.phone || '');
      setEmail(businessProfile.email || '');
      setGstin(businessProfile.gstin || '');
      setBankName(businessProfile.bank_name || '');
      setAccountNo(businessProfile.account_no || '');
      setIfsc(businessProfile.ifsc || '');
      setUpiId(businessProfile.upi_id || '');
      setLogoUrl(businessProfile.logo_url || '');
      setSignatureUrl(businessProfile.signature_url || '');
      setTermsConditions(businessProfile.terms_conditions || '');
    }
  }, [activeCompany, businessProfile]);

  // Generate Preview UPI QR
  useEffect(() => {
    if (upiId && isValidUPI(upiId)) {
      const uri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name || 'Business')}&cu=INR`;
      QRCode.toDataURL(uri, { width: 160, margin: 1 })
        .then(url => setTestQrUrl(url))
        .catch(() => setTestQrUrl(''));
    } else {
      setTestQrUrl('');
    }
  }, [upiId, name]);

  const handleOpenAddCompany = () => {
    if (isLimitReached) {
      setShowCompanyLimitModal(true);
    } else {
      setNewCompanyName('');
      setNewCompanyGstin('');
      setNewCompanyPhone('');
      setNewCompanyEmail('');
      setNewCompanyState('Delhi');
      setNewCompanyAddress('');
      setAddCompanyError('');
      setNewCompanyGstSuccess('');
      setShowAddCompanyModal(true);
    }
  };

  const handleFetchNewCompanyGst = async () => {
    if (!newCompanyGstin.trim()) {
      setAddCompanyError('Please enter a 15-digit GSTIN number first.');
      return;
    }
    setFetchingNewCompanyGst(true);
    setAddCompanyError('');
    setNewCompanyGstSuccess('');
    const res = await verifyGSTINWithBackend(newCompanyGstin);
    setFetchingNewCompanyGst(false);

    if (res.success && res.data) {
      if (res.data.company_name) setNewCompanyName(res.data.company_name);
      if (res.data.address) setNewCompanyAddress(res.data.address);
      if (res.data.state) setNewCompanyState(res.data.state);
      setNewCompanyGstSuccess(`✓ Verified GST: ${res.data.company_name || 'Details auto-filled'}`);
    } else {
      setAddCompanyError(res.error || 'Could not verify GSTIN. You can enter details manually.');
    }
  };

  const handleSaveNewCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCompanyError('');
    if (!newCompanyName.trim()) {
      setAddCompanyError('Company / Business Name is required.');
      return;
    }

    setAddingCompany(true);
    const res = await addCompany({
      name: newCompanyName.trim(),
      gstin: newCompanyGstin.trim().toUpperCase(),
      phone: newCompanyPhone.trim(),
      email: newCompanyEmail.trim(),
      state: newCompanyState.trim(),
      address: newCompanyAddress.trim()
    });
    setAddingCompany(false);

    if (res.error) {
      setAddCompanyError(res.error);
    } else {
      setShowAddCompanyModal(false);
      setSuccessMessage(`Successfully switched to ${newCompanyName.trim()}!`);
      setTimeout(() => setSuccessMessage(''), 4000);
    }
  };

  const handleDeleteCompany = async (id: string, compName: string) => {
    if (companies.length <= 1) {
      setErrorMessage('You must have at least one active business profile.');
      return;
    }
    if (window.confirm(`Are you sure you want to remove "${compName}" from your managed companies?`)) {
      const res = await deleteCompany(id);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(`Removed "${compName}".`);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    }
  };

  const handleFetchGstDetails = async () => {
    setErrorMessage('');
    setSuccessMessage('');
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
      setSuccessMessage('✓ Business details auto-filled from verified GST records!');
    } else {
      setErrorMessage(result.error || 'Could not auto-fetch GST details.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    const file = e.target.files[0];
    setUploadingLogo(true);
    const { url, error } = await uploadBusinessImage(file, 'logos', user.id);
    setUploadingLogo(false);

    if (error) {
      setErrorMessage('Logo upload failed: ' + error);
    } else if (url) {
      setLogoUrl(url);
      setSuccessMessage('Logo uploaded successfully!');
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    const file = e.target.files[0];
    setUploadingSign(true);
    const { url, error } = await uploadBusinessImage(file, 'signatures', user.id);
    setUploadingSign(false);

    if (error) {
      setErrorMessage('Signature upload failed: ' + error);
    } else if (url) {
      setSignatureUrl(url);
      setSuccessMessage('Signature uploaded successfully!');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Business / Firm name is required.');
      return;
    }
    if (phone && !isValidIndianPhone(phone)) {
      setErrorMessage('Please enter a valid 10-digit Indian phone number.');
      return;
    }
    if (gstin && !isValidGSTIN(gstin)) {
      setErrorMessage('Please enter a valid 15-digit GSTIN.');
      return;
    }
    if (email && !isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (ifsc && !isValidIFSC(ifsc)) {
      setErrorMessage('Please enter a valid 11-character IFSC Code (e.g. HDFC0001234).');
      return;
    }
    if (upiId && !isValidUPI(upiId)) {
      setErrorMessage('Please enter a valid UPI ID (e.g. business@upi, 9876543210@paytm).');
      return;
    }

    setSaving(true);
    
    // Save to multi-company context
    if (activeCompany) {
      await updateCompany(activeCompany.id, {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim().toUpperCase(),
        bank_name: bankName.trim(),
        account_no: accountNo.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        upi_id: upiId.trim().toLowerCase(),
        logo_url: logoUrl,
        signature_url: signatureUrl,
        terms_conditions: termsConditions.trim()
      });
    }

    const { error } = await updateBusinessProfile({
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      gstin: gstin.trim().toUpperCase(),
      bank_name: bankName.trim(),
      account_no: accountNo.trim(),
      ifsc: ifsc.trim().toUpperCase(),
      upi_id: upiId.trim().toLowerCase(),
      logo_url: logoUrl,
      signature_url: signatureUrl,
      terms_conditions: termsConditions.trim()
    });
    setSaving(false);

    if (error) {
      setErrorMessage(error);
    } else {
      setSuccessMessage('Business Profile & UPI settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    }
  };

  const handleRequestPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError('');
    setChangePassSuccess('');

    if (!currentPass) {
      setChangePassError('Please enter your current password.');
      return;
    }

    setChangePassLoading(true);
    const { error } = await requestPasswordChangeOtp(currentPass);
    setChangePassLoading(false);

    if (error) {
      setChangePassError(error);
    } else {
      setChangePassStep('otp_and_new_pass');
      setResendTimer(30);
      setChangePassSuccess('8-character security code sent to your registered email.');
    }
  };

  const handleCompletePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError('');

    if (!changePassOtp || changePassOtp.trim().length < 6) {
      setChangePassError('Please enter the complete 8-character OTP code sent to your email.');
      return;
    }

    const passCheck = validateStrongPassword(newPass);
    if (!passCheck.isValid) {
      setChangePassError('New password must meet all strong password requirements.');
      return;
    }

    if (newPass !== confirmNewPass) {
      setChangePassError('New passwords do not match.');
      return;
    }

    setChangePassLoading(true);
    const { error } = await completePasswordChange(currentPass, changePassOtp, newPass);
    setChangePassLoading(false);

    if (error) {
      setChangePassError(error);
    } else {
      setChangePassSuccess('Password successfully updated! All other device sessions logged out.');
      setTimeout(() => {
        setChangePassOpen(false);
        setChangePassStep('current_pass');
        setCurrentPass('');
        setNewPass('');
        setConfirmNewPass('');
        setChangePassOtp('');
        setChangePassSuccess('');
        fetchRecentActivityLogs().then(logs => setActivityLogs(logs));
      }, 2500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Business Profile & Payment Setup
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure your GST details, Bank Account, and UPI ID for instant QR code invoices
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Top Multi-Company Profiles Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-7 space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Managed Companies & Profiles</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {currentCount} of {maxCompanies} Used
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Switch active company to generate invoices, download PDFs, and print corresponding GST / UPI details.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddCompany}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer min-h-[40px] shrink-0 ${
              isLimitReached
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLimitReached ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Limit Reached ({currentCount}/{maxCompanies}) • Upgrade</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add Company ({currentCount}/{maxCompanies})</span>
              </>
            )}
          </button>
        </div>

        {/* Company Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {companies.map(c => {
            const isActive = activeCompany?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => switchCompany(c.id)}
                className={`p-3.5 rounded-2xl border transition text-left cursor-pointer relative group flex flex-col justify-between ${
                  isActive
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}>
                        {c.name ? c.name.charAt(0).toUpperCase() : 'B'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {c.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          {c.gstin ? `GST: ${c.gstin}` : 'No GSTIN'}
                        </p>
                      </div>
                    </div>

                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-blue-900/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700 shadow-2xs shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-1">
                    {c.address || c.phone || 'No additional details set'}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {isActive ? 'Editing Profile Details' : 'Click to Switch'}
                  </span>

                  {companies.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCompany(c.id, c.name);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                      title="Remove company"
                      aria-label="Remove company"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Business Identity & GST */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-8 space-y-6 transition-colors">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Business Identity & GST</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Business / Firm Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Gupta Enterprises"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">GSTIN Number</label>
                <button
                  type="button"
                  disabled={fetchingGst || !gstin}
                  onClick={handleFetchGstDetails}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 disabled:opacity-40 transition cursor-pointer"
                >
                  {fetchingGst ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  <span>{fetchingGst ? 'Verifying...' : '⚡ Auto-Fill from GST'}</span>
                </button>
              </div>
              <input
                type="text"
                maxLength={15}
                value={gstin}
                onChange={e => setGstin(e.target.value.toUpperCase())}
                placeholder="07AAAAA0000A1Z5"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number (10 digits)</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="contact@guptaenterprises.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Official Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Shop 10, Ground Floor, Commercial Complex, Sector 18, Noida..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Bank & UPI Payment Details */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-8 space-y-6 transition-colors">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Bank Details & UPI Payment QR</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="HDFC Bank"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNo}
                  onChange={e => setAccountNo(e.target.value)}
                  placeholder="50200012345678"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">IFSC Code</label>
                <input
                  type="text"
                  maxLength={11}
                  value={ifsc}
                  onChange={e => setIfsc(e.target.value.toUpperCase())}
                  placeholder="HDFC0001234"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">UPI ID (VPA) *</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value.toLowerCase())}
                  placeholder="business@okaxis or 9876543210@paytm"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* UPI QR Preview */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Invoice UPI QR Preview</span>
              {testQrUrl ? (
                <img src={testQrUrl} alt="UPI QR" className="w-32 h-32 rounded-xl border border-slate-200 bg-white p-1 shadow-xs" />
              ) : (
                <div className="w-32 h-32 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 text-[10px]">
                  Enter valid UPI ID
                </div>
              )}
              <span className="text-[10px] text-slate-400">Printed on every PDF invoice</span>
            </div>
          </div>
        </div>

        {/* Card 3: Branding & Terms */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-8 space-y-6 transition-colors">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Branding & Invoice Footer</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Company Logo</label>
              {logoUrl ? (
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain bg-white rounded-lg p-1 border" />
                  <button type="button" onClick={() => setLogoUrl('')} className="text-xs text-rose-600 font-bold hover:underline">Remove</button>
                </div>
              ) : (
                <label className="cursor-pointer flex items-center justify-center gap-2 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition font-bold text-slate-700 dark:text-slate-200">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>{uploadingLogo ? 'Uploading logo...' : 'Upload Logo (PNG/JPG)'}</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Authorized Digital Signature</label>
              {signatureUrl ? (
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <img src={signatureUrl} alt="Signature" className="w-20 h-10 object-contain bg-white rounded-lg p-1 border" />
                  <button type="button" onClick={() => setSignatureUrl('')} className="text-xs text-rose-600 font-bold hover:underline">Remove</button>
                </div>
              ) : (
                <label className="cursor-pointer flex items-center justify-center gap-2 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition font-bold text-slate-700 dark:text-slate-200">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>{uploadingSign ? 'Uploading signature...' : 'Upload Signature (PNG)'}</span>
                  <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                </label>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Default Terms & Conditions (Printed on PDF)</label>
              <textarea
                rows={3}
                value={termsConditions}
                onChange={e => setTermsConditions(e.target.value)}
                placeholder="1. Goods once sold will not be taken back. 2. Subject to local jurisdiction..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Save CTA */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center gap-2 cursor-pointer min-h-[44px]"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving Profile...' : 'Save Business Profile'}</span>
          </button>
        </div>
      </form>

      {/* Security & Password Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-8 space-y-4 transition-colors">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Account Security & Password</h3>
          </div>
          <button
            onClick={() => setChangePassOpen(true)}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer min-h-[40px]"
          >
            Change Password
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Your account is secured with 2FA email OTP authorization. Changing password automatically invalidates all other browser sessions.
        </p>
      </div>

      {/* Change Password Modal */}
      {changePassOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Change Account Password</h4>
              <button onClick={() => setChangePassOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">✕</button>
            </div>

            {changePassError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-800">
                {changePassError}
              </div>
            )}
            {changePassSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl border border-emerald-200 dark:border-emerald-800">
                {changePassSuccess}
              </div>
            )}

            {changePassStep === 'current_pass' ? (
              <form onSubmit={handleRequestPasswordChange} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Current Password *</label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPass}
                      onChange={e => setCurrentPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={changePassLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer min-h-[44px]"
                >
                  {changePassLoading ? 'Verifying...' : 'Send Security OTP to Email'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCompletePasswordChange} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">8-Character Email OTP *</label>
                  <input
                    type="text"
                    required
                    value={changePassOtp}
                    onChange={e => setChangePassOtp(e.target.value.toUpperCase())}
                    placeholder="e.g. 849201"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-center font-bold tracking-widest text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">New Password *</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="Min 8 chars, 1 uppercase, 1 digit..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrengthChecker password={newPass} />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    value={confirmNewPass}
                    onChange={e => setConfirmNewPass(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={changePassLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer min-h-[44px]"
                >
                  {changePassLoading ? 'Updating...' : 'Confirm & Update Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      <Modal
        isOpen={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        title="Add New Business / Company Profile"
      >
        <form onSubmit={handleSaveNewCompany} className="space-y-4 text-xs">
          {addCompanyError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{addCompanyError}</span>
            </div>
          )}

          {newCompanyGstSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{newCompanyGstSuccess}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">GSTIN Number (Optional)</label>
              <button
                type="button"
                disabled={fetchingNewCompanyGst || !newCompanyGstin}
                onClick={handleFetchNewCompanyGst}
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                {fetchingNewCompanyGst ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                <span>{fetchingNewCompanyGst ? 'Verifying...' : '⚡ Auto-Fetch Company'}</span>
              </button>
            </div>
            <input
              type="text"
              maxLength={15}
              value={newCompanyGstin}
              onChange={e => setNewCompanyGstin(e.target.value.toUpperCase())}
              placeholder="07AAAAA0000A1Z5"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Business / Company Name *</label>
            <input
              type="text"
              required
              value={newCompanyName}
              onChange={e => setNewCompanyName(e.target.value)}
              placeholder="e.g. Ramesh Trading Enterprises"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="text"
                value={newCompanyPhone}
                onChange={e => setNewCompanyPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">State / Province</label>
              <input
                type="text"
                value={newCompanyState}
                onChange={e => setNewCompanyState(e.target.value)}
                placeholder="Delhi"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Registered Address</label>
            <textarea
              rows={2}
              value={newCompanyAddress}
              onChange={e => setNewCompanyAddress(e.target.value)}
              placeholder="Shop No. 12, Main Market, City..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddCompanyModal(false)}
              className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingCompany}
              className="flex-1 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 cursor-pointer"
            >
              {addingCompany ? 'Creating...' : 'Save & Switch Company'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Company Limit Reached Modal */}
      <Modal
        isOpen={showCompanyLimitModal}
        onClose={() => setShowCompanyLimitModal(false)}
        title="Company Limit Reached"
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs border border-amber-200 dark:border-amber-800">
            <Sparkles className="w-7 h-7" />
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
              onClick={() => setShowCompanyLimitModal(false)}
              className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
            >
              Maybe Later
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCompanyLimitModal(false);
                navigate('premium');
              }}
              className="flex-1 py-2.5 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
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
