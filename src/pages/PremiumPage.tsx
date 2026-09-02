import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Check, 
  ShieldCheck, 
  QrCode, 
  Upload, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Zap, 
  Lock, 
  Clock 
} from 'lucide-react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadBusinessImage } from '../utils/storage';
import { SubscriptionRequest } from '../types';

export const PremiumPage: React.FC = () => {
  const { user, subscription, businessProfile } = useAuth();
  const [existingRequest, setExistingRequest] = useState<SubscriptionRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [utrNumber, setUtrNumber] = useState<string>('');
  const [screenshotUrl, setScreenshotUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');

  const BILLKARO_UPI_ID = 'billkaro@upi';
  const PLAN_PRICE = 499;

  useEffect(() => {
    const upiUrl = `upi://pay?pa=${encodeURIComponent(BILLKARO_UPI_ID)}&pn=${encodeURIComponent('BillKaro Premium')}&am=${PLAN_PRICE}&cu=INR&tn=${encodeURIComponent('BillKaro Pro 1 Year')}`;
    QRCode.toDataURL(upiUrl, { width: 180, margin: 1 })
      .then(url => setUpiQrDataUrl(url))
      .catch(() => {});
  }, []);

  const fetchExistingRequest = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setExistingRequest(data);
    } catch (e) {
      console.error('Error fetching sub request:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExistingRequest();
  }, [user]);

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingImage(true);
    setErrorMessage('');
    const { url, error } = await uploadBusinessImage(file, 'payment_proofs', user.id);
    setUploadingImage(false);

    if (error) {
      setErrorMessage(error);
    } else if (url) {
      setScreenshotUrl(url);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!user) return;

    if (!utrNumber.trim() || utrNumber.trim().length < 6) {
      setErrorMessage('Please enter a valid 12-digit UPI / UTR Reference Number.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('subscription_requests')
        .insert({
          user_id: user.id,
          utr_number: utrNumber.trim(),
          screenshot_url: screenshotUrl,
          amount: PLAN_PRICE,
          status: 'PENDING'
        })
        .select()
        .single();

      if (error) {
        setErrorMessage(error.message);
      } else if (data) {
        setExistingRequest(data);
        setSuccessMessage('Payment proof submitted successfully! Verification takes 1-2 hours.');
        try {
          confetti({ particleCount: 60, spread: 60 });
        } catch (e) {}
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isPremium = subscription?.plan === 'premium';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Simple UPI-Based Upgrade</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Supercharge Your Business with BillKaro Pro
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
          One transparent yearly fee of ?499. No hidden charges, zero gateway commissions.
        </p>
      </div>

      {isPremium ? (
        <div className="p-8 bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl text-white shadow-xl text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-amber-300" />
          </div>
          <h3 className="text-xl font-bold">You are an Active Premium Member! ??</h3>
          <p className="text-xs text-blue-100 max-w-md mx-auto leading-relaxed">
            Your account has unlimited invoice creation, high-res PDF downloads, logo & digital signature, and WhatsApp sharing active.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Free Starter</span>
                <div className="text-2xl font-black text-slate-900 mt-1">?0 <span className="text-xs font-normal text-slate-500">/ forever</span></div>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Up to 5 invoices per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Standard GST Tax calculations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Customer & Product Master</span>
                </li>
                <li className="flex items-center gap-2 text-slate-400">
                  <span>? Unlimited invoices</span>
                </li>
                <li className="flex items-center gap-2 text-slate-400">
                  <span>? Custom Logo & Digital Signature</span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-3xl bg-gradient-to-b from-blue-50/50 via-white to-white border-2 border-blue-600 shadow-xl space-y-4 relative overflow-hidden">
              <div className="absolute top-3 right-3 px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase">
                Best Value
              </div>
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">BillKaro Pro</span>
                <div className="text-2xl font-black text-slate-900 mt-1">?499 <span className="text-xs font-normal text-slate-500">/ 1 full year</span></div>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-700 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600" />
                  <span><strong>Unlimited</strong> Invoices & Estimates</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600" />
                  <span>Upload Custom Logo & Signature</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600" />
                  <span>Dynamic UPI QR codes on all invoices</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600" />
                  <span>1-Click WhatsApp Invoice Sharing</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600" />
                  <span>Priority Support & Updates</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <QrCode className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">How to Upgrade via UPI</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
                <span className="text-xs font-bold text-slate-700">Scan & Pay ?499 via any UPI App</span>
                {upiQrDataUrl ? (
                  <img src={upiQrDataUrl} alt="BillKaro QR" className="w-44 h-44 mx-auto rounded-xl shadow-md bg-white p-2 border" />
                ) : (
                  <div className="w-44 h-44 mx-auto bg-slate-200 rounded-xl" />
                )}
                <div className="text-xs font-mono font-bold text-blue-700 bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-200/70 inline-block">
                  UPI ID: {BILLKARO_UPI_ID}
                </div>
                <p className="text-[10px] text-slate-400">GPay � PhonePe � Paytm � BHIM � Cred</p>
              </div>

              <form onSubmit={handleSubmitProof} className="space-y-4 text-xs">
                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {existingRequest && existingRequest.status === 'PENDING' && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Upgrade request under review</span>
                    </div>
                    <p className="text-[11px] text-amber-700">
                      UTR: {existingRequest.utr_number} � Submitted on {new Date(existingRequest.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">12-Digit UPI / UTR Transaction ID *</label>
                  <input
                    type="text"
                    required
                    value={utrNumber}
                    onChange={e => setUtrNumber(e.target.value)}
                    placeholder="e.g. 423589123456"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Screenshot (Optional)</label>
                  {screenshotUrl ? (
                    <div className="p-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-200 flex items-center justify-between">
                      <span>? Screenshot attached</span>
                      <button type="button" onClick={() => setScreenshotUrl('')} className="text-xs text-rose-600">Remove</button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex items-center justify-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition font-bold text-slate-700">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>{uploadingImage ? 'Uploading proof...' : 'Upload Payment Screenshot'}</span>
                      <input type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" />
                    </label>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Proof for Verification
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
