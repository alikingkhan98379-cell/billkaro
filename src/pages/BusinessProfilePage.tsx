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
  EyeOff
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
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
    fetchRecentActivityLogs 
  } = useAuth();

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
    if (businessProfile) {
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
  }, [businessProfile]);

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
    </div>
  );
};
