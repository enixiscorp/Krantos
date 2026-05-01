// ============================================================
// Krantos Platform — BusinessLogin Page (Premium Dark Overhaul)
// Requirements: 9.1, 9.2, 9.3, 9.4
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Briefcase, Mail, Lock, LogIn, Loader2, Building2, Phone, Sparkles, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AnimatePresence } from 'framer-motion';

const BusinessLogin = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [contractDuration, setContractDuration] = useState(12);
  const [subscriptionType, setSubscriptionType] = useState('free');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-transparent' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    
    if (score <= 1) return { score, label: 'Très Faible', color: 'bg-red-500' };
    if (score === 2) return { score, label: 'Moyen', color: 'bg-yellow-500' };
    if (score === 3) return { score, label: 'Fort', color: 'bg-green-500' };
    return { score, label: 'Excellent', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

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
          'Authorization': `Bearer ${supabaseAnon}`,
          'apikey': supabaseAnon,
        },
        body: JSON.stringify({
          company_name: companyName,
          category,
          phone,
          email,
          password,
          contract_duration: contractDuration,
          subscription_type: subscriptionType,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      toast.success('Inscription envoyée avec succès !');
      setShowSuccessModal(true);
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
          {/* Header Icon ... remains same ... */}
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black px-1">Durée Contrat</label>
                    <select
                      value={contractDuration}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setContractDuration(val);
                        if (val === 0.5) setSubscriptionType('free');
                        else if (val === 1 || val === 3) setSubscriptionType('basic');
                        else if (val === 6 || val === 12) setSubscriptionType('premium');
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-sm focus:border-yellow-400/50 outline-none appearance-none cursor-pointer"
                    >
                      <option value={0.5} className="bg-gray-900 text-white">14 jours (Démo)</option>
                      <option value={1} className="bg-gray-900 text-white">1 mois</option>
                      <option value={3} className="bg-gray-900 text-white">3 mois</option>
                      <option value={6} className="bg-gray-900 text-white">6 mois</option>
                      <option value={12} className="bg-gray-900 text-white">12 mois</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black px-1">Type Offre (Auto)</label>
                    <div className="w-full bg-white/10 border border-white/10 rounded-2xl px-5 py-3 text-yellow-400 font-bold text-sm">
                      {subscriptionType === 'free' ? 'Démo' : subscriptionType === 'basic' ? 'Basic' : 'Premium'}
                    </div>
                  </div>
                </div>
              </>
            )}

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

            <div className="space-y-3">
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
              
              {mode === 'signup' && password.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-2"
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Sécurité : {strength.label}</span>
                    <span className="text-[8px] font-medium text-gray-600 uppercase tracking-tighter">Lettres + Chiffres + Symboles</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div 
                        key={step}
                        className={`h-full flex-1 transition-all duration-500 ${step <= strength.score ? strength.color : 'bg-transparent'}`}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

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

          <div className="mt-10 pt-8 border-t border-white/5 text-center px-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">
              Krantos Professionnel — Validation sous 24/48h.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Success Modal Overlay */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm glass-card p-8 rounded-[2.5rem] border-white/10 text-center relative overflow-hidden"
            >
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-500/20 blur-[60px] rounded-full" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-yellow-400/20 blur-[60px] rounded-full" />
              
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                
                <h2 className="text-2xl font-black text-white mb-4 tracking-tight">Inscription reçue !</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                  Votre demande pour <span className="text-white font-semibold">{companyName}</span> a été transmise avec succès.
                  <br /><br />
                  Un administrateur Krantos examinera votre dossier sous peu pour activer votre contrat.
                </p>
                
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setMode('login');
                  }}
                  className="w-full h-12 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-all active:scale-[0.98]"
                >
                  Continuer vers la connexion
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusinessLogin;
