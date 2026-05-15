// ============================================================
// Krantos Platform — AdminLogin (super_admin + admin staff)
// Supporte la connexion hors-ligne via session mise en cache.
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Shield, Mail, Lock, LogIn, Loader2, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adminSessionStore } from '../lib/offlineDB';

const AdminLogin = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineSession, setOfflineSession] = useState<{
    email: string;
    role: string;
  } | null>(null);

  // Check for cached admin session (allows offline access)
  useEffect(() => {
    const checkOfflineSession = async () => {
      const cached = await adminSessionStore.get();
      if (cached) setOfflineSession(cached);
    };
    checkOfflineSession();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const redirectIfAdmin = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const uid = sessionData.session.user.id;
      const userEmail = sessionData.session.user.email ?? '';

      // Force access for the main admin email
      if (userEmail === 'contacteccorp@gmail.com') {
        // Cache session for offline access
        await adminSessionStore.set({ userId: uid, email: userEmail, role: 'super_admin' });
        navigate('/admin', { replace: true });
        return;
      }

      // Standard check for others
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle();

      if (profile?.role === 'super_admin' || profile?.role === 'admin') {
        await adminSessionStore.set({ userId: uid, email: userEmail, role: profile.role });
        navigate('/admin', { replace: true });
        return;
      }

      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('auth_user_id', uid)
        .maybeSingle();

      if (adminUser) {
        await adminSessionStore.set({ userId: uid, email: userEmail, role: 'admin' });
        navigate('/admin', { replace: true });
        return;
      }

      toast.error('Accès restreint aux administrateurs.');
    } catch (err) {
      console.error('Redirection error:', err);
      navigate('/admin', { replace: true }); // Fallback attempt
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Connexion admin réussie.');
      await redirectIfAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  };

  // Offline bypass: use cached session
  const handleOfflineAccess = () => {
    if (offlineSession) {
      navigate('/admin', { replace: true });
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-yellow-400/10 blur-[110px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-10 rounded-[2.5rem] border-white/5 relative overflow-hidden">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 rounded-3xl bg-yellow-400/10 flex items-center justify-center mb-6">
              <Shield className="w-8 h-8 text-yellow-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Connexion Admin</h1>
            <p className="text-gray-400 text-sm leading-relaxed max-w-[280px]">
              Réservé au super admin et aux administrateurs staff.
            </p>
          </div>

          {/* Offline Banner with cached session */}
          {!isOnline && offlineSession && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <WifiOff size={14} className="text-blue-400 flex-shrink-0" />
                <span className="text-blue-300 text-xs font-bold">Session locale disponible</span>
              </div>
              <p className="text-blue-400/70 text-[11px] leading-relaxed">
                Dernière session : <strong className="text-blue-300">{offlineSession.email}</strong>
              </p>
              <button
                onClick={handleOfflineAccess}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all"
              >
                <Shield size={14} /> Accéder sans connexion
              </button>
            </motion.div>
          )}

          {/* Offline Banner without cached session */}
          {!isOnline && !offlineSession && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20"
            >
              <div className="flex items-center gap-2 mb-1">
                <WifiOff size={14} className="text-red-400 flex-shrink-0" />
                <span className="text-red-300 text-xs font-bold">Vous êtes hors-ligne</span>
              </div>
              <p className="text-red-400/70 text-[11px] leading-relaxed">
                Connectez-vous à internet pour accéder au panneau admin, ou connectez-vous d'abord en ligne pour activer l'accès hors-ligne.
              </p>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 transition-all focus-within:border-yellow-400/50 group">
              <Mail className="w-5 h-5 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@email.com"
                className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                required
              />
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 transition-all focus-within:border-yellow-400/50 group">
              <Lock className="w-5 h-5 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !isOnline}
              className="w-full h-14 rounded-2xl bg-yellow-400 text-gray-900 font-black text-lg hover:bg-yellow-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-yellow-400/20 disabled:opacity-50 flex items-center justify-center gap-2 accent-glow"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (<><LogIn className="w-6 h-6" />Se connecter</>)}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;

