import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  RefreshCw, 
  Building2, 
  User as UserIcon,
  Lock, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isValidEmail, validateStrongPassword } from '../utils/validators';
import { PasswordStrengthChecker } from '../components/common/PasswordStrengthChecker';

type AuthScreen = 
  | 'login' 
  | 'signup' 
  | 'login_2fa' 
  | 'signup_otp' 
  | 'forgot_email' 
  | 'forgot_reset';

export const AuthPage: React.FC = () => {
  const { 
    signInWithGoogle,
    sendSignupOtp,
    completeSignupWithOtp,
    loginWithPassword,
    verify2FAAndLogin,
    sendForgotPasswordOtp,
    completeForgotPassword,
    isRateLimited,
    rateLimitSecondsLeft 
  } = useAuth();

  // Screen Navigation
  const [screen, setScreen] = useState<AuthScreen>('login');

  // Form Fields
  const [fullName, setFullName] = useState<string>('');
  const [businessName, setBusinessName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  
  // Show / Hide Password Toggles
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Timers
  const [resendSeconds, setResendSeconds] = useState<number>(0);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState<number>(300); // 5 minutes

  // UI State
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [duplicateAccountType, setDuplicateAccountType] = useState<'ALREADY_EXISTS' | 'GOOGLE_EXISTS' | 'EMAIL_EXISTS' | null>(null);

  // OTP Expiry Countdown (5 mins) & Resend Cooldown (30s)
  useEffect(() => {
    let interval: any;
    if (['login_2fa', 'signup_otp', 'forgot_reset'].includes(screen) && otpExpirySeconds > 0) {
      interval = setInterval(() => {
        setOtpExpirySeconds(prev => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [screen, otpExpirySeconds]);

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
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const resetFormState = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setInfoMessage('');
    setDuplicateAccountType(null);
    setOtp('');
  };

  // 1. Google 1-Click Sign In
  const handleGoogleSignIn = async () => {
    resetFormState();
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) setErrorMessage(error);
  };

  // 2. Normal Login / 5+ Days Inactive Check
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    const result = await loginWithPassword(email, password);
    setLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else if (result.requires2FA) {
      // 5+ days inactive -> Switch to 2FA screen
      setScreen('login_2fa');
      setResendSeconds(30);
      setOtpExpirySeconds(300);
      setInfoMessage(result.message || "For your security, since it's been over 5 days, we've sent an 8-character verification code to your email.");
    }
  };

  // 3. Verify 2FA OTP for Inactive Login
  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (otpExpirySeconds <= 0) {
      setErrorMessage('This verification code has expired. Please click Resend OTP.');
      return;
    }
    if (!otp || otp.trim().length < 6) {
      setErrorMessage('Please enter the complete 8-character OTP code.');
      return;
    }

    setLoading(true);
    const result = await verify2FAAndLogin(email, otp);
    setLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    }
  };

  // 4. Signup Step 1: Send Registration OTP (With Server-Side Duplicate Check)
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (!fullName.trim()) {
      setErrorMessage('Please enter your Full Name.');
      return;
    }
    if (!businessName.trim()) {
      setErrorMessage('Please enter your Business or Firm Name.');
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid business email address.');
      return;
    }

    const passCheck = validateStrongPassword(password);
    if (!passCheck.isValid) {
      setErrorMessage('Please meet all strong password requirements before continuing.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-check.');
      return;
    }

    setLoading(true);
    const result = await sendSignupOtp(email, fullName, businessName);
    setLoading(false);

    if (result.error) {
      if (
        result.errorCode === 'ALREADY_EXISTS' || 
        result.errorCode === 'GOOGLE_EXISTS' || 
        result.errorCode === 'EMAIL_EXISTS'
      ) {
        setDuplicateAccountType('ALREADY_EXISTS');
      }
      setErrorMessage(result.error);
    } else {
      setDuplicateAccountType(null);
      setScreen('signup_otp');
      setResendSeconds(30);
      setOtpExpirySeconds(300);
      setSuccessMessage(`8-character verification code sent to ${email}. Valid for 5 minutes.`);
    }
  };

  // 5. Signup Step 2: Verify OTP & Activate Account
  const handleSignupOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (otpExpirySeconds <= 0) {
      setErrorMessage('This verification code has expired. Please request a new code.');
      return;
    }
    if (!otp || otp.trim().length < 6) {
      setErrorMessage('Please enter the complete 8-character OTP code.');
      return;
    }

    setLoading(true);
    const { error } = await completeSignupWithOtp(email, otp, password, fullName, businessName);
    setLoading(false);

    if (error) {
      setErrorMessage(error);
    }
  };

  // 6. Forgot Password Step 1: Send Reset Code
  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    const result = await sendForgotPasswordOtp(email);
    setLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setScreen('forgot_reset');
      setResendSeconds(30);
      setOtpExpirySeconds(300);
      setSuccessMessage(result.message);
    }
  };

  // 7. Forgot Password Step 2: Verify OTP & Set New Password
  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (otpExpirySeconds <= 0) {
      setErrorMessage('This code has expired. Please click Resend Code.');
      return;
    }
    if (!otp || otp.trim().length < 6) {
      setErrorMessage('Please enter the complete 8-character OTP code sent to your email.');
      return;
    }

    const passCheck = validateStrongPassword(password);
    if (!passCheck.isValid) {
      setErrorMessage('Please meet all strong password requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await completeForgotPassword(email, otp, password);
    setLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-2xl shadow-xl mb-3 border border-white/10">
          ⚡
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          BillKaro
        </h1>
        <p className="mt-1 text-sm text-slate-400 font-medium">
          GST Billing & Invoicing Suite for Indian Businesses
        </p>
      </div>

      {/* Main Card */}
      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-2xl rounded-3xl border border-slate-100 space-y-5">
          
          {/* 1-CLICK GOOGLE SIGN IN BUTTON (Always available on main screens) */}
          {(screen === 'login' || screen === 'signup') && (
            <>
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
                  or with email & password
                </span>
                <div className="border-t border-slate-200 w-full" />
              </div>

              {/* Mode Switch Tabs: Sign In vs Sign Up */}
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setScreen('login');
                    resetFormState();
                  }}
                  className={
                    'flex-1 py-2 text-xs font-bold rounded-lg transition ' +
                    (screen === 'login'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900')
                  }
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScreen('signup');
                    resetFormState();
                  }}
                  className={
                    'flex-1 py-2 text-xs font-bold rounded-lg transition ' +
                    (screen === 'signup'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900')
                  }
                >
                  Create Account
                </button>
              </div>
            </>
          )}

          {/* Rate Limit Alert */}
          {isRateLimited && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Account temporarily locked due to repeated failed attempts. Cooldown active: {Math.ceil(rateLimitSecondsLeft / 60)}m ({rateLimitSecondsLeft}s)</span>
            </div>
          )}

          {/* Duplicate Account Alert: Exact friendly message and actions */}
          {duplicateAccountType && (
            <div className="p-4 bg-amber-50 border border-amber-300 text-amber-950 text-xs rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900 text-xs">Email Already Registered</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed font-medium">
                    This email is already registered. Please log in instead.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateAccountType(null);
                    setErrorMessage('');
                    setScreen('login');
                  }}
                  className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Go to Login</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateAccountType(null);
                    setErrorMessage('');
                    setScreen('forgot_email');
                  }}
                  className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                  <span>Forgot Password</span>
                </button>
              </div>
            </div>
          )}

          {/* Standard Error Message */}
          {errorMessage && !duplicateAccountType && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Info / Notice Message */}
          {infoMessage && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 1: NORMAL SIGN IN (EMAIL + PASSWORD)                      */}
          {/* ================================================================ */}
          {screen === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@business.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setScreen('forgot_email');
                      resetFormState();
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
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
                    <span>Sign In to BillKaro</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-400">
                Active users log in instantly. Inactivity for 5+ days triggers a 6-digit 2FA email code.
              </p>
            </form>
          )}

          {/* ================================================================ */}
          {/* SCREEN 2: 2FA OTP VERIFICATION (WHEN INACTIVE FOR 5+ DAYS)       */}
          {/* ================================================================ */}
          {screen === 'login_2fa' && (
            <form onSubmit={handle2FAVerify} className="space-y-4">
              <div className="text-center pb-1">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 mb-2">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">2-Step Security Verification</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Enter the 8-character security code sent to <br />
                  <span className="font-bold text-slate-900">{email}</span>
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs font-bold mt-2">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    {otpExpirySeconds > 0 ? `Code expires in: ${formatTimer(otpExpirySeconds)}` : 'Code expired'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                  8-Character Security Code (OTP)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  required
                  autoFocus
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="• • • • • • • •"
                  className="w-full text-center tracking-[0.3em] text-2xl font-black py-3 bg-slate-50 border-2 border-blue-600/30 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition font-mono uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={loading || isRateLimited || otpExpirySeconds <= 0}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify Code & Access Dashboard'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setScreen('login');
                    resetFormState();
                  }}
                  className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                >
                  ← Back to Login
                </button>

                <button
                  type="button"
                  disabled={resendSeconds > 0 || loading || isRateLimited}
                  onClick={async () => {
                    setLoading(true);
                    await loginWithPassword(email, password);
                    setLoading(false);
                    setResendSeconds(30);
                    setOtpExpirySeconds(300);
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold disabled:text-slate-400 cursor-pointer"
                >
                  {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* SCREEN 3: SIGN UP (NEW ACCOUNT) FORM                             */}
          {/* ================================================================ */}
          {screen === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Rahul Sharma"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Business / Firm Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Sharma Enterprises"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Business Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@business.com"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Create Account Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Real-time Password Strength Checklist */}
                <PasswordStrengthChecker password={password} showChecklist={true} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || isRateLimited}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Send 8-Character Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ================================================================ */}
          {/* SCREEN 4: SIGNUP OTP VERIFICATION                                */}
          {/* ================================================================ */}
          {screen === 'signup_otp' && (
            <form onSubmit={handleSignupOtpVerify} className="space-y-4">
              <div className="text-center pb-1">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 mb-2">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Verify Your Email</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Enter the 8-character activation code sent to <br />
                  <span className="font-bold text-slate-900">{email}</span>
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs font-bold mt-2">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    {otpExpirySeconds > 0 ? `Code expires in: ${formatTimer(otpExpirySeconds)}` : 'Code expired'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                  8-Character Verification Code (OTP)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  required
                  autoFocus
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="• • • • • • • •"
                  className="w-full text-center tracking-[0.3em] text-2xl font-black py-3 bg-slate-50 border-2 border-blue-600/30 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition font-mono uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={loading || isRateLimited || otpExpirySeconds <= 0}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify Code & Activate Account'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setScreen('signup');
                    resetFormState();
                  }}
                  className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                >
                  ← Change Details
                </button>

                <button
                  type="button"
                  disabled={resendSeconds > 0 || loading || isRateLimited}
                  onClick={() => handleSignupSubmit({ preventDefault: () => {} } as any)}
                  className="text-blue-600 hover:text-blue-800 font-bold disabled:text-slate-400 cursor-pointer"
                >
                  {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* SCREEN 5: FORGOT PASSWORD - STEP 1 (EMAIL INPUT)                 */}
          {/* ================================================================ */}
          {screen === 'forgot_email' && (
            <form onSubmit={handleForgotEmailSubmit} className="space-y-4">
              <div className="text-center pb-1">
                <h3 className="text-base font-bold text-slate-900">Reset Account Password</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Enter your registered email and we'll send an 8-character OTP code to verify your identity.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@business.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isRateLimited}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send 8-Character Reset Code'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setScreen('login');
                    resetFormState();
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* SCREEN 6: FORGOT PASSWORD - STEP 2 (ENTER OTP & NEW PASSWORD)    */}
          {/* ================================================================ */}
          {screen === 'forgot_reset' && (
            <form onSubmit={handleForgotResetSubmit} className="space-y-4">
              <div className="text-center pb-1">
                <h3 className="text-base font-bold text-slate-900">Set New Password</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Enter the 8-character OTP sent to <br />
                  <span className="font-bold text-slate-900">{email}</span>
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs font-bold mt-2">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    {otpExpirySeconds > 0 ? `Code expires in: ${formatTimer(otpExpirySeconds)}` : 'Code expired'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 text-center">
                  8-Character OTP Code
                </label>
                <input
                  type="text"
                  maxLength={12}
                  required
                  autoFocus
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="• • • • • • • •"
                  className="w-full text-center tracking-[0.3em] text-2xl font-black py-2.5 bg-slate-50 border-2 border-blue-600/30 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Strong Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthChecker password={password} showChecklist={true} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || isRateLimited || otpExpirySeconds <= 0}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Set New Password & Log In'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setScreen('login');
                    resetFormState();
                  }}
                  className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                >
                  ← Back to Login
                </button>

                <button
                  type="button"
                  disabled={resendSeconds > 0 || loading || isRateLimited}
                  onClick={handleForgotEmailSubmit}
                  className="text-blue-600 hover:text-blue-800 font-bold disabled:text-slate-400 cursor-pointer"
                >
                  {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* Security Guarantee Box */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Bank-grade 256-bit SSL & Supabase RLS Isolated</span>
          </div>
        </div>
      </div>
    </div>
  );
};

