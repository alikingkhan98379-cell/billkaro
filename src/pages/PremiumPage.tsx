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
  Clock, 
  Copy, 
  ExternalLink,
  Download,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { PLANS_CONFIG, PlanId, generateUpiUri, UPI_CONFIG } from '../config/plans';
import { uploadPaymentProof } from '../utils/storage';
import { PaymentRecord } from '../types';

export const PremiumPage: React.FC = () => {
  const { 
    user, 
    subscription, 
    isPremium, 
    daysRemaining,
    createPaymentOrder, 
    submitPaymentProof, 
    fetchUserPayments 
  } = useAuth();
  const { navigate } = useRouter();

  // Selected Plan state
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('yearly');
  const [activeOrder, setActiveOrder] = useState<PaymentRecord | null>(null);
  const [userPayments, setUserPayments] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  // Form states
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [creatingOrder, setCreatingOrder] = useState<boolean>(false);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Messages & Dynamic QR
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');

  const selectedPlan = PLANS_CONFIG[selectedPlanId] || PLANS_CONFIG.yearly;

  // Load User Payment History & check for pending order
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await fetchUserPayments();
      setUserPayments(history);
      
      // If there's an active/pending payment, pre-select it
      const latestPending = history.find(p => p.status === 'PENDING_ADMIN' || p.status === 'WAITING_FOR_PAYMENT');
      if (latestPending && !activeOrder) {
        setActiveOrder(latestPending);
        if (latestPending.plan_id in PLANS_CONFIG) {
          setSelectedPlanId(latestPending.plan_id as PlanId);
        }
      }
    } catch (e) {
      console.error('Failed to load user payments:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  // Generate Dynamic QR whenever selected plan or active order changes
  useEffect(() => {
    if (selectedPlanId === 'free') {
      setUpiQrDataUrl('');
      return;
    }
    const amount = activeOrder ? activeOrder.amount : selectedPlan.price;
    const orderId = activeOrder?.order_id;
    const uri = generateUpiUri(amount, orderId);

    QRCode.toDataURL(uri, {
      width: 250,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then(url => {
      setUpiQrDataUrl(url);
    }).catch(err => {
      console.error('QR Gen error:', err);
    });
  }, [selectedPlanId, activeOrder, selectedPlan]);

  // Handle Plan Selection
  const handleSelectPlan = async (plan: PlanId) => {
    setSelectedPlanId(plan);
    setErrorMessage('');
    setSuccessMessage('');
    if (plan === 'free') {
      setActiveOrder(null);
      return;
    }

    setCreatingOrder(true);
    const res = await createPaymentOrder(plan);
    setCreatingOrder(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else if (res.data) {
      setActiveOrder(res.data);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, type: 'upi' | 'amount') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'upi') {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2000);
      }
    }
  };

  // Handle Screenshot Upload
  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 5MB');
      return;
    }

    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle Payment Proof Submission
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    let targetOrder = activeOrder;
    if (!targetOrder && selectedPlanId !== 'free') {
      setCreatingOrder(true);
      const orderRes = await createPaymentOrder(selectedPlanId);
      setCreatingOrder(false);
      if (orderRes.error || !orderRes.data) {
        setErrorMessage(orderRes.error || 'Failed to initialize order. Please try again.');
        return;
      }
      targetOrder = orderRes.data;
      setActiveOrder(orderRes.data);
    }

    if (!targetOrder) {
      setErrorMessage('Please select a paid plan first.');
      return;
    }

    const cleanUtr = utrNumber.trim().toUpperCase();
    if (!cleanUtr || cleanUtr.length < 6) {
      setErrorMessage('Please enter a valid banking UTR / Transaction reference (at least 6 characters).');
      return;
    }

    setSubmitting(true);
    try {
      let uploadedPath: string | undefined = undefined;
      if (screenshotFile && user) {
        setUploadingImage(true);
        const uploadRes = await uploadPaymentProof(screenshotFile, user.id, targetOrder.order_id);
        setUploadingImage(false);
        if (uploadRes.error) {
          console.warn('Screenshot upload warning:', uploadRes.error);
        } else {
          uploadedPath = uploadRes.path;
        }
      }

      const submitRes = await submitPaymentProof(
        targetOrder.order_id, 
        cleanUtr, 
        transactionReference.trim() || undefined,
        uploadedPath
      );
      
      if (submitRes.error) {
        setErrorMessage(submitRes.error);
      } else {
        const responseMsg = submitRes.data?.message || 'Payment submitted for verification! Your Pro upgrade will be activated within 4 hours.';
        setSuccessMessage(responseMsg);
        setUtrNumber('');
        setTransactionReference('');
        setScreenshotFile(null);
        setScreenshotPreview(null);
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        } catch (e) {}
        await loadHistory();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit payment details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadQr = () => {
    if (!upiQrDataUrl) return;
    const a = document.createElement('a');
    a.href = upiQrDataUrl;
    a.download = `BillKaro_UPI_QR_₹${activeOrder ? activeOrder.amount : selectedPlan.price}.png`;
    a.click();
  };

  const activePendingPayment = userPayments.find(p => p.status === 'PENDING_ADMIN');

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5 fill-indigo-600 dark:fill-indigo-400" />
          <span>GST Suite Pro Upgrade</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Supercharge Your GST Invoicing
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Zero ads, unlimited billing invoices, custom business logo, digital signatures, and 1-click WhatsApp sharing.
        </p>
      </div>

      {/* ACTIVE PREMIUM DASHBOARD */}
      {isPremium && (
        <div className="p-5 sm:p-8 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl text-white shadow-xl space-y-4 border border-blue-500/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-300 shadow-inner shrink-0">
                <Sparkles className="w-6 h-6 fill-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black tracking-tight">BillKaro Pro Active</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase">
                    Ads OFF
                  </span>
                </div>
                <p className="text-xs text-blue-100 mt-0.5">
                  Your business account has full unlimited access to all premium billing tools.
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 backdrop-blur-xs w-full sm:w-auto">
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider block">Valid Until</span>
              <span className="text-sm font-black text-white">
                {subscription?.expiry_date ? new Date(subscription.expiry_date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                }) : 'Active Lifetime'}
              </span>
              {daysRemaining !== null && (
                <div className="text-[10px] font-bold text-amber-300 mt-0.5">
                  ({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining)
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-blue-100 font-medium">
            <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Unlimited Invoices</div>
            <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Custom Logo & Signature</div>
            <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp Sharing</div>
            <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Priority VIP Support</div>
          </div>
        </div>
      )}

      {/* 4-HOUR VERIFICATION CALLOUT */}
      {activePendingPayment && (
        <div className="p-4 sm:p-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/80 rounded-3xl text-amber-950 dark:text-amber-200 text-xs shadow-xs space-y-2">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <p className="font-bold text-amber-900 dark:text-amber-100 text-sm">Payment Under Verification ⏳</p>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                Your payment of <strong className="text-amber-950 dark:text-white">₹{activePendingPayment.amount}</strong> (Order #{activePendingPayment.order_id}, UTR: <span className="font-mono font-bold">{activePendingPayment.utr}</span>) is being verified in our Bank of Baroda account.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold pt-1">
                ⏱️ <strong>SLA Notice:</strong> Premium activation is completed as soon as your transaction is verified, within a maximum verification window of <strong>4 hours</strong>.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <a
                  href={`https://wa.me/919638938258?text=${encodeURIComponent(`Hi BillKaro Support, please check my payment status for Order #${activePendingPayment.order_id} (UTR: ${activePendingPayment.utr || ''}). Account: ${user?.email || ''}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp Billing Desk</span>
                </a>
                <button
                  type="button"
                  onClick={() => navigate('help-support')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                  <span>Help & Support Center</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAN SELECTION CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">1. Select Your Subscription Plan</h3>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">All prices inclusive of GST</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* FREE PLAN */}
          <div 
            onClick={() => handleSelectPlan('free')}
            className={`p-5 rounded-3xl border-2 transition cursor-pointer flex flex-col justify-between ${
              selectedPlanId === 'free' 
                ? 'bg-white dark:bg-slate-900 border-blue-600 shadow-md ring-2 ring-blue-600/20' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Free Starter</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹0</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Basic GST billing</p>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mt-4">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Max 5 invoices / mo</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Up to 2 Business Profiles</li>
                <li className="flex items-center gap-2 text-slate-400"><span>• Ads: ON (Standard)</span></li>
              </ul>
            </div>
          </div>

          {/* MONTHLY PLAN (₹49) */}
          <div 
            onClick={() => handleSelectPlan('monthly')}
            className={`p-5 rounded-3xl border-2 transition cursor-pointer flex flex-col justify-between ${
              selectedPlanId === 'monthly' 
                ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-600 shadow-md ring-2 ring-blue-600/20' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Monthly Pro</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹49 <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ 30 days</span></div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Full Pro billing for 1 month</p>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 mt-4 font-medium">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600" /> Unlimited Invoices</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600" /> <strong>Up to 3 Companies</strong></li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600" /> <strong>Ads completely OFF</strong></li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600" /> Logo & Digital Signature</li>
              </ul>
            </div>
          </div>

          {/* 6 MONTHS PLAN (₹250) */}
          <div 
            onClick={() => handleSelectPlan('six_months')}
            className={`p-5 rounded-3xl border-2 transition cursor-pointer flex flex-col justify-between relative ${
              selectedPlanId === 'six_months' 
                ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-600 shadow-md ring-2 ring-blue-600/20' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
            }`}
          >
            <div className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black rounded-full uppercase">
              Save 15%
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">6 Months Pro</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹250 <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ 180 days</span></div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Half-yearly peace of mind</p>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 mt-4 font-medium">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> All Pro Features</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> <strong>Up to 3 Companies</strong></li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> <strong>Ads completely OFF</strong></li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> 15% Cost Savings</li>
              </ul>
            </div>
          </div>

          {/* YEARLY PLAN (₹470 - BEST VALUE) */}
          <div 
            onClick={() => handleSelectPlan('yearly')}
            className={`p-5 rounded-3xl border-2 transition cursor-pointer flex flex-col justify-between relative overflow-hidden ${
              selectedPlanId === 'yearly' 
                ? 'bg-gradient-to-b from-blue-50 via-white to-white dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 border-blue-600 shadow-xl ring-2 ring-blue-600/30' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
            }`}
          >
            <div className="absolute top-3 right-3 px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase shadow-xs">
              Save 20%
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Yearly Pro</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹470 <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ 365 days</span></div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Full 1 year unlimited access</p>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 mt-4 font-medium">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600" /> Everything in Pro</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600" /> <strong>Up to 4 Companies (Max)</strong></li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600" /> <strong>Ads OFF (365 Days)</strong></li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-600" /> VIP WhatsApp Support</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* DYNAMIC UPI PAYMENT & UTR SUBMISSION WORKFLOW */}
      {selectedPlanId !== 'free' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-8 space-y-6 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
            <div className="flex items-center gap-2.5">
              <QrCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                2. Scan Dynamic UPI QR & Pay ₹{activeOrder ? activeOrder.amount : selectedPlan.price}
              </h3>
            </div>
            {activeOrder && (
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                Order: {activeOrder.order_id}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Dynamic QR Display Box */}
            <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Scan via any UPI App</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  ₹{activeOrder ? activeOrder.amount : selectedPlan.price}
                </div>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                  {selectedPlan.name} ({selectedPlan.durationDays} Days)
                </span>
              </div>

              {/* Dynamic QR Code Canvas/Image */}
              {upiQrDataUrl ? (
                <div className="relative inline-block">
                  <img 
                    src={upiQrDataUrl} 
                    alt="Dynamic UPI QR" 
                    className="w-44 h-44 sm:w-48 sm:h-48 mx-auto rounded-2xl shadow-md bg-white p-2.5 border border-slate-200" 
                  />
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Dynamic QR
                  </span>
                </div>
              ) : (
                <div className="w-44 h-44 sm:w-48 sm:h-48 mx-auto bg-slate-200 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              )}

              {/* UPI Details & Copy Pill */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    {UPI_CONFIG.receiverUpiId}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(UPI_CONFIG.receiverUpiId, 'upi')}
                    className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer flex items-center gap-1 shadow-xs min-h-[36px] min-w-[36px]"
                    title="Copy UPI ID"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <a
                    href={generateUpiUri(activeOrder ? activeOrder.amount : selectedPlan.price, activeOrder?.order_id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer min-h-[40px]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Pay with UPI App</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer min-h-[40px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download QR</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 pt-1">
                  Supports Google Pay • PhonePe • Paytm • BHIM • Cred • Banking UPI
                </p>
              </div>
            </div>

            {/* UTR & Screenshot Submission Form */}
            <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
              <div className="pb-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">3. Submit UTR & Screenshot Proof</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  After completing the transfer, enter your 12-digit UTR reference ID.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  12-Digit UPI / UTR Transaction ID *
                </label>
                <input
                  type="text"
                  required
                  value={utrNumber}
                  onChange={e => setUtrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="e.g. 423589123456"
                  maxLength={24}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Found in your UPI app receipt under UPI Ref ID / UTR Number.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction Reference / Banking ID (Optional)
                </label>
                <input
                  type="text"
                  value={transactionReference}
                  onChange={e => setTransactionReference(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="e.g. TXN102938475"
                  maxLength={32}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Secondary transaction identifier if provided separately by your bank.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Screenshot Proof (Optional but Recommended)
                </label>
                {screenshotPreview ? (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">{screenshotFile?.name || 'Screenshot attached'}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setScreenshotFile(null);
                        setScreenshotPreview(null);
                      }} 
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer shrink-0 ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center justify-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition font-bold text-slate-700 dark:text-slate-200">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>{uploadingImage ? 'Uploading screenshot...' : 'Upload Payment Screenshot (PNG/JPG)'}</span>
                    <input type="file" accept="image/*" onChange={handleScreenshotChange} className="hidden" />
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || creatingOrder}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Payment Proof for Verification</span>
                  </>
                )}
              </button>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Secure 4-Hour Verification Guarantee</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Your payment is securely recorded. As soon as the transaction is confirmed in our bank account, your Pro subscription and ad-free access will be activated automatically.
                </p>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER PAYMENT HISTORY TABLE */}
      {userPayments.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-8 space-y-4 transition-colors">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Your Payment History</h3>
            <button
              onClick={loadHistory}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1 cursor-pointer min-h-[36px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Order ID</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">UTR Reference</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-200">
                {userPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5">
                      {new Date(p.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </td>
                    <td className="py-2.5 font-mono font-bold text-slate-900 dark:text-white">{p.order_id}</td>
                    <td className="py-2.5 uppercase font-bold text-[10px] text-blue-600 dark:text-blue-400">{p.plan_id}</td>
                    <td className="py-2.5 font-bold text-slate-900 dark:text-white">₹{p.amount}</td>
                    <td className="py-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{p.utr || '-'}</td>
                    <td className="py-2.5 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        p.status === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' :
                        p.status === 'REJECTED' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300' :
                        'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
