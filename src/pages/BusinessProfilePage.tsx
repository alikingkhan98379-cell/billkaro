import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  CreditCard, 
  QrCode, 
  Upload, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Lock,
  KeyRound,
  History,
  Eye,
  EyeOff,
  Clock
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
      setTermsConditions(businessProfile.terms_conditions || '1. Goods once sold will not be taken back.\n2. Payment due within 15 days.\n3. Subject to local jurisdiction.');
    }
  }, [businessProfile]);

  // Live UPI QR code generator preview
  useEffect(() => {
    if (upiId && isValidUPI(upiId)) {
      const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name || 'Merchant')}&cu=INR`;
      QRCode.toDataURL(upiString, { width: 160, margin: 1 })
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

      if (result.data.company_name) {
        setSuccessMessage(`? GST Verified: ${result.data.company_name} auto-filled!`);
      } else {
        setSuccessMessage(result.notice || `? GSTIN recognized (${result.data.state}). Enter business name if API quota is 0.`);
      }
      setTimeout(() => setSuccessMessage(''), 6000);
    } else {
      setErrorMessage(result.error || 'Could not fetch details, please enter manually.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingLogo(true);
    setErrorMessage('');
    const { url, error } = await uploadBusinessImage(file, 'logos', user.id);
    setUploadingLogo(false);

    if (error) {
      setErrorMessage(error);
    } else if (url) {
      setLogoUrl(url);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingSign(true);
    setErrorMessage('');
    const { url, error } = await uploadBusinessImage(file, 'signatures', user.id);
    setUploadingSign(false);

    if (error) {
      setErrorMessage(error);
    } else if (url) {
      setSignatureUrl(url);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Business name is required.');
      return;
    }
    if (phone && !isValidIndianPhone(phone)) {
      setErrorMessage('Please enter a valid 10-digit Indian phone number.');
      return;
    }
    if (gstin && !isValidGSTIN(gstin)) {
      setErrorMessage('Please enter a valid 15-character GSTIN.');
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
      setChangePassSuccess('6-digit security code sent to your registered email.');
    }
  };

  const handleCompletePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError('');

    if (!changePassOtp || changePassOtp.trim().length < 6) {
      setChangePassError('Please enter the 6-digit OTP code sent to your email.');
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Business Profile & Payment Setup
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure your GST details, Bank Account, and UPI ID for instant QR code invoices
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Business Identity & GST */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Business Identity & GST</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Business / Firm Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Gupta Enterprises"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">GSTIN Number</label>
                <button
                  type="button"
                  disabled={fetchingGst || !gstin}
                  onClick={handleFetchGstDetails}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 disabled:opacity-40 transition cursor-pointer"
                >
                  {fetchingGst ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  <span>{fetchingGst ? 'Verifying...' : '? Auto-Fill from GST'}</span>
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={e => setGstin(e.target.value.toUpperCase())}
                  placeholder="07AAAAA0000A1Z5"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number (10 digits)</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="contact@guptaenterprises.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Official Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Shop 10, Ground Floor, Commercial Complex, Sector 18, Noida..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Bank & UPI Payment Details */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Bank Details & UPI Payment QR</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="HDFC Bank"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNo}
                  onChange={e => setAccountNo(e.target.value)}
                  placeholder="50200012345678"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">IFSC Code</label>
                <input
                  type="text"
                  maxLength={11}
                  value={ifsc}
                  onChange={e => setIfsc(e.target.value.toUpperCase())}
                  placeholder="HDFC0001234"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">UPI ID (VPA) *</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="9876543210@paytm or business@okhdfcbank"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Live UPI QR Code Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-slate-800 mb-2">Live QR Preview</span>
              {testQrUrl ? (
                <div className="space-y-2">
                  <img src={testQrUrl} alt="UPI QR Code" className="w-32 h-32 rounded-xl mx-auto shadow-sm bg-white p-1 border" />
                  <p className="text-[10px] text-emerald-700 font-bold">? Ready for customer scanning</p>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 p-2">
                  Enter valid UPI ID to generate QR
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Brand Logo & Digital Signature */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <Upload className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Logo & Digital Signature</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Logo Upload */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-700">Business Logo (PNG, JPG, max 2MB)</label>
              {logoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-xl bg-white border p-1" />
                  <label className="cursor-pointer px-3 py-1.5 bg-white text-slate-700 border rounded-lg font-bold hover:bg-slate-50">
                    Replace Logo
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition">
                  <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="font-bold text-blue-600">{uploadingLogo ? 'Uploading...' : 'Upload Business Logo'}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Appears on top-left of PDF invoice</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Signature Upload */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-700">Authorized Signature (PNG, max 2MB)</label>
              {signatureUrl ? (
                <div className="flex items-center gap-3">
                  <img src={signatureUrl} alt="Signature" className="w-24 h-12 object-contain rounded-xl bg-white border p-1" />
                  <label className="cursor-pointer px-3 py-1.5 bg-white text-slate-700 border rounded-lg font-bold hover:bg-slate-50">
                    Replace Signature
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleSignatureUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition">
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="font-bold text-blue-600">{uploadingSign ? 'Uploading...' : 'Upload Signature Image'}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Appears in Authorized Signatory footer</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleSignatureUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Default Invoice Terms */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Default Terms & Conditions</h3>
          <textarea
            rows={3}
            value={termsConditions}
            onChange={e => setTermsConditions(e.target.value)}
            placeholder="1. Goods once sold will not be taken back..."
            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Business Settings
          </button>
        </div>
      </form>

      {/* Card 5: Account Security, Password Management & Audit Logs */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Account Security & Credentials</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setChangePassOpen(true);
              setChangePassStep('current_pass');
              setChangePassError('');
              setChangePassSuccess('');
              setCurrentPass('');
              setNewPass('');
              setConfirmNewPass('');
              setChangePassOtp('');
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>Change Password (with 2-Step OTP)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-slate-500 font-medium">Registered Account Email</span>
            <p className="font-bold text-slate-900 text-sm mt-0.5">{user?.email || 'Not available'}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-slate-500 font-medium">Last Login Timestamp</span>
            <p className="font-bold text-slate-900 text-sm mt-0.5">
              {businessProfile?.last_login_at 
                ? new Date(businessProfile.last_login_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                : 'Active now'}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-slate-500 font-medium">Inactivity 2FA Status</span>
            <p className="font-bold text-emerald-700 text-sm mt-0.5">✓ 5-Day OTP Active</p>
          </div>
        </div>

        {/* Recent Login & Security Activity Logs */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Login & Security Activity</h4>
          </div>

          {activityLogs.length > 0 ? (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Event</th>
                    <th className="py-2.5 px-4">Account</th>
                    <th className="py-2.5 px-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {activityLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.event_type.includes('SUCCESS') 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : log.event_type.includes('FAILED')
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {log.event_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{log.email}</td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No previous security events logged yet.</p>
          )}
        </div>
      </div>

      {/* Change Password Modal (Current Password -> 6-Digit OTP -> New Strong Password) */}
      {changePassOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Change Account Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setChangePassOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {changePassError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{changePassError}</span>
              </div>
            )}

            {changePassSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{changePassSuccess}</span>
              </div>
            )}

            {changePassStep === 'current_pass' ? (
              <form onSubmit={handleRequestPasswordChange} className="space-y-4">
                <p className="text-xs text-slate-600">
                  To protect your account, enter your current password first. We will send a 6-digit confirmation OTP to <strong>{user?.email}</strong>.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Current Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPass}
                      onChange={e => setCurrentPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setChangePassOpen(false)}
                    className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changePassLoading}
                    className="flex-1 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {changePassLoading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'Send 6-Digit OTP'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCompletePasswordChange} className="space-y-4">
                <div className="text-center pb-1">
                  <p className="text-xs text-slate-600">
                    Enter the 6-digit OTP code sent to <strong>{user?.email}</strong> and your new password.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 text-center">6-Digit Security OTP</label>
                  <input
                    type="text"
                    maxLength={8}
                    required
                    autoFocus
                    value={changePassOtp}
                    onChange={e => setChangePassOtp(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                    placeholder="• • • • • •"
                    className="w-full text-center tracking-[0.4em] text-2xl font-black py-2.5 bg-slate-50 border-2 border-blue-600/30 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Strong Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrengthChecker password={newPass} showChecklist={true} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    value={confirmNewPass}
                    onChange={e => setConfirmNewPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  {confirmNewPass && newPass !== confirmNewPass && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1">Passwords do not match</p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setChangePassStep('current_pass')}
                    className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={changePassLoading}
                    className="flex-1 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {changePassLoading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'Update & Log Out Other Devices'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
