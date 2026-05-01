// ============================================================
// Krantos Platform — /admin/contracts (Premium Dark Overhaul)
// Requirements: C9.1, C9.2 (Contract lifecycle)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Zap,
  Loader2,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
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
    label: 'Contrat Actif',
    color: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/20',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
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
  suspended: {
    label: 'Suspendu',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminContracts = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Renewal Modal
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [renewalEndDate, setRenewalEndDate] = useState('');

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
        .order('contract_end_date', { ascending: true });

      if (error) {
        toast.error('Erreur lors du chargement des contrats.');
      } else if (mounted) {
        setVendors(data ?? []);
      }
      if (mounted) setLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRenew = async () => {
    if (!selectedVendor || !renewalEndDate) {
      toast.error('Veuillez sélectionner une date de fin.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('vendors')
        .update({
          contract_end_date: renewalEndDate,
          status: 'active',
        })
        .eq('id', selectedVendor.id);

      if (error) throw error;

      toast.success(`Contrat renouvelé pour ${selectedVendor.name}.`);
      setVendors(prev => prev.map(v => v.id === selectedVendor.id ? { ...v, contract_end_date: renewalEndDate, status: 'active' } : v));
      setShowRenewModal(false);
    } catch (err) {
      toast.error('Erreur lors du renouvellement.');
    } finally {
      setLoading(false);
    }
  };

  const handleTerminate = async (vendorId: string) => {
    if (!confirm('Voulez-vous vraiment résilier ce contrat ?')) return;

    setUpdatingId(vendorId);
    const { error } = await supabase
      .from('vendors')
      .update({ status: 'terminated' })
      .eq('id', vendorId);

    if (error) {
      toast.error('Erreur lors de la résiliation.');
    } else {
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status: 'terminated' } : v));
      toast.success('Contrat résilié.');
    }
    setUpdatingId(null);
  };

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const diffTime = new Date(endDate).getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
          <h1 className="text-4xl font-black text-white mb-2">Contrats</h1>
          <p className="text-gray-500 text-lg">Suivi du cycle de vie et renouvellements.</p>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', count: vendors.length, color: 'text-white' },
          { label: 'Actifs', count: vendors.filter(v => v.status === 'active').length, color: 'text-green-400' },
          { label: 'Expirés', count: vendors.filter(v => v.status === 'expired').length, color: 'text-orange-400' },
          { label: 'Alarmes < 7j', count: vendors.filter(v => {
            const days = getDaysRemaining(v.contract_end_date);
            return v.status === 'active' && days !== null && days < 7;
          }).length, color: 'text-red-400' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 rounded-2xl border-white/5 text-center">
            <p className={`text-2xl font-black ${stat.color} mb-1`}>{stat.count}</p>
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative group mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-yellow-400 transition-colors" />
        <input
          type="text"
          placeholder="Rechercher un vendeur..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
        />
      </div>

      {/* List */}
      <div className="space-y-4">
        {filteredVendors.map((v, i) => {
          const days = getDaysRemaining(v.contract_end_date);
          const isExpiring = v.status === 'active' && days !== null && days < 7;
          const statusCfg = STATUS_CONFIG[v.status as VendorStatus] || STATUS_CONFIG.pending;

          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`glass-card p-6 rounded-3xl border-white/5 hover:border-white/10 transition-all ${isExpiring ? 'border-red-500/20 bg-red-500/[0.02]' : ''}`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-white/5`}>
                     <ShieldCheck className={`w-7 h-7 ${isExpiring ? 'text-red-400' : 'text-yellow-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white uppercase tracking-tight mb-1">{v.name}</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusCfg.bg} ${statusCfg.color} flex items-center gap-1`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                      {v.contract_end_date && (
                        <span className={`text-[10px] font-bold flex items-center gap-1 ${isExpiring ? 'text-red-400' : 'text-gray-500'}`}>
                          <Calendar className="w-3 h-3" />
                          Expire le {new Date(v.contract_end_date).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center md:items-end gap-1">
                  {days !== null ? (
                    <>
                      <p className={`text-xl font-black ${days < 0 ? 'text-red-500' : days < 7 ? 'text-orange-400' : 'text-white'}`}>
                        {days < 0 ? 'Expiré' : days === 0 ? "Aujourd'hui" : `${days} jours`}
                      </p>
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Temps restant</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-600 italic">Pas de contrat défini</p>
                  )}
                </div>

                <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                  <button
                    onClick={() => { setSelectedVendor(v); setRenewalEndDate(v.contract_end_date || ''); setShowRenewModal(true); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      v.status === 'pending' 
                        ? 'bg-yellow-400 text-gray-900 border-yellow-400 hover:bg-yellow-500' 
                        : 'bg-white/5 text-white border-white/5 hover:bg-white/10'
                    }`}
                  >
                    {v.status === 'pending' ? <ShieldCheck className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    {v.status === 'pending' ? 'Valider l\'inscription' : 'Renouveler'}
                  </button>
                  {v.status !== 'terminated' && (
                    <button
                      onClick={() => handleTerminate(v.id)}
                      disabled={updatingId === v.id}
                      className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                      title="Résilier"
                    >
                      {updatingId === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Renewal Modal */}
      <AnimatePresence>
        {showRenewModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRenewModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md glass-card p-10 rounded-[2.5rem] border-white/5 relative z-10"
            >
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
                {selectedVendor?.status === 'pending' ? 'Validation de Contrat' : 'Renouvellement'}
              </h2>
              <p className="text-gray-500 text-sm mb-8">
                {selectedVendor?.status === 'pending' 
                  ? `Activez le compte de ${selectedVendor?.name} et définissez la durée d'accès.` 
                  : `Définissez la nouvelle date d'expiration pour ${selectedVendor?.name}.`}
              </p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Nouvelle date de fin</label>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus-within:border-yellow-400/50">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <input
                      type="date"
                      value={renewalEndDate}
                      onChange={e => setRenewalEndDate(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-white text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setShowRenewModal(false)}
                    className="flex-1 py-4 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleRenew}
                    className="flex-[2] py-4 rounded-xl bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-400/20"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminContracts;
