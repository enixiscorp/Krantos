import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-yellow-400 selection:text-gray-900">
      <Header />
      <main className="pt-16 pb-20">
        <Outlet />
      </main>
      
      {/* Footer-like element or subtle background glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-400/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
};

export default Layout;
