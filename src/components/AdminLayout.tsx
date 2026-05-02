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
  Shield,
  Menu,
  X,
  Download,
  BellRing
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useEffect } from 'react';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Listen for PWA install prompt
  useState(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  });

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast.info("L'application est déjà installée ou votre navigateur ne supporte pas l'installation directe.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      toast.success('Installation lancée !');
    }
  };

  // Real-time Notifications Listener
  useEffect(() => {
    if (isLoginPage) return;

    const playNotificationSound = () => {
      const audio = new Audio('/notification.mp3'); // Placez un fichier notification.mp3 dans le dossier /public
      audio.play().catch(() => {});
    };

    const showNotification = (title: string, body: string) => {
      if (!("Notification" in window)) return;
      
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: '/favicon.ico' });
        playNotificationSound();
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            new Notification(title, { body, icon: '/favicon.ico' });
            playNotificationSound();
          }
        });
      }
    };

    // Listen for new Leads
    const leadsChannel = supabase
      .channel('admin-leads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        showNotification('Nouveau Lead !', `Un client (${payload.new.user_name}) vient de faire un calcul.`);
        toast.info(`Nouveau Lead: ${payload.new.user_name}`, { icon: <BellRing className="text-yellow-400" /> });
      })
      .subscribe();

    // Listen for new Vendor Signups
    const vendorsChannel = supabase
      .channel('admin-vendors')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vendors' }, (payload) => {
        showNotification('Nouvelle Inscription !', `Le vendeur ${payload.new.name} s'est inscrit.`);
        toast.success(`Nouveau Vendeur: ${payload.new.name}`, { icon: <UserPlus className="text-green-400" /> });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(vendorsChannel);
    };
  }, [isLoginPage]);

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
        <>
          {/* Mobile Header */}
          <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-[60]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center">
                <Shield className="text-black w-5 h-5" />
              </div>
              <span className="font-black tracking-tighter">KRANTOS</span>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Desktop Sidebar & Mobile Drawer */}
          <AnimatePresence mode="wait">
            {(isExpanded || isMobileMenuOpen || window.innerWidth >= 1024) && (
              <motion.aside
                initial={window.innerWidth < 1024 ? { x: -300 } : false}
                animate={window.innerWidth < 1024 ? { x: isMobileMenuOpen ? 0 : -300 } : { width: isExpanded ? 260 : 80 }}
                exit={window.innerWidth < 1024 ? { x: -300 } : undefined}
                onMouseEnter={() => window.innerWidth >= 1024 && setIsExpanded(true)}
                onMouseLeave={() => window.innerWidth >= 1024 && setIsExpanded(false)}
                className={`fixed lg:relative z-50 flex flex-col bg-black/60 lg:bg-black/40 backdrop-blur-2xl lg:backdrop-blur-xl border-r border-white/5 h-screen transition-all duration-300 ease-in-out group shadow-2xl lg:shadow-none ${
                  isMobileMenuOpen ? 'w-[280px]' : ''
                }`}
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

          {/* Bottom Section: Install & Logout */}
          <div className="p-3 mt-auto border-t border-white/5 space-y-1">
            {deferredPrompt && (
              <button
                onClick={handleInstall}
                className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all ${
                  isExpanded || isMobileMenuOpen ? 'bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20' : 'text-yellow-400 hover:bg-white/5'
                }`}
              >
                <Download size={20} className="shrink-0" />
                {(isExpanded || isMobileMenuOpen) && (
                  <span className="whitespace-nowrap text-sm font-black uppercase tracking-widest">Installer l'app</span>
                )}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 p-3 rounded-2xl text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
            >
              <LogOut size={20} className="shrink-0" />
              {(isExpanded || isMobileMenuOpen) && (
                <span className="whitespace-nowrap text-sm font-bold">Déconnexion</span>
              )}
            </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )}

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className={`flex-1 h-screen overflow-y-auto relative z-10 scroll-smooth pt-16 lg:pt-0`}>
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
