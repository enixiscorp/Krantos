// ============================================================
// Krantos Platform — /admin/commissions (Premium Dark Overhaul)
// Requirements: 13.5 (Commission management)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Search,
  Check,
  X,
  TrendingUp,
  Percent,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommissionStatus = 'pending_verification' | 'confirmed' | 'rejected' | 'rate_change';
type CommissionType = 'conversion' | 'rate_change';

interface VendorWithRate {
  id: string;
  name: string;
  category: string;
  commission_rate: number;
  status: string;
  created_at: string;
  old_rate?: number; // Optional: if we want to show history
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  CommissionStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  pending_verification: {
    label: 'En attente',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  confirmed: {
    label: 'Confirmé',
    color: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/20',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: 'Rejeté',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  rate_change: {
    label: 'Modif. Taux',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminCommissions = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [vendors, setVendors] = useState<VendorWithRate[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'vendors' | 'records'>('vendors');

  // Rate change modal state
  const [showRateModal, setShowRateModal] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [newRate, setNewRate] = useState('');

  const init = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      navigate('/business-login', { replace: true });
      return;
    }

    const { data: recData } = await supabase
      .from('commission_records')
      .select('*, vendors(name)')
      .order('created_at', { ascending: false });

    const { data: venData } = await supabase
      .from('vendors')
      .select('id, name, category, commission_rate, status, created_at')
      .order('name');

    setRecords(recData || []);
    setVendors(venData as VendorWithRate[] || []);
    setLoading(false);
  };

  useEffect(() => {
    init();
  }, []);

  const handleUpdateStatus = async (recordId: string, status: 'confirmed' | 'rejected') => {
    setUpdatingId(recordId);
    const { error } = await supabase
      .from('commission_records')
      .update({ status })
      .eq('id', recordId);

    if (error) {
      toast.error('Erreur lors de la mise à jour.');
    } else {
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, status } : r));
      toast.success(status === 'confirmed' ? 'Commission confirmée.' : 'Commission rejetée.');
    }
    setUpdatingId(null);
  };

  const handleChangeRate = async () => {
    if (!selectedVendorId || !newRate) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Taux invalide (0-100).');
      return;
    }

    setLoading(true);
    try {
      const { error: uvError } = await supabase
        .from('vendors')
        .update({ commission_rate: rate })
        .eq('id', selectedVendorId);

      if (uvError) throw uvError;

      await supabase
        .from('commission_records')
        .insert({
          vendor_id: selectedVendorId,
          commission_rate_applied: rate,
          status: 'rate_change',
          type: 'rate_change',
          notes: `Taux modifié à ${rate}% par l'administrateur.`
        });

      toast.success('Taux mis à jour avec succès.');
      setShowRateModal(false);
      await init();
    } catch (err) {
      toast.error('Erreur lors de la modification.');
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = vendors.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    
    if (filterStatus === 'pending') return v.status === 'pending' && matchesSearch;
    if (filterStatus === 'confirmed') return v.status === 'active' && matchesSearch;
    
    if (filterStatus === 'rejected') {
      // Logic: Pending for more than 1 week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return v.status === 'pending' && new Date(v.created_at) < oneWeekAgo && matchesSearch;
    }
    
    if (filterStatus === 'rate_change') {
      // In this tab, we show vendors who had at least one rate change in records
      return records.some(r => r.vendor_id === v.id && r.type === 'rate_change') && matchesSearch;
    }
    
    return matchesSearch;
  });

  if (loading && records.length === 0) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group font-bold text-xs uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-4xl font-black text-white mb-2">Commissions</h1>
          <p className="text-gray-500 text-lg">Gestion des revenus et des taux par vendeur.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mr-4">
            <button 
              onClick={() => setActiveTab('records')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'records' ? 'bg-yellow-400 text-gray-900' : 'text-gray-500 hover:text-white'}`}
            >
              Historique
            </button>
            <button 
              onClick={() => setActiveTab('vendors')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'vendors' ? 'bg-yellow-400 text-gray-900' : 'text-gray-500 hover:text-white'}`}
            >
              Vendeurs & Taux
            </button>
          </div>
          <button
            onClick={() => setShowRateModal(true)}
            className="flex items-center gap-2 px-6 py-4 rounded-xl bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 transition-all accent-glow"
          >
            <Percent className="w-5 h-5" />
            Modifier un taux
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
          <input
            type="text"
            placeholder="Rechercher par vendeur ou note..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {activeTab === 'vendors' ? (
            (['all', 'pending', 'confirmed', 'rejected', 'rate_change'] as const).map(s => {
              const label = s === 'all' ? 'Tous' : 
                            s === 'pending' ? 'En attente' :
                            s === 'confirmed' ? 'Confirmé' :
                            s === 'rejected' ? 'Rejeté' : 'Modif. Taux';
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
                  {label}
                </button>
              );
            })
          ) : (
            (['all', 'pending_verification', 'confirmed', 'rejected', 'rate_change'] as const).map(s => {
              const label = s === 'all' ? 'Tous' : STATUS_CONFIG[s as CommissionStatus].label;
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
                  {label}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {activeTab === 'records' ? (
          filteredRecords.length === 0 ? (
            <div className="glass-card p-16 rounded-[2.5rem] text-center border-white/5">
              <DollarSign className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 font-bold">Aucune commission trouvée.</p>
            </div>
          ) : (
            filteredRecords.map((rec, i) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-6 rounded-3xl border-white/5 hover:border-white/10 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${STATUS_CONFIG[rec.status].bg}`}>
                      <DollarSign className={`w-7 h-7 ${STATUS_CONFIG[rec.status].color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-white uppercase tracking-tight">{rec.vendors?.name || 'Vendeur Inconnu'}</h3>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${STATUS_CONFIG[rec.status].bg} ${STATUS_CONFIG[rec.status].color} flex items-center gap-1`}>
                          {STATUS_CONFIG[rec.status].icon}
                          {STATUS_CONFIG[rec.status].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                        <span>{new Date(rec.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-700" />
                        <span>{rec.type === 'conversion' ? 'Conversion Lead' : 'Ajustement Admin'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 md:text-right">
                    <p className="text-2xl font-black text-white">
                      {rec.type === 'conversion' ? `${Number(rec.amount).toLocaleString('fr-FR')} FCFA` : '—'}
                    </p>
                    <p className="text-xs font-bold text-yellow-400">Taux : {rec.commission_rate_applied}%</p>
                  </div>

                  <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                    {rec.status === 'pending_verification' && updatingId !== rec.id ? (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(rec.id, 'confirmed')}
                          className="p-3 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all"
                          title="Confirmer"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(rec.id, 'rejected')}
                          className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                          title="Rejeter"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </>
                    ) : updatingId === rec.id ? (
                      <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Fait</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVendors.map((v, i) => {
              // For rate_change filter, try to find the previous rate
              let oldRate: number | null = null;
              if (filterStatus === 'rate_change') {
                 const changeRecord = records.find(r => r.vendor_id === v.id && r.type === 'rate_change');
                 // This is a simplification: usually we'd need the record before the latest one
                 // But for now let's just indicate there was a change
              }

              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card p-6 rounded-3xl border-white/5 flex items-center justify-between hover:border-yellow-400/20 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 flex items-center justify-center group-hover:bg-yellow-400 group-hover:text-black transition-all">
                      <Percent className="w-6 h-6 text-yellow-400 group-hover:text-black" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white uppercase text-xs tracking-tight">{v.name}</h3>
                        {v.status === 'pending' && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Nouveau</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none">{v.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end mb-1">
                       {filterStatus === 'rate_change' && (
                         <span className="text-[10px] font-bold text-gray-600 line-through">?%</span>
                       )}
                       <p className="text-2xl font-black text-white">{v.commission_rate || 0}%</p>
                    </div>
                    <button 
                      onClick={() => { setSelectedVendorId(v.id); setNewRate((v.commission_rate || 0).toString()); setShowRateModal(true); }}
                      className="text-[9px] font-black text-yellow-400 uppercase hover:underline"
                    >
                      Ajuster Taux
                    </button>
                  </div>
                </motion.div>
              );
            })}
            {filteredVendors.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-600 font-bold text-sm">
                 Aucun profil correspondant aux critères.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rate Change Modal */}
      <AnimatePresence>
        {showRateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRateModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md glass-card p-10 rounded-[2.5rem] border-white/5 relative z-10"
            >
              <h2 className="text-2xl font-black text-white mb-6 tracking-tight">Modifier un taux</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Vendeur</label>
                  <select
                    value={selectedVendorId}
                    onChange={e => setSelectedVendorId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                  >
                    <option value="" className="bg-[#0a0a0c]">Sélectionner...</option>
                    {vendors.map(v => <option key={v.id} value={v.id} className="bg-[#0a0a0c]">{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Nouveau Taux (%)</label>
                  <input
                    type="number"
                    value={newRate}
                    onChange={e => setNewRate(e.target.value)}
                    placeholder="ex: 12.5"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowRateModal(false)} className="flex-1 py-4 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all">Annuler</button>
                  <button onClick={handleChangeRate} className="flex-[2] py-4 rounded-xl bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-400/20">Confirmer</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCommissions;
