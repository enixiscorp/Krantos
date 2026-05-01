import type { ReactNode } from 'react';
import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  TrendingUp, 
  Package, 
  DollarSign, 
  ShoppingCart, 
  FileText, 
  ShieldCheck, 
  Sparkles, 
  UserPlus,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  Shield
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export default function AdminLayout(props: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  // Navigation items
  const menuItems = [
    { title: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={20} /> },
    { title: 'Vendeurs', path: '/admin/vendors', icon: <Users size={20} /> },
    { title: 'Leads', path: '/admin/leads', icon: <TrendingUp size={20} /> },
    { title: 'Produits', path: '/admin/products', icon: <Package size={20} /> },
    { title: 'Commandes', path: '/admin/orders', icon: <ShoppingCart size={20} /> },
    { title: 'Commissions', path: '/admin/commissions', icon: <DollarSign size={20} /> },
    { title: 'Facturation', path: '/admin/billing', icon: <FileText size={20} /> },
    { title: 'Contrats', path: '/admin/contracts', icon: <ShieldCheck size={20} /> },
    { title: 'Chatbot', path: '/admin/chatbot', icon: <Sparkles size={20} /> },
    { title: 'Utilisateurs', path: '/admin/users', icon: <UserPlus size={20} /> },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Déconnexion réussie');
    navigate('/admin-login');
  };

  // Hide sidebar on login page
  const isLoginPage = location.pathname === '/admin-login';

  return (
    <div className="min-h-screen bg-[#070709] text-white flex overflow-hidden">
      {/* Background Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-400/5 blur-[140px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 blur-[140px] rounded-full pointer-events-none z-0" />

      {!isLoginPage && (
        <motion.aside
          initial={false}
          animate={{ width: isExpanded ? 260 : 80 }}
          onMouseEnter={() => setIsExpanded(true)}
          onMouseLeave={() => setIsExpanded(false)}
          className="relative z-50 flex flex-col bg-black/40 backdrop-blur-xl border-r border-white/5 h-screen transition-all duration-300 ease-in-out group"
        >
          {/* Logo Section */}
          <div className="p-6 mb-4 flex items-center gap-4 overflow-hidden">
            <div className="w-8 h-8 shrink-0 rounded-xl bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/20">
              <Shield className="text-black w-5 h-5" />
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-black text-xl tracking-tighter whitespace-nowrap"
                >
                  KRANTOS <span className="text-yellow-400">PRO</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-4 p-3 rounded-2xl transition-all relative group/item ${
                    isActive 
                      ? 'bg-yellow-400 text-black font-bold' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="shrink-0">{item.icon}</div>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="whitespace-nowrap text-sm"
                      >
                        {item.title}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute left-0 w-1 h-6 bg-black rounded-r-full"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout Section */}
          <div className="p-3 mt-auto border-t border-white/5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 p-3 rounded-2xl text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
            >
              <LogOut size={20} className="shrink-0" />
              <AnimatePresence>
                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="whitespace-nowrap text-sm font-bold"
                  >
                    Déconnexion
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </motion.aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto relative z-10 scroll-smooth">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
