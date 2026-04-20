// ============================================================
// Krantos Platform — /admin/vendors (Premium Dark Overhaul)
// Requirements: 13.1, 13.2, 13.3
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Zap,
  Loader2,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  AlertTriangle,
  Search,
  ChevronRight,
  MoreVertical,
  Check,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vendor, VendorStatus } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  VendorStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'En attente',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  active: {
    label: 'Actif',
    color: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/20',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  suspended: {
    label: 'Suspendu',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  expired: {
    label: 'Expiré',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10 border-orange-400/20',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  terminated: {
    label: 'Résilié',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  free: 'Gratuit',
  basic: 'Basic',
  premium: 'Premium',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminVendors = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<VendorStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/business-login', { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Erreur lors du chargement des vendeurs.');
      } else if (mounted) {
        setVendors(data ?? []);
      }

      if (mounted) setLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, [navigate]);

  const handleUpdateStatus = async (vendorId: string, status: VendorStatus) => {
    setUpdatingId(vendorId);
    const { error } = await supabase
      .from('vendors')
      .update({ status })
      .eq('id', vendorId);

    if (error) {
      toast.error('Erreur lors de la mise à jour.');
    } else {
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status } : v));
      toast.success(`Statut du vendeur mis à jour.`);
    }
    setUpdatingId(null);
  };

  const filteredVendors = vendors.filter(v => {
    const matchesFilter = filterStatus === 'all' || v.status === filterStatus;
    const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const countsByStatus = vendors.reduce((acc, v) => {
    acc[v.status as VendorStatus] = (acc[v.status as VendorStatus] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading && vendors.length === 0) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-4xl font-black text-white mb-2">Vendeurs</h1>
          <p className="text-gray-500 text-lg">Gestion des partenaires et validation des comptes.</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
          <input
            type="text"
            placeholder="Rechercher par nom d'entreprise ou email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {(['all', 'pending', 'active', 'suspended'] as const).map(s => {
            const count = s === 'all' ? vendors.length : (countsByStatus[s] ?? 0);
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  filterStatus === s 
                    ? 'bg-yellow-400 text-gray-900 border-yellow-400' 
                    : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                }`}
              >
                {s === 'all' ? 'Tous' : STATUS_CONFIG[s].label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {filteredVendors.length === 0 ? (
          <div className="glass-card p-16 rounded-[2.5rem] text-center border-white/5">
            <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 font-bold">Aucun vendeur trouvé.</p>
          </div>
        ) : (
          filteredVendors.map((vendor, i) => {
            const statusCfg = STATUS_CONFIG[vendor.status as VendorStatus] || STATUS_CONFIG.pending;
            const isUpdating = updatingId === vendor.id;

            return (
              <motion.div
                key={vendor.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card p-6 rounded-3xl border-white/5 hover:border-white/10 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center font-black text-gray-500 text-xl">
                      {vendor.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-white uppercase tracking-tight">{vendor.name}</h3>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusCfg.bg} ${statusCfg.color} flex items-center gap-1.5`}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/5">
                           {SUBSCRIPTION_LABELS[vendor.subscription_type] || vendor.subscription_type}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                         <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {vendor.category}</span>
                         <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {vendor.phone}</span>
                         <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(vendor.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 leading-none">
                     {isUpdating ? (
                       <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                     ) : (
                       <>
                         {vendor.status !== 'active' && (
                           <button
                             onClick={() => handleUpdateStatus(vendor.id, 'active')}
                             className="p-3 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all flex items-center gap-2 text-xs font-bold"
                             title="Valider"
                           >
                             <Check className="w-4 h-4" />
                             Valider
                           </button>
                         )}
                         {vendor.status !== 'suspended' && (
                           <button
                             onClick={() => handleUpdateStatus(vendor.id, 'suspended')}
                             className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-xs font-bold"
                             title="Suspendre"
                           >
                             <AlertTriangle className="w-4 h-4" />
                             Suspendre
                           </button>
                         )}
                         <button className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-all">
                            <ChevronRight className="w-4 h-4" />
                         </button>
                       </>
                     )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminVendors;
