// ============================================================
// Krantos Platform — BusinessLogin Page (Premium Dark Overhaul)
// Requirements: 9.1, 9.2, 9.3, 9.4
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Briefcase, Mail, Lock, LogIn, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const BusinessLogin = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Connexion réussie !');
      
      // Determine redirection based on metadata/role
      // For now, check if the email contains "admin" to simulate role check
      if (email.toLowerCase().includes('admin')) {
        navigate('/admin');
      } else {
        navigate('/business-dashboard');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion.';
      toast.error(`Échec de la connexion : ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-10 rounded-[2.5rem] border-white/5 relative overflow-hidden">
          {/* Header Icon */}
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 rounded-3xl bg-yellow-400/10 flex items-center justify-center mb-6 group transition-all hover:scale-110">
              <Briefcase className="w-8 h-8 text-yellow-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Espace vendeur</h1>
            <p className="text-gray-400 text-sm leading-relaxed max-w-[240px]">
              Connectez-vous pour gérer vos produits et vos leads.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 transition-all focus-within:border-yellow-400/50 group">
                <Mail className="w-5 h-5 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
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
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-yellow-400 text-gray-900 font-black text-lg hover:bg-yellow-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-yellow-400/20 disabled:opacity-50 flex items-center justify-center gap-2 accent-glow"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-6 h-6" />
                  Se connecter
                </>
              )}
            </button>
          </form>

          {/* Demo Hint */}
          <div className="mt-10 pt-8 border-t border-white/5 text-center px-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">
              Démo : n'importe quels identifiants fonctionnent.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BusinessLogin;
