import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { BusinessProfile, Subscription } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  businessProfile: BusinessProfile | null;
  subscription: Subscription | null;
  loading: boolean;
  isRateLimited: boolean;
  rateLimitSecondsLeft: number;
  sendOtp: (email: string, businessName?: string) => Promise<{ error?: string }>;
  verifyOtp: (email: string, token: string, businessName?: string) => Promise<{ error?: string }>;
  signInWithPassword: (email: string, pass: string) => Promise<{ error?: string }>;
  signUpWithPassword: (email: string, pass: string, businessName?: string) => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateBusinessProfile: (updates: Partial<BusinessProfile>) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Rate Limiting & Cooldown states
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState<number>(0);

  useEffect(() => {
    let timer: any;
    if (rateLimitSecondsLeft > 0) {
      setIsRateLimited(true);
      timer = setInterval(() => {
        setRateLimitSecondsLeft(prev => {
          if (prev <= 1) {
            setIsRateLimited(false);
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [rateLimitSecondsLeft]);

  const handleFailedAttempt = () => {
    const next = failedAttempts + 1;
    setFailedAttempts(next);
    if (next >= 4) {
      setRateLimitSecondsLeft(60);
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
              email: userEmail || ''
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
    // Check and clean URL hash if it contains auth errors
    if (typeof window !== 'undefined' && window.location.hash) {
      if (window.location.hash.includes('error=')) {
        console.warn('Auth error detected in URL hash. Resetting URL state.');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    // Initial session check
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

  const sendOtp = async (email: string, businessName?: string): Promise<{ error?: string }> => {
    if (isRateLimited) {
      return { error: `Too many attempts. Please wait ${rateLimitSecondsLeft}s before retrying.` };
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          data: businessName ? { business_name: businessName.trim() } : undefined
        }
      });
      if (error) {
        handleFailedAttempt();
        return { error: error.message };
      }
      return {};
    } catch (err: any) {
      handleFailedAttempt();
      return { error: err?.message || 'Failed to send OTP' };
    }
  };

  const verifyOtp = async (email: string, token: string, businessName?: string): Promise<{ error?: string }> => {
    if (isRateLimited) {
      return { error: `Too many attempts. Please wait ${rateLimitSecondsLeft}s.` };
    }
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'email'
      });
      if (error) {
        handleFailedAttempt();
        return { error: error.message };
      }
      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        if (businessName && businessName.trim()) {
          try {
            await supabase.from('business_profile').upsert({
              user_id: data.user.id,
              name: businessName.trim(),
              email: data.user.email || email.trim().toLowerCase(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
          } catch (e) {}
        }
        await fetchProfileAndSubscription(data.user.id, data.user.email);
      }
      return {};
    } catch (err: any) {
      handleFailedAttempt();
      return { error: err?.message || 'Verification failed' };
    }
  };

  const signInWithPassword = async (email: string, pass: string): Promise<{ error?: string }> => {
    if (isRateLimited) {
      return { error: `Too many attempts. Please wait ${rateLimitSecondsLeft}s.` };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass
      });
      if (error) {
        handleFailedAttempt();
        return { error: error.message };
      }
      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        await fetchProfileAndSubscription(data.user.id, data.user.email);
      }
      return {};
    } catch (err: any) {
      handleFailedAttempt();
      return { error: err?.message || 'Invalid credentials' };
    }
  };

  const signUpWithPassword = async (email: string, pass: string, businessName?: string): Promise<{ error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: pass,
        options: {
          data: {
            business_name: businessName || 'My Business'
          }
        }
      });
      if (error) return { error: error.message };
      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        await fetchProfileAndSubscription(data.user.id, data.user.email);
      }
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Sign up failed' };
    }
  };

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin
      });
      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Password reset request failed' };
    }
  };

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
      // Clean undefined fields and upsert explicitly on 'user_id'
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
        sendOtp,
        verifyOtp,
        signInWithPassword,
        signUpWithPassword,
        resetPassword,
        signInWithGoogle,
        signOut,
        updateBusinessProfile,
        refreshProfile
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
