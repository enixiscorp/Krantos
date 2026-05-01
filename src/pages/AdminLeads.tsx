// ============================================================
// Krantos Platform — /admin/leads (Premium Dark Overhaul)
// Requirements: 13.4
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Zap,
  Loader2,
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  Search,
  TrendingUp,
  X,
  FileText,
  User,
  Building2,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Lead, LeadStatus } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeadWithVendor extends Lead {
  vendor_name: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  new: { label: 'Nouveau', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: <div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> },
  contacted: { label: 'Contacté', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', icon: <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> },
  converted: { label: 'Converti', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20', icon: <div className="w-1.5 h-1.5 rounded-full bg-green-400" /> },
  lost: { label: 'Perdu', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: <div className="w-1.5 h-1.5 rounded-full bg-red-400" /> },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminLeads = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadWithVendor[]>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadWithVendor | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/admin-login', { replace: true });
        return;
      }

      const [leadsResult, vendorsResult] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('vendors').select('id, name').eq('status', 'active'),
      ]);

      if (leadsResult.error) {
        toast.error('Erreur lors du chargement des leads.');
      } else if (mounted) {
        const vData = vendorsResult.data ?? [];
        setVendors(vData);
        
        const vendorMap = new Map<string, string>(
          vData.map((v: { id: string; name: string }) => [v.id, v.name])
        );

        const enriched: LeadWithVendor[] = (leadsResult.data ?? []).map((lead: Lead) => ({
          ...lead,
          vendor_name: lead.vendor_id ? (vendorMap.get(lead.vendor_id) ?? null) : null,
        }));

        setLeads(enriched);
      }

      if (mounted) setLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, [navigate]);

  const handleUpdateStatus = async (leadId: string, status: LeadStatus) => {
    setUpdatingId(leadId);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId);

      if (error) throw error;
      
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
      toast.success(`Statut du lead mis à jour.`);
    } catch (err) {
      toast.error('Erreur lors de la mise à jour.');
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignVendor = async (leadId: string, vendorId: string) => {
    setUpdatingId(leadId);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ vendor_id: vendorId || null })
        .eq('id', leadId);

      if (error) throw error;
      
      const vendorName = vendors.find(v => v.id === vendorId)?.name || null;
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, vendor_id: vendorId || null, vendor_name: vendorName } : l));
      toast.success(vendorId ? `Lead assigné à ${vendorName}.` : 'Assignation retirée.');
    } catch (err) {
      toast.error('Erreur lors de l\'assignation.');
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchesSearch = l.user_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          l.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const countsByStatus = leads.reduce((acc, l) => {
    acc[l.status as LeadStatus] = (acc[l.status as LeadStatus] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading && leads.length === 0) {
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
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group font-bold text-xs uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter">Gestion des Leads</h1>
          <p className="text-gray-500 text-lg font-medium">Suivi et assignation des opportunités commerciales.</p>
        </motion.div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-yellow-400 transition-colors" />
          <input
            type="text"
            placeholder="Rechercher par client, ville ou vendeur..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {(['all', 'new', 'contacted', 'converted', 'lost'] as const).map(s => {
            const count = s === 'all' ? leads.length : (countsByStatus[s] ?? 0);
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`flex-shrink-0 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  filterStatus === s 
                    ? 'bg-yellow-400 text-gray-900 border-yellow-400 shadow-lg shadow-yellow-400/20' 
                    : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'
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
        {filteredLeads.length === 0 ? (
          <div className="glass-card p-20 rounded-[3rem] text-center border-white/5 bg-white/[0.02]">
            <TrendingUp className="w-16 h-16 text-gray-800 mx-auto mb-6" />
            <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Aucun lead trouvé.</p>
          </div>
        ) : (
          filteredLeads.map((lead, i) => {
            const cfg = STATUS_CONFIG[lead.status as LeadStatus] || STATUS_CONFIG.new;
            const isUpdating = updatingId === lead.id;

            return (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="glass-card p-6 rounded-3xl border-white/5 hover:border-white/10 transition-all group bg-white/[0.02]"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center font-black text-gray-500 text-2xl group-hover:bg-yellow-400/10 group-hover:text-yellow-400 transition-all">
                      {lead.user_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-black text-white uppercase tracking-tight text-lg">{lead.user_name}</h3>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.color} flex items-center gap-1.5`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                         <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-yellow-500" /> {lead.location}</span>
                         <span className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-yellow-500" /> {lead.total_power_needed.toFixed(1)} kVA</span>
                         <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {new Date(lead.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 md:text-right min-w-[240px]">
                     {isUpdating ? (
                       <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                     ) : (
                       <>
                         <div className="flex items-center gap-2 w-full">
                           <div className="flex-1 flex flex-col gap-1">
                             <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest text-left pl-1">Statut</label>
                             <select
                               value={lead.status}
                               onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadStatus)}
                               className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white uppercase tracking-widest focus:outline-none focus:border-yellow-400/50 appearance-none cursor-pointer hover:bg-white/10 transition-all"
                             >
                               {Object.entries(STATUS_CONFIG).map(([id, s]) => (
                                 <option key={id} value={id} className="bg-zinc-900">{s.label}</option>
                               ))}
                             </select>
                           </div>
                           <div className="flex-1 flex flex-col gap-1">
                             <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest text-left pl-1">Vendeur</label>
                             <select
                               value={lead.vendor_id || ''}
                               onChange={(e) => handleAssignVendor(lead.id, e.target.value)}
                               className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white uppercase tracking-widest focus:outline-none focus:border-yellow-400/50 appearance-none cursor-pointer hover:bg-white/10 transition-all"
                             >
                               <option value="" className="bg-zinc-900">Non assigné</option>
                               {vendors.map(v => (
                                 <option key={v.id} value={v.id} className="bg-zinc-900">{v.name}</option>
                               ))}
                             </select>
                           </div>
                         </div>
                         <div className="flex items-center gap-3">
                           <button 
                             onClick={() => setSelectedLead(lead)}
                             className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-all group-hover:bg-white/10"
                             title="Voir Détails"
                           >
                              <FileText className="w-4 h-4" />
                           </button>
                           <a href={`tel:${lead.user_phone}`} className="p-3 rounded-xl bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400 hover:text-gray-900 transition-all shadow-lg shadow-yellow-400/5" title="Appeler">
                              <Phone className="w-4 h-4" />
                           </a>
                           <a 
                             href={`https://wa.me/${lead.user_phone.replace(/\D/g, '')}`} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="p-3 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all shadow-lg shadow-green-500/5" 
                             title="WhatsApp"
                           >
                              <MessageSquare className="w-4 h-4" />
                           </a>
                           <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">#{lead.id.slice(0, 8)}</p>
                         </div>
                       </>
                     )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedLead(null)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="relative p-8 border-b border-white/5">
              <button 
                onClick={() => setSelectedLead(null)}
                className="absolute right-6 top-6 p-2 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-yellow-400 flex items-center justify-center text-gray-900 font-black text-3xl">
                  {selectedLead.user_name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-1">{selectedLead.user_name}</h2>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${STATUS_CONFIG[selectedLead.status as LeadStatus]?.bg} ${STATUS_CONFIG[selectedLead.status as LeadStatus]?.color}`}>
                      {STATUS_CONFIG[selectedLead.status as LeadStatus]?.label}
                    </span>
                    <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">Client Krantos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3">Informations de contact</label>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-white font-bold group">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-yellow-400 group-hover:text-gray-900 transition-all">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Téléphone</p>
                        <a href={`tel:${selectedLead.user_phone}`} className="hover:text-yellow-400 transition-colors">{selectedLead.user_phone}</a>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-white font-bold group">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-yellow-400 group-hover:text-gray-900 transition-all">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Localisation</p>
                        <p>{selectedLead.location}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3">Vendeur Assigné</label>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <Building2 className="w-6 h-6 text-yellow-400" />
                    <div>
                      <p className="text-white font-black uppercase tracking-tight text-sm">{selectedLead.vendor_name || 'Non assigné'}</p>
                      <p className="text-[9px] text-gray-500 font-bold uppercase">Partenaire Krantos</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3">Besoins Énergétiques</label>
                  <div className="bg-yellow-400/10 border border-yellow-400/20 p-6 rounded-3xl text-center">
                    <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-3xl font-black text-white">{selectedLead.total_power_needed.toFixed(1)} <span className="text-lg">kVA</span></p>
                    <p className="text-[10px] text-yellow-400/60 font-black uppercase tracking-widest mt-1">Puissance Calculée</p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3">Détails techniques</label>
                  <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-bold uppercase tracking-widest">ID Lead</span>
                      <span className="text-white font-mono">{selectedLead.id.slice(0, 12)}...</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-bold uppercase tracking-widest">Date</span>
                      <span className="text-white font-bold">{new Date(selectedLead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-bold uppercase tracking-widest">Source</span>
                      <span className="text-white font-bold">Calculateur Web</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-8 bg-white/[0.02] border-t border-white/5 flex gap-4">
              <button 
                onClick={() => handleUpdateStatus(selectedLead.id, 'converted')}
                className="flex-1 bg-green-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-green-600 transition-all active:scale-95 shadow-lg shadow-green-500/10"
              >
                Marquer comme Converti
              </button>
              <button 
                onClick={() => setSelectedLead(null)}
                className="px-8 bg-white/5 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-white/10 transition-all active:scale-95 border border-white/10"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};


export default AdminLeads;
