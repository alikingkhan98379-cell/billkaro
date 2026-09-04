import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const NetworkIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    return true;
  });
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {!isOnline ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-full shadow-lg text-xs font-bold border border-rose-500/30 backdrop-blur-md">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>You are currently offline. Check your internet connection.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-full shadow-lg text-xs font-bold border border-emerald-500/30 backdrop-blur-md">
          <Wifi className="w-3.5 h-3.5" />
          <span>Back online! Connection restored.</span>
        </div>
      )}
    </div>
  );
};
