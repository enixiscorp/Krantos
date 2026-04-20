// ============================================================
// Krantos Platform — /admin/leads (Premium Dark Overhaul)
// Requirements: 13.4
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Zap,
  Loader2,
  Users,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  Building2,
  Filter,
  Search,
  ChevronRight,
  TrendingUp,
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
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/business-login', { replace: true });
        return;
      }

      const [leadsResult, vendorsResult] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('vendors').select('id, name'),
      ]);

      if (leadsResult.error) {
        toast.error('Erreur lors du chargement des leads.');
      } else if (mounted) {
        const vendorMap = new Map<string, string>(
          (vendorsResult.data ?? []).map((v: { id: string; name: string }) => [v.id, v.name])
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
        <div>
          <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-4xl font-black text-white mb-2">Suivi des Leads</h1>
          <p className="text-gray-500 text-lg">Vue globale des opportunités commerciales sur la plateforme.</p>
        </div>
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
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {(['all', 'new', 'contacted', 'converted', 'lost'] as const).map(s => {
            const count = s === 'all' ? leads.length : (countsByStatus[s] ?? 0);
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
        {filteredLeads.length === 0 ? (
          <div className="glass-card p-16 rounded-[2.5rem] text-center border-white/5">
            <TrendingUp className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 font-bold">Aucun lead trouvé.</p>
          </div>
        ) : (
          filteredLeads.map((lead, i) => {
            const cfg = STATUS_CONFIG[lead.status as LeadStatus] || STATUS_CONFIG.new;
            return (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card p-6 rounded-3xl border-white/5 hover:border-white/10 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center font-black text-gray-500 text-xl">
                      {lead.user_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-white uppercase tracking-tight">{lead.user_name}</h3>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.color} flex items-center gap-1.5`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                         <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {lead.location}</span>
                         <span className="flex items-center gap-1.5"><Zap className="w-3 h-3" /> {lead.total_power_needed.toFixed(1)} kVA</span>
                         <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(lead.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 md:text-right">
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                       <Building2 className="w-3 h-3 text-gray-500" />
                       <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                          {lead.vendor_name || 'Non assigné'}
                       </span>
                    </div>
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">#{lead.id.slice(0, 8)}</p>
                  </div>

                  <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 leading-none">
                     <a href={`tel:${lead.user_phone}`} className="p-3 rounded-xl bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400 hover:text-gray-900 transition-all">
                        <Phone className="w-4 h-4" />
                     </a>
                     <button className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-all">
                        <ChevronRight className="w-4 h-4" />
                     </button>
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

export default AdminLeads;
