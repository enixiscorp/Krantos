import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface ConnectionContextType {
  isOnline: boolean;
  isForcedOffline: boolean;
  setForcedOffline: (forced: boolean) => void;
  toggleForcedOffline: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isRealOnline, setIsRealOnline] = useState(navigator.onLine);
  const [isForcedOffline, setIsForcedOffline] = useState(() => {
    return localStorage.getItem('krantos-force-offline') === 'true';
  });

  const setForcedOffline = useCallback((forced: boolean) => {
    setIsForcedOffline(forced);
    localStorage.setItem('krantos-force-offline', String(forced));
    if (forced) {
      toast.warning('Mode Hors-ligne activé manuellement.');
    } else if (navigator.onLine) {
      toast.success('Mode En-ligne restauré.');
    }
  }, []);

  const toggleForcedOffline = useCallback(() => {
    setForcedOffline(!isForcedOffline);
  }, [isForcedOffline, setForcedOffline]);

  useEffect(() => {
    const handleOnline = () => setIsRealOnline(true);
    const handleOffline = () => setIsRealOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Effective status is online ONLY if real online AND not forced offline
  const isOnline = isRealOnline && !isForcedOffline;

  return (
    <ConnectionContext.Provider value={{ isOnline, isForcedOffline, setForcedOffline, toggleForcedOffline }}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) throw new Error('useConnection must be used within a ConnectionProvider');
  return context;
};
