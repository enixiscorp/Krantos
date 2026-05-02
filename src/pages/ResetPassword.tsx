import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Lock, Loader2, ShieldCheck, ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    // Supabase sends reset links with tokens in the URL hash:
    // /reset-password#access_token=XXX&refresh_token=YYY&type=recovery
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const type = params.get('type');

    if (access_token && refresh_token && type === 'recovery') {
      supabase.auth.setSession({ access_token, refresh_token })
        .then(({ error }) => {
          if (error) {
            toast.error("Lien invalide ou expiré. Demandez un nouveau lien.");
            navigate('/business-login');
          } else {
            setReady(true);
            window.history.replaceState(null, '', window.location.pathname);
          }
        });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true);
        } else {
          toast.error("Lien invalide ou expiré. Demandez un nouveau lien.");
          navigate('/business-login');
        }
      });
    }
  }, [navigate]);

  const getStrength = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const strength = getStrength(password);
  const strengthColors = ['bg-transparent', 'bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-500'];
  const strengthLabels = ['', 'Faible', 'Moyen', 'Fort', 'Excellent'];

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 8) {
      toast.error('Mot de passe : 8 caractères minimum.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate('/business-login'), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-400/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-10 rounded-[2.5rem] border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500" />

          {done ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-3">Mot de passe mis à jour !</h2>
              <p className="text-gray-400 text-sm mb-6">Redirection vers la connexion...</p>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 3, ease: 'linear' }} className="h-full bg-yellow-400" />
              </div>
            </motion.div>
          ) : !ready ? (
            <div className="text-center py-12">
              <Loader2 className="w-10 h-10 text-yellow-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Vérification du lien en cours...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center mb-10">
                <div className="w-16 h-16 rounded-3xl bg-yellow-400/10 flex items-center justify-center mb-6">
                  <ShieldCheck className="w-8 h-8 text-yellow-400" />
                </div>
                <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Nouveau mot de passe</h1>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Choisissez un mot de passe sécurisé.
                </p>
              </div>

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus-within:border-yellow-400/50 group transition-all">
                    <Lock className="w-5 h-5 text-gray-500 group-focus-within:text-yellow-400 transition-colors flex-shrink-0" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nouveau mot de passe"
                      className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                      required
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="text-gray-600 hover:text-gray-400">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 px-1">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4].map(s => (
                          <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= strength ? strengthColors[strength] : 'bg-white/10'}`} />
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{strengthLabels[strength]}</p>
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus-within:border-yellow-400/50 group transition-all">
                  <Lock className="w-5 h-5 text-gray-500 group-focus-within:text-yellow-400 transition-colors flex-shrink-0" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmer le mot de passe"
                    className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="text-gray-600 hover:text-gray-400">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {confirmPassword.length > 0 && (
                  <p className={`text-[10px] px-1 font-bold uppercase tracking-widest ${password === confirmPassword ? 'text-green-400' : 'text-red-400'}`}>
                    {password === confirmPassword ? '✓ Mots de passe identiques' : '✗ Mots de passe différents'}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || password !== confirmPassword || password.length < 8}
                  className="w-full h-14 rounded-2xl bg-yellow-400 text-gray-900 font-black text-base hover:bg-yellow-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-yellow-400/20 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Mettre à jour mon mot de passe'}
                </button>
              </form>

              <button
                onClick={() => navigate('/business-login')}
                className="w-full mt-6 flex items-center justify-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
