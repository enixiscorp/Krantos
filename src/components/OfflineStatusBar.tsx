import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { useOnlineSync } from '../hooks/useOnlineSync';
import { useConnection } from '../context/ConnectionContext';

interface OfflineStatusBarProps {
  position?: 'top' | 'bottom';
}

const OfflineStatusBar: React.FC<OfflineStatusBarProps> = ({ position = 'bottom' }) => {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOnlineSync();
  const { isForcedOffline } = useConnection();

  if (isOnline && pendingCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: position === 'bottom' ? 100 : -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: position === 'bottom' ? 100 : -100, opacity: 0 }}
        className={`fixed ${position === 'bottom' ? 'bottom-6' : 'top-20'} left-1/2 -translate-x-1/2 z-[300] w-[calc(100%-2rem)] max-w-md`}
      >
        <div className={`glass p-4 rounded-2xl flex items-center justify-between gap-4 shadow-2xl ${isOnline ? 'border-blue-500/20' : 'border-red-500/20'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>
              {!isOnline ? <WifiOff className="w-5 h-5" /> : <Database className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-foreground">
                {isForcedOffline ? 'Mode Hors-ligne forcé' : !isOnline ? 'Vous êtes hors-ligne' : 'Synchronisation'}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold">
                {pendingCount > 0 
                  ? `${pendingCount} action${pendingCount > 1 ? 's' : ''} en attente` 
                  : isOnline ? 'Caches à jour' : 'Mode dégradé activé'}
              </p>
            </div>
          </div>

          {isOnline && pendingCount > 0 && (
            <button
              onClick={() => syncNow()}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50"
            >
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  Sync
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OfflineStatusBar;
