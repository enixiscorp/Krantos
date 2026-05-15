import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useConnection } from '../context/ConnectionContext';
import { motion } from 'framer-motion';

const OfflineToggle = () => {
  const { isForcedOffline, toggleForcedOffline } = useConnection();

  return (
    <button
      onClick={toggleForcedOffline}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${
        isForcedOffline 
          ? 'bg-red-500/10 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
          : 'bg-green-500/10 border-green-500/20 text-green-500 hover:border-green-500/40'
      }`}
      title={isForcedOffline ? "Désactiver le mode hors-ligne forcé" : "Activer le mode hors-ligne forcé"}
    >
      <div className="relative">
        {isForcedOffline ? <WifiOff size={14} /> : <Wifi size={14} />}
        {!isForcedOffline && (
          <motion.span 
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-green-500 rounded-full"
          />
        )}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">
        {isForcedOffline ? 'Offline' : 'Online'}
      </span>
    </button>
  );
};

export default OfflineToggle;
