import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import Header from './Header';
import Chatbot from './Chatbot';

const Layout: React.FC = () => {
  const { id: vendorIdFromUrl } = useParams();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // If we are on a vendor page, use that vendor's chatbot.
  // Otherwise, use a default fallback (Krantos Admin Vendor ID should go here)
  const activeVendorId = vendorIdFromUrl || "6fcb8ba0-d391-40bf-9408-82c7279c4521"; // Placeholder ID, change to actual Krantos Admin ID if needed
  const activeVendorName = vendorIdFromUrl ? "Partenaire Krantos" : "Support Krantos";

  // Don't show chatbot on specific pages if needed
  const hideChatbot = ['/admin', '/admin-login', '/business-login'].some(p => location.pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-yellow-400 selection:text-gray-900">
      <Header />
      <main className="pt-16 pb-20">
        <Outlet />
      </main>
      
      {!hideChatbot && (
        <Chatbot 
          vendorId={activeVendorId} 
          vendorName={activeVendorName} 
        />
      )}

      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-red-500/20 font-black text-xs uppercase tracking-widest"
          >
            <WifiOff size={16} />
            Mode Hors-ligne : Vos actions seront synchronisées plus tard
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Footer-like element or subtle background glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-400/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
};

export default Layout;
