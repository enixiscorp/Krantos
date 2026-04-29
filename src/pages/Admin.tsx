// ============================================================
// Krantos Platform — /admin (Super Admin control center)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Loader2,
  Users,
  ShieldCheck,
  LogOut,
  ArrowRight,
  TrendingUp,
  DollarSign,
  FileText,
  UserPlus,
  Package,
  ShoppingCart,
  AlertTriangle,
} from 'lucide-react';
import { getAdminDashboard, type AdminDashboardPayload } from '../services/adminService';
import { getStatsLeads } from '../services/statsService';
import { supabase } from '../lib/supabase';

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
  const [leadsPerDay, setLeadsPerDay] = useState<{ date: string; count: number }[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [dash, leadStats, roleInfo] = await Promise.all([
          getAdminDashboard(),
          getStatsLeads().catch(() => null),
          (async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const uid = sessionData.session?.user.id;
            if (!uid) return { super: false };
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', uid)
              .single();
            return { super: profile?.role === 'super_admin' };
          })(),
        ]);
        if (!mounted) return;
        setDashboard(dash);
        setIsSuperAdmin(roleInfo.super);
        if (leadStats?.leads_per_day?.length) {
          setLeadsPerDay(leadStats.leads_per_day.slice(-14));
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Impossible de charger le tableau de bord (super admin requis).'
        );
        navigate('/', { replace: true });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') navigate('/business-login', { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Vous avez été déconnecté.');
    navigate('/business-login');
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-yellow-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Chargement du centre de contrôle…</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const maxDay = Math.max(1, ...leadsPerDay.map((d) => d.count));
  const showPendingAlert = dashboard.pending_vendors > 0;
  const lowConversion = dashboard.total_leads >= 20 && dashboard.conversion_rate < 5;

  const adminActions = [
    { title: 'Vendeurs', desc: 'Liste & filtres', path: '/admin/vendors', icon: <Users className="w-5 h-5 text-yellow-400" /> },
    { title: 'Leads', desc: 'Suivi & détail', path: '/admin/leads', icon: <TrendingUp className="w-5 h-5 text-blue-400" /> },
    { title: 'Produits', desc: 'Vue globale', path: '/admin/products', icon: <Package className="w-5 h-5 text-cyan-400" /> },
    { title: 'Commissions', desc: 'Gestion des taux', path: '/admin/commissions', icon: <DollarSign className="w-5 h-5 text-green-400" /> },
    { title: 'Commandes', desc: 'Pipeline premium', path: '/admin/orders', icon: <ShoppingCart className="w-5 h-5 text-emerald-400" /> },
    { title: 'Facturation', desc: 'Rapports & PDF', path: '/admin/billing', icon: <FileText className="w-5 h-5 text-purple-400" /> },
    { title: 'Contrats', desc: 'Abonnements', path: '/admin/contracts', icon: <ShieldCheck className="w-5 h-5 text-orange-400" /> },
    { title: 'Chatbot', desc: 'Conseils & Réponses', path: '/admin/chatbot', icon: <Sparkles className="w-5 h-5 text-yellow-500" /> },
    ...(isSuperAdmin
      ? [{ title: 'Utilisateurs', desc: 'Accès internes', path: '/admin/users', icon: <UserPlus className="w-5 h-5 text-pink-400" /> }]
      : []),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-black text-white mb-2">Centre de contrôle</h1>
          <p className="text-gray-500 text-lg">Super Admin — croissance, performance, pilotage.</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm font-bold"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>

      {showPendingAlert && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 text-sm text-yellow-200">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>
            <span className="font-bold">{dashboard.pending_vendors}</span> vendeur(s) en attente de validation.{' '}
            <Link to="/admin/vendors" className="underline font-bold text-yellow-400">
              Traiter
            </Link>
          </p>
        </div>
      )}

      {lowConversion && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-200">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>
            Taux de conversion faible ({dashboard.conversion_rate} %). Vérifiez la qualité des leads et le suivi
            commerciaux.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {[
          { label: 'Vendeurs', v: dashboard.total_vendors, color: 'text-white' },
          { label: 'Actifs', v: dashboard.active_vendors, color: 'text-green-400' },
          { label: 'En attente', v: dashboard.pending_vendors, color: 'text-yellow-400' },
          { label: 'Produits', v: dashboard.total_products, color: 'text-cyan-400' },
          { label: 'Leads', v: dashboard.total_leads, color: 'text-blue-400' },
          { label: 'Conversion', v: `${dashboard.conversion_rate} %`, color: 'text-purple-400' },
        ].map((c) => (
          <div key={c.label} className="glass-card p-4 rounded-2xl border-white/5 text-center">
            <p className={`text-2xl font-black ${c.color} mb-1`}>{c.v}</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{c.label}</p>
          </div>
        ))}
      </div>

      {leadsPerDay.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-3xl border-white/5 mb-10"
        >
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Leads (14 derniers jours)</h2>
          <div className="flex items-end gap-1 h-32">
            {leadsPerDay.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div
                  className="w-full bg-yellow-400/80 rounded-t min-h-[2px] transition-all"
                  style={{ height: `${(d.count / maxDay) * 100}%` }}
                  title={`${d.date}: ${d.count}`}
                />
                <span className="text-[8px] text-gray-600 truncate w-full text-center">
                  {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="glass-card p-6 rounded-3xl border-white/5">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Top vendeurs (leads)</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
            {dashboard.top_vendors.length === 0 ? (
              <p className="text-gray-500">Aucune donnée.</p>
            ) : (
              dashboard.top_vendors.map((v) => (
                <div
                  key={v.vendor_id}
                  className="flex justify-between items-center py-2 border-b border-white/5"
                >
                  <span className="text-white font-medium truncate pr-2">{v.name}</span>
                  <span className="text-gray-400 shrink-0">
                    {v.leads_count} leads — {v.conversion_rate} %
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="glass-card p-6 rounded-3xl border-white/5">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Derniers leads</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
            {dashboard.recent_leads.map((l) => (
              <div key={l.id} className="flex justify-between items-start py-2 border-b border-white/5 gap-2">
                <div>
                  <p className="text-white font-medium">{l.user_name}</p>
                  <p className="text-gray-500 text-xs">{l.status} · {new Date(l.created_at).toLocaleString('fr-FR')}</p>
                </div>
                <span className="text-yellow-500/80 text-xs shrink-0">{l.total_power_needed} W</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Navigation</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminActions.map((action, i) => (
          <motion.div
            key={action.path}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i }}
          >
            <Link
              to={action.path}
              className="glass-card p-6 rounded-2xl border-white/5 hover:border-white/10 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {action.icon}
                </div>
                <div>
                  <h3 className="font-bold text-white group-hover:text-yellow-400 transition-colors">{action.title}</h3>
                  <p className="text-xs text-gray-500 font-medium">{action.desc}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Admin;
