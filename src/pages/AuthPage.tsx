import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  RefreshCw, 
  Building2, 
  Lock, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isValidEmail } from '../utils/validators';

export const AuthPage: React.FC = () => {
  const { 
    sendOtp, 
    verifyOtp, 
    signInWithGoogle,
    isRateLimited,
    rateLimitSecondsLeft 
  } = useAuth();

  // Mode: 'signup' | 'signin'
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');

  // Form Fields
  const [businessName, setBusinessName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  
  // OTP flow status: 'input_details' | 'input_otp'
  const [otpStep, setOtpStep] = useState<'input_details' | 'input_otp'>('input_details');
  const [resendSeconds, setResendSeconds] = useState<number>(0);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState<number>(300); // 5 minutes (300 seconds)
  
  // UI states
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Countdown for OTP Resend (30s) and Expiry (5m = 300s)
  useEffect(() => {
    let interval: any;
    if (otpStep === 'input_otp' && otpExpirySeconds > 0) {
      interval = setInterval(() => {
        setOtpExpirySeconds(prev => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpStep, otpExpirySeconds]);

  useEffect(() => {
    let interval: any;
    if (resendSeconds > 0) {
      interval = setInterval(() => {
        setResendSeconds(prev => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendSeconds]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) {
      setErrorMessage(error);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (authMode === 'signup' && !businessName.trim()) {
      setErrorMessage('Please enter your Business or Full Name.');
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid Gmail / Email address.');
      return;
    }

    setLoading(true);
    const { error } = await sendOtp(email, authMode === 'signup' ? businessName : undefined);
    setLoading(false);

    if (error) {
      if (error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('over_email_send_rate_limit')) {
        setErrorMessage('Supabase free email limit reached (max 3-4 emails/hour). To remove this limit, add free Custom SMTP (Resend.com / Brevo.com) in Supabase Dashboard.');
      } else {
        setErrorMessage(error);
      }
    } else {
      setOtpStep('input_otp');
      setResendSeconds(30);
      setOtpExpirySeconds(300); // 5 minutes
      setSuccessMessage('6-digit verification code sent to ' + email + '. Valid for 5 minutes.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (otpExpirySeconds <= 0) {
      setErrorMessage('This OTP has expired. Please click "Resend OTP" to get a new 5-minute code.');
      return;
    }

    if (!otp || otp.trim().length < 6) {
      setErrorMessage('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    const { error } = await verifyOtp(email, otp, authMode === 'signup' ? businessName : undefined);
    setLoading(false);

    if (error) {
      setErrorMessage(error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-2xl shadow-xl mb-4 border border-white/10">
          ?
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          BillKaro
        </h1>
        <p className="mt-1 text-sm text-slate-400 font-medium">
          GST Billing & Invoicing Suite for Indian Businesses
        </p>
      </div>

      {/* Main Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-2xl rounded-3xl border border-slate-100 space-y-6">
          
          {/* 1-CLICK GOOGLE SIGN IN BUTTON */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 text-slate-800 text-sm font-bold rounded-2xl transition shadow-xs flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            {googleLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* OR DIVIDER */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase shrink-0">
              or use gmail otp
            </span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          {/* Mode Switch Tabs: Sign Up vs Sign In */}
          {otpStep === 'input_details' && (
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className={
                  'flex-1 py-2 text-xs font-bold rounded-lg transition ' +
                  (authMode === 'signup'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900')
                }
              >
                Create Account (New User)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className={
                  'flex-1 py-2 text-xs font-bold rounded-lg transition ' +
                  (authMode === 'signin'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900')
                }
              >
                Sign In (Existing)
              </button>
            </div>
          )}

          {/* Rate Limit Alert */}
          {isRateLimited && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Too many login attempts. Cooldown active: {rateLimitSecondsLeft}s</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* STEP 1: Enter Details (Name & Email) */}
          {otpStep === 'input_details' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Your Name or Business / Firm Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      placeholder="e.g. Maaz Star Traders"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Gmail / Business Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isRateLimited}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>
                      {authMode === 'signup' ? 'Send 6-Digit OTP to Register' : 'Send 6-Digit Login Code'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-400">
                A 6-digit OTP code will be sent to your email. Valid for 5 minutes.
              </p>
            </form>
          ) : (
            /* STEP 2: Enter 6-Digit OTP */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center pb-1">
                <p className="text-xs text-slate-600">
                  Enter the 6-digit verification code sent to <br />
                  <span className="font-bold text-slate-900">{email}</span>
                </p>
                {/* 5-Minute Countdown Badge */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-[11px] font-bold mt-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {otpExpirySeconds > 0 
                      ? ('Code expires in: ' + formatTimer(otpExpirySeconds)) 
                      : 'Code expired'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                  6-Digit Security Code (OTP)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="� � � � � �"
                  className="w-full text-center tracking-[0.5em] text-2xl font-black py-3 bg-slate-50 border-2 border-blue-600/30 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading || isRateLimited || otpExpirySeconds <= 0}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  'Verify Code & Continue'
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep('input_details');
                    setOtp('');
                  }}
                  className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                >
                  ? Change Details
                </button>

                <button
                  type="button"
                  disabled={resendSeconds > 0 || loading || isRateLimited}
                  onClick={() => handleSendOtp()}
                  className="text-blue-600 hover:text-blue-800 font-bold disabled:text-slate-400 cursor-pointer"
                >
                  {resendSeconds > 0 ? ('Resend in ' + resendSeconds + 's') : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          {/* Security Guarantee Box */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Bank-grade 256-bit SSL & Supabase RLS Isolated</span>
          </div>
        </div>
      </div>
    </div>
  );
};
