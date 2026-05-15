import React from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import Header from './Header';
import Chatbot from './Chatbot';
import OfflineStatusBar from './OfflineStatusBar';

const Layout: React.FC = () => {
  const { id: vendorIdFromUrl } = useParams();
  const location = useLocation();

  // If we are on a vendor page, use that vendor's chatbot.
  // Otherwise, use a default fallback (Krantos Admin Vendor ID should go here)
  const activeVendorId = vendorIdFromUrl || "6fcb8ba0-d391-40bf-9408-82c7279c4521"; // Placeholder ID, change to actual Krantos Admin ID if needed
  const activeVendorName = vendorIdFromUrl ? "Partenaire Krantos" : "Support Krantos";

  // Don't show chatbot on specific pages if needed
  const hideChatbot = ['/admin', '/admin-login', '/business-login'].some(p => location.pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-yellow-400 selection:text-gray-900 transition-colors duration-300">
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

      {/* Offline status bar — handles sync queue display */}
      <OfflineStatusBar position="bottom" />

      {/* Ambient background glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-400/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
};

export default Layout;
