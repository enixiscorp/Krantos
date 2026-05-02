// ============================================================
// Krantos Platform — /leads (vendor leads management) (Premium Dark Overhaul)
// Requirements: 11.3, 4.2 (Sale amount tracking)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Users,
  LayoutDashboard,
  PlusCircle,
  LogOut,
  Zap,
  Loader2,
  ChevronDown,
  Phone,
  MapPin,
  Zap as ZapIcon,
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  DollarSign,
  Search,
  MoreVertical,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Lead, LeadStatus } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  new: { label: 'Nouveau', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: <Clock className="w-3.5 h-3.5" /> },
  contacted: { label: 'Contacté', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', icon: <Zap className="w-3.5 h-3.5" /> },
  converted: { label: 'Converti', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  lost: { label: 'Perdu', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: <XCircle className="w-3.5 h-3.5" /> },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Leads = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [vendorRate, setVendorRate] = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Conversion Modal
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [saleAmount, setSaleAmount] = useState('');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/business-login', { replace: true });
        return;
      }

      const userId = sessionData.session.user.id;

      // 1. Fetch vendor rate
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('commission_rate, status')
        .eq('id', userId)
        .single();

      if (!vendorData || vendorData.status !== 'active') {
        await supabase.auth.signOut();
        navigate('/business-login', { replace: true });
        return;
      }
      if (mounted) setVendorRate(vendorData.commission_rate);

      // 2. Fetch leads
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('vendor_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Erreur lors du chargement des leads.');
      } else if (mounted) {
        setLeads(data ?? []);
      }

      if (mounted) setLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleUpdateStatus = async (leadId: string, newStatus: LeadStatus) => {
    if (newStatus === 'converted') {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        setConvertingLead(lead);
        setShowConvertModal(true);
        setOpenDropdown(null);
        return;
      }
    }

    setUpdatingId(leadId);
    setOpenDropdown(null);

    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId);

    if (error) {
      toast.error('Erreur lors de la mise à jour.');
    } else {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      toast.success('Statut mis à jour.');
    }
    setUpdatingId(null);
  };

  const handleConfirmConversion = async () => {
    if (!convertingLead || !saleAmount || parseFloat(saleAmount) <= 0) {
      toast.error('Veuillez entrer un montant valide.');
      return;
    }

    setUpdatingId(convertingLead.id);
    const amount = parseFloat(saleAmount);

    try {
      // 1. Update Lead Status
      const { error: leError } = await supabase
        .from('leads')
        .update({ status: 'converted' })
        .eq('id', convertingLead.id);
      if (leError) throw leError;

      // 2. Create Commission Record
      const { error: coError } = await supabase
        .from('commission_records')
        .insert({
          vendor_id: convertingLead.vendor_id,
          lead_id: convertingLead.id,
          commission_rate_applied: vendorRate,
          amount: (amount * vendorRate) / 100,
          status: 'pending_verification',
          type: 'conversion',
          notes: `Vente déclarée par le vendeur : ${amount.toLocaleString()} FCFA.`
        });
      if (coError) throw coError;

      toast.success('Leads converti ! Commission enregistrée en attente.');
      setLeads(prev => prev.map(l => l.id === convertingLead.id ? { ...l, status: 'converted' } : l));
      setShowConvertModal(false);
      setConvertingLead(null);
      setSaleAmount('');
    } catch (err) {
      toast.error('Erreur lors de la conversion.');
    } finally {
      setUpdatingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  const filteredLeads = leads.filter(l => {
    const matchesFilter = filter === 'all' || l.status === filter;
    const matchesSearch = l.user_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.location.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading && leads.length === 0) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <Link to="/business-dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-4xl font-black text-white mb-2">Mes Leads</h1>
          <p className="text-gray-500 text-lg">Suivez et convertissez vos prospects Krantos.</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row gap-6 mb-10">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-yellow-400 transition-colors" />
          <input
            type="text"
            placeholder="Rechercher par nom ou ville..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
          {(['all', 'new', 'contacted', 'converted', 'lost'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                filter === s 
                  ? 'bg-yellow-400 text-gray-900 border-yellow-400' 
                  : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
              }`}
            >
              {s === 'all' ? 'Tous' : STATUS_CONFIG[s as LeadStatus].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {filteredLeads.map((l, i) => {
            const cfg = STATUS_CONFIG[l.status as LeadStatus] || STATUS_CONFIG.new;
            const isUpdating = updatingId === l.id;
            const isDropdownOpen = openDropdown === l.id;

            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card p-8 rounded-[2rem] border-white/5 hover:border-white/10 transition-all flex flex-col group relative"
              >
                <div className="flex items-start justify-between mb-6">
                   <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-black text-gray-400 group-hover:bg-yellow-400 group-hover:text-gray-900 transition-all">
                      {l.user_name.charAt(0)}
                   </div>
                   <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(isDropdownOpen ? null : l.id)}
                        disabled={isUpdating}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-500 transition-all"
                      >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                      </button>
                      <AnimatePresence>
                        {isDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 top-full mt-2 w-48 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl z-20 py-2 overflow-hidden"
                          >
                             {(['contacted', 'converted', 'lost'] as LeadStatus[]).map(s => (
                               <button
                                 key={s}
                                 onClick={() => handleUpdateStatus(l.id, s)}
                                 className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3"
                               >
                                  <div className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[s].color.replace('text-', 'bg-')}`} />
                                  {STATUS_CONFIG[s].label}
                               </button>
                             ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                   </div>
                </div>

                <div className="mb-6">
                   <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-black text-white tracking-tight">{l.user_name}</h3>
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em] border ${cfg.bg} ${cfg.color} flex items-center gap-1`}>
                         {cfg.icon}
                         {cfg.label}
                      </span>
                   </div>
                   <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-yellow-400/50" /> {l.location}</span>
                      <span className="flex items-center gap-1"><ZapIcon className="w-3 h-3 text-yellow-400/50" /> {l.total_power_needed.toFixed(1)} kVA</span>
                   </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                   <div className="grid grid-cols-2 gap-2">
                     <a
                       href={`tel:${l.user_phone}`}
                       className="flex items-center justify-center py-3 rounded-xl bg-white/5 text-xs font-bold text-white hover:bg-white/10 transition-all border border-white/5"
                       title="Appeler"
                     >
                       <Phone className="w-3.5 h-3.5" />
                     </a>
                     <a
                       href={`https://wa.me/${l.user_phone.replace(/\D/g, '').length === 8 ? '228' + l.user_phone.replace(/\D/g, '') : l.user_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${l.user_name}, je suis le vendeur de Krantos concernant votre simulation de puissance.`)}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex items-center justify-center py-3 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all border border-green-500/20"
                       title="WhatsApp"
                     >
                        <ZapIcon className="w-3.5 h-3.5" />
                     </a>
                   </div>
                   <div className="flex items-center justify-center px-4 py-3 rounded-xl bg-white/[0.02] text-[10px] font-black text-gray-600 uppercase tracking-widest">
                      {new Date(l.created_at).toLocaleDateString('fr-FR')}
                   </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Conversion Modal */}
      <AnimatePresence>
        {showConvertModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConvertModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md glass-card p-10 rounded-[2.5rem] border-green-500/20 bg-green-500/[0.02] relative z-10"
            >
              <div className="w-16 h-16 rounded-3xl bg-green-500/10 flex items-center justify-center mb-6">
                 <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Convertir ce Lead</h2>
              <p className="text-gray-500 text-sm mb-10">Félicitations pour la vente ! Entrez le montant total pour calculer la commission ({vendorRate}%).</p>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-3 ml-1">Montant de la vente (FCFA)</label>
                  <div className="relative group">
                     <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 group-focus-within:text-green-400 transition-colors" />
                     <input
                        type="number"
                        value={saleAmount}
                        onChange={e => setSaleAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white/5 border border-white/10 rounded-3xl pl-14 pr-6 py-5 text-xl font-black text-white focus:outline-none focus:ring-1 focus:ring-green-400/50"
                     />
                  </div>
                </div>

                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                   <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                      <span>Commission ({vendorRate}%)</span>
                      <span className="text-white">
                         {saleAmount ? (parseFloat(saleAmount) * vendorRate / 100).toLocaleString() : '0'} FCFA
                      </span>
                   </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowConvertModal(false)}
                    className="flex-1 py-5 rounded-3xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmConversion}
                    disabled={updatingId !== null}
                    className="flex-[2] py-5 rounded-3xl bg-green-500 text-white font-black hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 text-sm"
                  >
                    {updatingId ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirmer la Vente'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Click-outside for dropdowns */}
      {openDropdown && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
      )}
    </div>
  );
};

export default Leads;
