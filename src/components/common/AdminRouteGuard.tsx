import React, { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Zero-Trust Admin Route Guard
 * 
 * Guarantees:
 * 1. Unauthenticated users are redirected to login / dashboard.
 * 2. Authenticated non-admin users are immediately cloaked and redirected to dashboard.
 * 3. ZERO flash of admin page: children are NEVER mounted or rendered until admin authorization is confirmed.
 * 4. ZERO admin queries or network fetches triggered for unauthorized visitors.
 */
export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('dashboard', true);
      } else if (!isAdmin) {
        navigate('dashboard', true);
      }
    }
  }, [user, isAdmin, loading, navigate]);

  // Authorization in-flight: Show minimal neutral verification spinner, never admin UI
  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-slate-500 dark:text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-3" />
        <span className="text-xs font-semibold">Verifying administrative credentials...</span>
      </div>
    );
  }

  // Not authenticated or not an authorized administrator: Render NOTHING
  if (!user || !isAdmin) {
    return null;
  }

  // Authoritative administrator confirmed: Render admin child components
  return <>{children}</>;
};
