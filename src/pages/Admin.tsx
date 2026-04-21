// ============================================================
// Krantos Platform — /admin (admin dashboard) (Premium Dark Overhaul)
// Requirements: 13.1, 13.4
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Zap,
  Loader2,
  Users,
  ShieldCheck,
  LogOut,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  DollarSign,
  FileText,
  UserPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { VendorStatus, LeadStatus } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminStats {
  vendors: Record<VendorStatus, number>;
  leads: Record<LeadStatus, number>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Admin = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    vendors: { pending: 0, active: 0, suspended: 0, expired: 0, terminated: 0 },
    leads: { new: 0, contacted: 0, converted: 0, lost: 0 },
  });

  // ---------------------------------------------------------------------------
  // Auth guard + stats fetch
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/business-login', { replace: true });
        return;
      }

      // Fetch vendor counts by status
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('status');

      // Fetch lead counts by status
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('status');

      if (vendorsError) toast.error('Erreur lors du chargement des statistiques vendeurs.');
      if (leadsError) toast.error('Erreur lors du chargement des statistiques leads.');

      if (mounted) {
        const vendorCounts: Record<VendorStatus, number> = {
          pending: 0,
          active: 0,
          suspended: 0,
          expired: 0,
          terminated: 0,
        };
        for (const v of vendorsData ?? []) {
          if (v.status in vendorCounts) vendorCounts[v.status as VendorStatus]++;
        }

        const leadCounts: Record<LeadStatus, number> = {
          new: 0,
          contacted: 0,
          converted: 0,
          lost: 0,
        };
        for (const l of leadsData ?? []) {
          if (l.status in leadCounts) leadCounts[l.status as LeadStatus]++;
        }

        setStats({ vendors: vendorCounts, leads: leadCounts });
        setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') navigate('/business-login', { replace: true });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Vous avez été déconnecté.');
    navigate('/business-login');
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-yellow-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Chargement du tableau de bord…</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const totalVendors = Object.values(stats.vendors).reduce((a, b) => a + b, 0);
  const totalLeads = Object.values(stats.leads).reduce((a, b) => a + b, 0);

  const adminActions = [
    { title: 'Vendeurs', desc: `${totalVendors} total`, path: '/admin/vendors', icon: <Users className="w-5 h-5 text-yellow-400" /> },
    { title: 'Leads', desc: `${totalLeads} total`, path: '/admin/leads', icon: <TrendingUp className="w-5 h-5 text-blue-400" /> },
    { title: 'Commissions', desc: 'Gestion des taux', path: '/admin/commissions', icon: <DollarSign className="w-5 h-5 text-green-400" /> },
    { title: 'Facturation', desc: 'Rapports & PDF', path: '/admin/billing', icon: <FileText className="w-5 h-5 text-purple-400" /> },
    { title: 'Contrats', desc: 'Abonnements', path: '/admin/contracts', icon: <ShieldCheck className="w-5 h-5 text-orange-400" /> },
    { title: 'Utilisateurs', desc: 'Accès internes', path: '/admin/users', icon: <UserPlus className="w-5 h-5 text-pink-400" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* ---- Welcome ---- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-500 text-lg">Vue d'ensemble de la plateforme Krantos.</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm font-bold"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>

      {/* ---- Stats Summary ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Vendors Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-[2rem] border-white/5"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Vendeurs</h2>
            <Users className="w-4 h-4 text-gray-600" />
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-black text-yellow-500 mb-1">{stats.vendors.pending}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black">Attente</p>
            </div>
            <div>
              <p className="text-3xl font-black text-white mb-1">{stats.vendors.active}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black">Actifs</p>
            </div>
            <div>
              <p className="text-3xl font-black text-gray-600 mb-1">{stats.vendors.suspended}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black">Suspendus</p>
            </div>
          </div>
        </motion.div>

        {/* Leads Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 rounded-[2rem] border-white/5"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Leads</h2>
            <TrendingUp className="w-4 h-4 text-gray-600" />
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-3xl font-black text-blue-500 mb-1">{stats.leads.new}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black">Nouveaux</p>
            </div>
            <div>
              <p className="text-3xl font-black text-yellow-500 mb-1">{stats.leads.contacted}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black">Contactés</p>
            </div>
            <div>
              <p className="text-3xl font-black text-green-500 mb-1">{stats.leads.converted}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black">Convertis</p>
            </div>
            <div>
              <p className="text-3xl font-black text-red-500 mb-1">{stats.leads.lost}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black">Perdus</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ---- Navigation Grid ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminActions.map((action, i) => (
          <motion.div
            key={action.path}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.05 }}
          >
            <Link
              to={action.path}
              className="glass-card p-6 rounded-[1.5rem] border-white/5 hover:border-white/10 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {action.icon}
                </div>
                <div>
                  <h3 className="font-bold text-white group-hover:text-yellow-400 transition-colors">{action.title}</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{action.desc}</p>
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
