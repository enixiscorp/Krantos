// ============================================================
// Krantos Platform — OfflineStatusBar Component
// Bandeau animé affiché quand hors-ligne, avec compteur
// d'actions en attente et bouton de synchronisation.
// ============================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw, Clock } from 'lucide-react';
import { useOnlineSync } from '../hooks/useOnlineSync';

interface OfflineStatusBarProps {
  /** Si true, affiché en haut de page plutôt qu'en bas */
  position?: 'top' | 'bottom';
}

const OfflineStatusBar: React.FC<OfflineStatusBarProps> = ({ position = 'bottom' }) => {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOnlineSync();

  const positionClasses =
    position === 'top'
      ? 'top-0 left-0 right-0 rounded-b-2xl'
      : 'bottom-6 left-1/2 -translate-x-1/2 rounded-2xl';

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          key="offline-bar"
          initial={{ opacity: 0, y: position === 'top' ? -40 : 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'top' ? -40 : 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed z-[300] flex items-center gap-3 px-5 py-3 shadow-2xl backdrop-blur-xl ${positionClasses}`}
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(185,28,28,0.95) 100%)',
            boxShadow: '0 8px 32px rgba(239,68,68,0.3)',
          }}
        >
          {/* Icon */}
          <div className="flex-shrink-0">
            <WifiOff size={16} className="text-white" />
          </div>

          {/* Text */}
          <div className="flex flex-col min-w-0">
            <span className="text-white font-black text-xs uppercase tracking-widest leading-tight">
              Mode Hors-ligne
            </span>
            {pendingCount > 0 && (
              <span className="text-red-200 text-[10px] font-semibold leading-tight flex items-center gap-1">
                <Clock size={9} />
                {pendingCount} action{pendingCount > 1 ? 's' : ''} en attente
              </span>
            )}
          </div>

          {/* Sync button (only if there are pending actions) */}
          {pendingCount > 0 && (
            <button
              onClick={syncNow}
              disabled={isSyncing}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Sync...' : 'Sync'}
            </button>
          )}
        </motion.div>
      )}

      {/* Brief "back online" confirmation */}
      {isOnline && isSyncing && (
        <motion.div
          key="syncing-bar"
          initial={{ opacity: 0, y: position === 'top' ? -40 : 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'top' ? -40 : 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed z-[300] flex items-center gap-3 px-5 py-3 shadow-2xl backdrop-blur-xl ${positionClasses}`}
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.95) 0%, rgba(21,128,61,0.95) 100%)',
            boxShadow: '0 8px 32px rgba(34,197,94,0.3)',
          }}
        >
          <Wifi size={16} className="text-white" />
          <span className="text-white font-black text-xs uppercase tracking-widest">
            Connexion rétablie · Synchronisation...
          </span>
          <RefreshCw size={14} className="text-white animate-spin flex-shrink-0" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineStatusBar;
