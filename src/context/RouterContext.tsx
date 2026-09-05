import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type AppRoute = 
  | 'dashboard'
  | 'create-invoice'
  | 'invoices'
  | 'customers'
  | 'products'
  | 'business-profile'
  | 'notifications'
  | 'premium'
  | 'privacy-terms'
  | 'admin-payments'
  | 'help-support';

interface RouterContextType {
  currentRoute: AppRoute;
  navigate: (route: AppRoute, replaceState?: boolean) => void;
  intendedRoute: AppRoute | null;
  setIntendedRoute: (route: AppRoute | null) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

const VALID_ROUTES: AppRoute[] = [
  'dashboard',
  'create-invoice',
  'invoices',
  'customers',
  'products',
  'business-profile',
  'notifications',
  'premium',
  'privacy-terms',
  'admin-payments',
  'help-support'
];

function parseCurrentRoute(): AppRoute {
  if (typeof window === 'undefined') return 'dashboard';

  // Check URL Hash first (e.g. #/customers or #customers)
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase().trim();
  if (VALID_ROUTES.includes(hash as AppRoute)) {
    return hash as AppRoute;
  }

  // Check URL Pathname (e.g. /customers)
  const pathname = window.location.pathname.replace(/^\//, '').toLowerCase().trim();
  if (VALID_ROUTES.includes(pathname as AppRoute)) {
    return pathname as AppRoute;
  }

  return 'dashboard';
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => parseCurrentRoute());
  const [intendedRoute, setIntendedRouteState] = useState<AppRoute | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = sessionStorage.getItem('billkaro_intended_route');
    return saved && VALID_ROUTES.includes(saved as AppRoute) ? (saved as AppRoute) : null;
  });

  const setIntendedRoute = useCallback((route: AppRoute | null) => {
    setIntendedRouteState(route);
    if (route) {
      sessionStorage.setItem('billkaro_intended_route', route);
    } else {
      sessionStorage.removeItem('billkaro_intended_route');
    }
  }, []);

  const navigate = useCallback((route: AppRoute, replaceState: boolean = false) => {
    if (!VALID_ROUTES.includes(route)) return;
    
    setCurrentRoute(route);
    const targetHash = `#/${route}`;
    
    if (window.location.hash !== targetHash) {
      if (replaceState) {
        window.history.replaceState(null, '', targetHash);
      } else {
        window.history.pushState(null, '', targetHash);
      }
    }
    
    // Scroll smoothly to top on route change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Listen for browser Back / Forward buttons and manual hash changes
  useEffect(() => {
    const handleLocationChange = () => {
      const route = parseCurrentRoute();
      setCurrentRoute(route);
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);

    // Initial synchronization: ensure hash matches parsed route
    const initialRoute = parseCurrentRoute();
    if (!window.location.hash || window.location.hash !== `#/${initialRoute}`) {
      window.history.replaceState(null, '', `#/${initialRoute}`);
    }

    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  return (
    <RouterContext.Provider value={{ currentRoute, navigate, intendedRoute, setIntendedRoute }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useRouter must be used within a RouterProvider');
  return context;
};
