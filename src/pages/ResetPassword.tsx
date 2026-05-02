
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Lock, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Vérifier si nous avons une session (le lien Supabase crée une session temporaire)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Le lien de réinitialisation est invalide ou a expiré.");
        navigate('/business-login');
      }
    };
    checkSession();
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      toast.error('Mot de passe : 6 caractères minimum.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      toast.success('Mot de passe mis à jour ! Connectez-vous.');
      navigate('/business-login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-yellow-400/5 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-10 rounded-[2.5rem] border-white/5 relative overflow-hidden">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 rounded-3xl bg-yellow-400/10 flex items-center justify-center mb-6">
              <ShieldCheck className="w-8 h-8 text-yellow-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Nouveau mot de passe</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Sécurisez votre accès professionnel.
            </p>
          </div>

          <form onSubmit={handleReset} className="space-y-4">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus-within:border-yellow-400/50 group">
              <Lock className="w-5 h-5 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                required
              />
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus-within:border-yellow-400/50 group">
              <Lock className="w-5 h-5 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le mot de passe"
                className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-yellow-400 text-gray-900 font-black text-lg hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-400/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Mettre à jour'}
            </button>
          </form>

          <button
            onClick={() => navigate('/business-login')}
            className="w-full mt-6 flex items-center justify-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
