// ============================================================
// Krantos Platform — BusinessLogin Page (Premium Dark Overhaul)
// Requirements: 9.1, 9.2, 9.3, 9.4
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Briefcase, Mail, Lock, LogIn, Loader2, Building2, Phone, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

const BusinessLogin = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const redirectAfterLogin = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) return;

    // Super admin via profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role === 'super_admin') {
      navigate('/admin', { replace: true });
      return;
    }

    // Staff admins via admin_users (RLS allows only admins to read)
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();

    if (adminUser) {
      navigate('/admin', { replace: true });
      return;
    }

    // Vendors
    navigate('/business-dashboard', { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Connexion réussie !');
      await redirectAfterLogin();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion.';
      toast.error(`Échec de la connexion : ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !category || !phone || !email || !password) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }
    if (password.length < 8) {
      toast.error('Mot de passe : 8 caractères minimum.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/pro-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnon,
        },
        body: JSON.stringify({
          company_name: companyName,
          category,
          phone,
          email,
          password,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      toast.success('Inscription envoyée. Votre compte sera activé après validation.');
      setMode('login');
      setPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création du compte.';
      toast.error(message);
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
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Espace Pro</h1>
            <p className="text-gray-400 text-sm leading-relaxed max-w-[240px]">
              {mode === 'login'
                ? 'Connectez-vous pour gérer vos produits et vos leads.'
                : 'Créez votre compte entreprise (validation requise).'}
            </p>
          </div>

          {/* Switch cards */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                mode === 'signup'
                  ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-200'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 font-black">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                S’inscrire (Pro)
              </div>
              <div className="text-[11px] text-gray-500 font-medium mt-1">Entreprise + email + mot de passe</div>
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                mode === 'login'
                  ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-200'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 font-black">
                <LogIn className="w-4 h-4 text-yellow-400" />
                Se connecter
              </div>
              <div className="text-[11px] text-gray-500 font-medium mt-1">Accès après validation & contrat</div>
            </button>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-6">
            {mode === 'signup' && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 transition-all focus-within:border-yellow-400/50 group">
                    <Building2 className="w-5 h-5 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Nom de l'entreprise"
                      className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 transition-all focus-within:border-yellow-400/50 group">
                    <Briefcase className="w-5 h-5 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
                    <input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Catégorie (ex: Énergie solaire)"
                      className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 transition-all focus-within:border-yellow-400/50 group">
                    <Phone className="w-5 h-5 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Téléphone"
                      className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                      required
                    />
                  </div>
                </div>
              </>
            )}

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
                  {mode === 'login' ? 'Se connecter' : 'Envoyer la demande'}
                </>
              )}
            </button>
          </form>

          {/* Hint */}
          <div className="mt-10 pt-8 border-t border-white/5 text-center px-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">
              Sécurité : aucun mot de passe n’est manipulé côté admin. Validation + contrat + commission se font dans l’interface admin.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BusinessLogin;
