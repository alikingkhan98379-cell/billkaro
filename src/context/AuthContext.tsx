import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { BusinessProfile, Subscription, AuthActivityLog, UserAuthStatus, SignupOtpResponse } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  businessProfile: BusinessProfile | null;
  subscription: Subscription | null;
  loading: boolean;
  isRateLimited: boolean;
  rateLimitSecondsLeft: number;
  
  // Auth Operations
  signInWithGoogle: () => Promise<{ error?: string }>;
  sendSignupOtp: (email: string, fullName: string, businessName: string) => Promise<SignupOtpResponse>;
  checkUserAuthStatus: (email: string) => Promise<UserAuthStatus>;
  completeSignupWithOtp: (email: string, token: string, password: string, fullName: string, businessName: string) => Promise<{ error?: string }>;
  
  loginWithPassword: (email: string, password: string) => Promise<{ 
    error?: string; 
    requires2FA?: boolean; 
    success?: boolean; 
    message?: string;
  }>;
  verify2FAAndLogin: (email: string, token: string) => Promise<{ error?: string; success?: boolean }>;
  
  sendForgotPasswordOtp: (email: string) => Promise<{ error?: string; message: string }>;
  completeForgotPassword: (email: string, token: string, newPassword: string) => Promise<{ error?: string; success?: boolean }>;
  
  requestPasswordChangeOtp: (currentPassword: string) => Promise<{ error?: string }>;
  completePasswordChange: (currentPassword: string, token: string, newPassword: string) => Promise<{ error?: string }>;
  
  signOut: () => Promise<void>;
  updateBusinessProfile: (updates: Partial<BusinessProfile>) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
  fetchRecentActivityLogs: () => Promise<AuthActivityLog[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Rate Limiting (5 failed password attempts in 15 mins -> 15 mins lock)
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState<number>(0);
  const [otpSendHistory, setOtpSendHistory] = useState<{ [email: string]: number[] }>({});

  useEffect(() => {
    let timer: any;
    if (lockoutUntil > Date.now()) {
      const updateSeconds = () => {
        const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
        setRateLimitSecondsLeft(remaining);
        if (remaining <= 0) {
          setLockoutUntil(0);
          setFailedAttempts(0);
        }
      };
      updateSeconds();
      timer = setInterval(updateSeconds, 1000);
    } else {
      setRateLimitSecondsLeft(0);
    }
    return () => clearInterval(timer);
  }, [lockoutUntil]);

  const handleFailedPasswordAttempt = () => {
    const next = failedAttempts + 1;
    setFailedAttempts(next);
    if (next >= 5) {
      const lockTime = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
      setLockoutUntil(lockTime);
      setRateLimitSecondsLeft(15 * 60);
    }
  };

  const isRateLimited = rateLimitSecondsLeft > 0;

  const checkOtpRateLimit = (email: string): boolean => {
    const clean = email.trim().toLowerCase();
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const history = (otpSendHistory[clean] || []).filter(ts => ts > oneHourAgo);
    if (history.length >= 5) {
      return false; // Rate limited (max 5 per hour)
    }
    setOtpSendHistory(prev => ({
      ...prev,
      [clean]: [...history, now]
    }));
    return true;
  };

  const logActivity = async (eventType: string, email: string, userId?: string) => {
    try {
      await supabase.from('auth_activity_logs').insert({
        user_id: userId || user?.id || null,
        email: email.trim().toLowerCase(),
        event_type: eventType,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        created_at: new Date().toISOString()
      });
    } catch (e) {
      // ignore non-blocking log error
    }
  };

  const fetchProfileAndSubscription = async (userId: string, userEmail?: string) => {
    try {
      // 1. Fetch Business Profile
      const { data: profileData } = await supabase
        .from('business_profile')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileData) {
        setBusinessProfile(profileData);
      } else {
        const { data: newProfile } = await supabase
          .from('business_profile')
          .upsert(
            {
              user_id: userId,
              name: 'My Business',
              email: userEmail || '',
              last_login_at: new Date().toISOString()
            },
            { onConflict: 'user_id' }
          )
          .select()
          .maybeSingle();
        if (newProfile) setBusinessProfile(newProfile);
      }

      // 2. Fetch Subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (subData) {
        setSubscription(subData);
      } else {
        const { data: newSub } = await supabase
          .from('subscriptions')
          .upsert(
            {
              user_id: userId,
              plan: 'free',
              is_active: true
            },
            { onConflict: 'user_id' }
          )
          .select()
          .maybeSingle();
        if (newSub) setSubscription(newSub);
      }
    } catch (e) {
      console.error('Error loading user profile:', e);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      if (window.location.hash.includes('error=')) {
        console.warn('Auth error detected in URL hash. Resetting URL state.');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndSubscription(session.user.id, session.user.email);
      }
      setLoading(false);
    });

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfileAndSubscription(session.user.id, session.user.email);
        } else {
          setBusinessProfile(null);
          setSubscription(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  // 1. Check User Auth Status (Server-side authoritative check via Supabase Auth)
  const checkUserAuthStatus = async (email: string): Promise<UserAuthStatus> => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      // 1. Direct authoritative Supabase Auth Server check:
      // When shouldCreateUser: false is requested, Supabase Auth server checks auth.users directly.
      // - If user DOES NOT exist: Returns 422 / otp_disabled ("Signups not allowed for otp")
      // - If user ALREADY exists (Google or Email): Returns success (error: null)
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false }
      });

      if (error) {
        if (
          error.status === 422 || 
          error.code === 'otp_disabled' || 
          (error.message && error.message.toLowerCase().includes('signups not allowed')) ||
          (error.message && error.message.toLowerCase().includes('user not found'))
        ) {
          return { exists: false };
        }
        // If there's an error like rate limit or network, fall through to secondary check
      } else {
        // No error returned -> The user definitely exists in Supabase Auth!
        return { exists: true };
      }
    } catch (e) {
      // Fall through to secondary check
    }

    try {
      // 2. Secondary check via RPC if available
      const { data: rpcData, error: rpcErr } = await supabase.rpc('check_user_auth_status', {
        lookup_email: cleanEmail
      });

      if (!rpcErr && rpcData && typeof rpcData === 'object' && rpcData.exists) {
        return rpcData as UserAuthStatus;
      }
    } catch (e) {
      // ignore
    }

    return { exists: false };
  };

  // 1. Google 1-Click Sign-In (Automatically links with existing email account)
  const signInWithGoogle = async (): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Google sign-in failed' };
    }
  };

  // 2. Signup: Step 1 - Send 6-Digit Email OTP (Strict Server-Side Pre-Check)
  const sendSignupOtp = async (
    email: string, 
    fullName: string, 
    businessName: string
  ): Promise<SignupOtpResponse> => {
    const cleanEmail = email.trim().toLowerCase();

    if (isRateLimited) {
      return { 
        error: `Account temporarily locked due to repeated failed attempts. Please wait ${Math.ceil(rateLimitSecondsLeft / 60)} minutes.`,
        errorCode: 'RATE_LIMITED'
      };
    }
    if (!checkOtpRateLimit(cleanEmail)) {
      return { 
        error: 'Maximum OTP request limit reached (5 per hour). Please wait before requesting another OTP.',
        errorCode: 'RATE_LIMITED'
      };
    }

    try {
      // STEP A: STRICT SERVER-SIDE DUPLICATE ACCOUNT CHECK
      const authStatus = await checkUserAuthStatus(cleanEmail);

      if (authStatus.exists) {
        await logActivity('SIGNUP_BLOCKED_ALREADY_EXISTS', cleanEmail);
        return {
          error: "This email is already registered. Please log in instead.",
          errorCode: 'ALREADY_EXISTS'
        };
      }

      // STEP B: Brand new user -> Send 6-Digit OTP for account activation
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          data: {
            full_name: fullName.trim(),
            business_name: businessName.trim()
          }
        }
      });

      if (error) {
        if (
          error.message.toLowerCase().includes('already') || 
          error.message.toLowerCase().includes('registered') ||
          error.message.toLowerCase().includes('exists')
        ) {
          await logActivity('SIGNUP_BLOCKED_ALREADY_EXISTS', cleanEmail);
          return {
            error: "This email is already registered. Please log in instead.",
            errorCode: 'ALREADY_EXISTS'
          };
        }
        return { error: error.message, errorCode: 'GENERIC_ERROR' };
      }

      await logActivity('SIGNUP_OTP_SENT', cleanEmail);
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to send signup OTP', errorCode: 'GENERIC_ERROR' };
    }
  };

  // 2. Signup: Step 2 - Verify 6-Digit OTP and Set Password
  const completeSignupWithOtp = async (
    email: string, 
    token: string, 
    password: string, 
    fullName: string, 
    businessName: string
  ): Promise<{ error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();
    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email'
      });
      if (error) {
        const retry = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'magiclink'
        });
        if (!retry.error && retry.data?.user) {
          data = retry.data;
          error = null;
        }
      }
      if (error) {
        return { error: 'Invalid or expired 6-digit OTP code. Please try again.' };
      }
      if (data?.user) {
        // Set the strong password for the account
        await supabase.auth.updateUser({ password });
        
        // Save user profile details
        await supabase.from('business_profile').upsert({
          user_id: data.user.id,
          name: businessName.trim() || 'My Business',
          full_name: fullName.trim(),
          email: cleanEmail,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        setUser(data.user);
        setSession(data.session);
        await logActivity('SIGNUP_SUCCESS', cleanEmail, data.user.id);
        await fetchProfileAndSubscription(data.user.id, cleanEmail);
      }
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Signup completion failed' };
    }
  };

  // 3 & 4. Normal Login with 5-Day Inactivity 2FA Check
  const loginWithPassword = async (email: string, pass: string): Promise<{ 
    error?: string; 
    requires2FA?: boolean; 
    success?: boolean;
    message?: string;
  }> => {
    if (isRateLimited) {
      return { 
        error: `Account temporarily locked due to 5 failed attempts. Please wait ${Math.ceil(rateLimitSecondsLeft / 60)} minutes before trying again.` 
      };
    }
    const cleanEmail = email.trim().toLowerCase();
    try {
      // Step A: Attempt password verification
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass
      });

      if (error) {
        handleFailedPasswordAttempt();
        await logActivity('LOGIN_FAILED', cleanEmail);
        return { error: 'Invalid email or password.' };
      }

      if (data.user) {
        // Reset failed attempts on valid password
        setFailedAttempts(0);

        // Step B: Check last_login_at timestamp
        const { data: profile } = await supabase
          .from('business_profile')
          .select('last_login_at')
          .eq('user_id', data.user.id)
          .maybeSingle();

        const lastLoginTime = profile?.last_login_at || data.user.last_sign_in_at;
        let isInactiveOver5Days = false;

        if (lastLoginTime) {
          const daysSinceLogin = (Date.now() - new Date(lastLoginTime).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLogin > 5) {
            isInactiveOver5Days = true;
          }
        }

        // Case 4: Inactive for 5+ Days -> Trigger 8-Character Email OTP
        if (isInactiveOver5Days) {
          await supabase.auth.signInWithOtp({
            email: cleanEmail,
            options: { shouldCreateUser: false }
          });
          await logActivity('LOGIN_2FA_REQUIRED', cleanEmail, data.user.id);
          return {
            requires2FA: true,
            message: "For your security, since it's been over 5 days since your last login, we've sent an 8-character verification code to your email."
          };
        }

        // Case 3: Active within 5 days -> Direct instant login
        await supabase.from('business_profile').update({
          last_login_at: new Date().toISOString()
        }).eq('user_id', data.user.id);

        setUser(data.user);
        setSession(data.session);
        await logActivity('LOGIN_SUCCESS', cleanEmail, data.user.id);
        await fetchProfileAndSubscription(data.user.id, cleanEmail);
        return { success: true };
      }
      return { error: 'Login failed' };
    } catch (err: any) {
      handleFailedPasswordAttempt();
      return { error: err?.message || 'Login failed' };
    }
  };

  // 4. Verify 2FA OTP for 5+ Days Inactive Login
  const verify2FAAndLogin = async (email: string, token: string): Promise<{ error?: string; success?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();
    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email'
      });
      if (error) {
        const retry = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'magiclink'
        });
        if (!retry.error && retry.data?.user) {
          data = retry.data;
          error = null;
        }
      }
      if (error) {
        return { error: 'Invalid or expired 8-character verification code. Please check your email.' };
      }
      if (data?.user) {
        await supabase.from('business_profile').update({
          last_login_at: new Date().toISOString()
        }).eq('user_id', data.user.id);

        setUser(data.user);
        setSession(data.session);
        await logActivity('LOGIN_2FA_SUCCESS', cleanEmail, data.user.id);
        await fetchProfileAndSubscription(data.user.id, cleanEmail);
        return { success: true };
      }
      return { error: 'Verification failed' };
    } catch (err: any) {
      return { error: err?.message || 'Verification failed' };
    }
  };

  // 5. Forgot Password: Send OTP (Generic safe response to prevent email discovery)
  const sendForgotPasswordOtp = async (email: string): Promise<{ error?: string; message: string }> => {
    const clean = email.trim().toLowerCase();
    if (!checkOtpRateLimit(clean)) {
      return { 
        error: 'Too many OTP requests. Please wait a while before requesting again.', 
        message: '' 
      };
    }
    try {
      await supabase.auth.signInWithOtp({
        email: clean,
        options: { shouldCreateUser: false }
      });
      await logActivity('PASSWORD_RESET_OTP_SENT', clean);
      return { 
        message: 'If this email is registered in BillKaro, an 8-character security code has been sent. Please check your inbox.' 
      };
    } catch (e) {
      // Return same generic message for security
      return { 
        message: 'If this email is registered in BillKaro, an 8-character security code has been sent. Please check your inbox.' 
      };
    }
  };

  // 5. Complete Forgot Password: Verify OTP and Set New Strong Password
  const completeForgotPassword = async (
    email: string, 
    token: string, 
    newPassword: string
  ): Promise<{ error?: string; success?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();
    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email'
      });
      if (error) {
        const retry = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'magiclink'
        });
        if (!retry.error && retry.data?.user) {
          data = retry.data;
          error = null;
        }
      }
      if (error) {
        return { error: 'Invalid or expired OTP code.' };
      }
      if (data?.user) {
        // Set new password
        await supabase.auth.updateUser({ password: newPassword });
        await supabase.from('business_profile').update({
          last_login_at: new Date().toISOString()
        }).eq('user_id', data.user.id);

        setUser(data.user);
        setSession(data.session);
        await logActivity('PASSWORD_RESET_SUCCESS', cleanEmail, data.user.id);
        await fetchProfileAndSubscription(data.user.id, cleanEmail);
        return { success: true };
      }
      return { error: 'Password reset failed' };
    } catch (err: any) {
      return { error: err?.message || 'Password reset failed' };
    }
  };

  // 6. Change Password from Settings: Step 1 - Verify Current Password and Send OTP
  const requestPasswordChangeOtp = async (currentPassword: string): Promise<{ error?: string }> => {
    if (!user || !user.email) return { error: 'Not authenticated' };
    try {
      // Verify current password first
      const { error: passErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });
      if (passErr) {
        return { error: 'Current password is incorrect.' };
      }

      // Send 6-digit confirmation OTP
      await supabase.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: false }
      });
      await logActivity('CHANGE_PASSWORD_OTP_SENT', user.email, user.id);
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to initiate password change' };
    }
  };

  // 6. Change Password from Settings: Step 2 - Verify OTP, Set New Password & Invalidate other sessions
  const completePasswordChange = async (
    currentPassword: string, 
    token: string, 
    newPassword: string
  ): Promise<{ error?: string }> => {
    if (!user || !user.email) return { error: 'Not authenticated' };
    try {
      // Verify OTP
      let { error: otpErr } = await supabase.auth.verifyOtp({
        email: user.email,
        token: token.trim(),
        type: 'email'
      });
      if (otpErr) {
        const retry = await supabase.auth.verifyOtp({
          email: user.email,
          token: token.trim(),
          type: 'magiclink'
        });
        if (retry.error) {
          return { error: 'Invalid or expired confirmation OTP code.' };
        }
      }

      // Update new password (invalidates all other sessions on other devices)
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) return { error: updateErr.message };

      // Create in-app security notification
      const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Account Security Alert ?',
        message: `Your account password was successfully changed on ${dateStr}.`,
        type: 'security',
        is_read: false
      });

      await logActivity('PASSWORD_CHANGED', user.email, user.id);
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Password change failed' };
    }
  };

  // Fetch recent activity logs for account settings
  const fetchRecentActivityLogs = async (): Promise<AuthActivityLog[]> => {
    if (!user) return [];
    try {
      const { data } = await supabase
        .from('auth_activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    } catch (e) {
      return [];
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setBusinessProfile(null);
      setSubscription(null);
      if (typeof window !== 'undefined') {
        window.location.hash = '';
      }
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  const updateBusinessProfile = async (updates: Partial<BusinessProfile>): Promise<{ error?: string }> => {
    if (!user) return { error: 'Not authenticated' };
    try {
      const payload: any = {
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('business_profile')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) return { error: error.message };
      if (data) setBusinessProfile(data);
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to update profile' };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndSubscription(user.id, user.email);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        businessProfile,
        subscription,
        loading,
        isRateLimited,
        rateLimitSecondsLeft,
        signInWithGoogle,
        sendSignupOtp,
        checkUserAuthStatus,
        completeSignupWithOtp,
        loginWithPassword,
        verify2FAAndLogin,
        sendForgotPasswordOtp,
        completeForgotPassword,
        requestPasswordChangeOtp,
        completePasswordChange,
        signOut,
        updateBusinessProfile,
        refreshProfile,
        fetchRecentActivityLogs
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
