// ============================================================
// Krantos Platform — /business-dashboard (Premium Dark Overhaul)
// Requirements: 11.1, 11.2, 4.1 (Commissions tab)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Package,
  Users,
  PlusCircle,
  LogOut,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  Loader2,
  ArrowRight,
  DollarSign,
  Briefcase,
  ChevronRight,
  Calendar,
  Phone,
  Camera,
  Upload,
  Bell,
  Download,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, Lead, LeadStatus } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VendorInfo {
  id: string;
  name: string;
  email: string | null;
  subscription_type: string;
  status: string;
  commission_rate: number;
  logo_url?: string | null;
  payment_notifications_count: number;
  last_notification_date?: string | null;
}

interface LeadMetrics {
  new: number;
  contacted: number;
  converted: number;
  lost: number;
}

interface CommissionRecord {
  id: string;
  amount: number;
  commission_rate_applied: number;
  status: string;
  type: string;
  created_at: string;
  lead_id?: string;
  leads?: { user_name: string } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEAD_STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  new: {
    label: 'Nouveaux',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
    icon: <Clock className="w-5 h-5" />,
  },
  contacted: {
    label: 'Contactés',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  converted: {
    label: 'Convertis',
    color: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/20',
    icon: <CheckCircle className="w-5 h-5" />,
  },
  lost: {
    label: 'Perdus',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    icon: <XCircle className="w-5 h-5" />,
  },
};

const COMMISSION_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_verification: { label: 'Attente', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  confirmed: { label: 'Confirmé', color: 'text-green-400', bg: 'bg-green-400/10' },
  rejected: { label: 'Rejeté', color: 'text-red-400', bg: 'bg-red-400/10' },
  rate_change: { label: 'Taux MAJ', color: 'text-blue-400', bg: 'bg-blue-400/10' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BusinessDashboard = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'commissions'>('overview');
  
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [allCommissions, setAllCommissions] = useState<CommissionRecord[]>([]);
  const [metrics, setMetrics] = useState<LeadMetrics>({ new: 0, contacted: 0, converted: 0, lost: 0 });
  const [period, setPeriod] = useState('month');
  const [leadFilter, setLeadFilter] = useState<'all' | 'contacted' | 'converted' | 'lost'>('all');
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  const playNotificationSound = () => {
    const audio = new Audio('/sounds/notifications_Krantos.mp3');
    audio.play().catch(e => console.warn('Sound play prevented by browser:', e));
  };

  useEffect(() => {
    if (!vendor?.id) return;
    
    const channel = supabase.channel(`vendor_${vendor.id}_notifications`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads', filter: `vendor_id=eq.${vendor.id}` },
        (payload) => {
          playNotificationSound();
          toast.success(`Nouveau lead assigné : ${payload.new.user_name}`, {
            icon: '🔔',
            duration: 10000,
          });
          // Update the local state
          setAllLeads(prev => [payload.new as Lead, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendor?.id]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/business-login', { replace: true });
        return;
      }

      const userId = sessionData.session.user.id;

      // Vendor Info
      const { data: vendorData, error: vError } = await supabase
        .from('vendors')
        .select('*')
        .eq('profile_id', userId)
        .single();

      const vd = vendorData as {
        status?: string;
        contract_end_date?: string | null;
        access_status?: string;
        access_restricted_until?: string | null;
        access_block_reason?: string | null;
      } | null;

      const end = vd?.contract_end_date ?? null;
      const today = new Date(new Date().toISOString().slice(0, 10));
      const hasValidContract = !end || new Date(end) >= today;

      const accessStatus = vd?.access_status ?? (vd?.status === 'active' ? 'active' : 'pending_validation');
      const restrictedUntil = vd?.access_restricted_until ? new Date(vd.access_restricted_until) : null;

      const isRestrictedNow =
        (accessStatus === 'restricted_3d' || accessStatus === 'restricted_7d' || accessStatus === 'restricted_30d') &&
        restrictedUntil !== null &&
        restrictedUntil >= today;

      const blocked =
        vError ||
        !vd ||
        accessStatus !== 'active' ||
        !hasValidContract ||
        isRestrictedNow;

      if (blocked) {
        setVendor(vendorData as VendorInfo);
        setLoading(false);
        return;
      }

      if (!mounted) return;
      setVendor(vendorData as VendorInfo);

      // Concurrent fetches
      const [pRes, lRes, cRes] = await Promise.all([
        supabase.from('products').select('*').eq('vendor_id', vendorData.id).order('created_at', { ascending: false }),
        supabase.from('leads').select('*').eq('vendor_id', vendorData.id).order('created_at', { ascending: false }),
        supabase.from('commission_records').select('*, leads!lead_id(user_name)').eq('vendor_id', vendorData.id).order('created_at', { ascending: false }),
      ]);

      if (mounted) {
        setProducts(pRes.data ?? []);
        const fetchedLeads: Lead[] = lRes.data ?? [];
        setAllLeads(fetchedLeads);
        const fetchedCommissions: CommissionRecord[] = cRes.data ?? [];
        setAllCommissions(fetchedCommissions);
        setLoading(false);
      }
    };

    init();
    return () => { mounted = false; };
  }, [navigate]);

  // Handle Filtering
  useEffect(() => {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'day': startDate.setHours(now.getHours() - 24); break;
      case 'week': startDate.setDate(now.getDate() - 7); break;
      case 'quarter': startDate.setMonth(now.getMonth() - 3); break;
      case 'semester': startDate.setMonth(now.getMonth() - 6); break;
      case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
      case 'month':
      default: startDate.setMonth(now.getMonth() - 1); break;
    }

    const filteredLeads = allLeads.filter(l => new Date(l.created_at) >= startDate);
    const filteredCommissions = allCommissions.filter(c => new Date(c.created_at) >= startDate);

    setLeads(filteredLeads);
    setCommissions(filteredCommissions);

    const m: LeadMetrics = { new: 0, contacted: 0, converted: 0, lost: 0 };
    for (const lead of filteredLeads) {
      if (lead.status in m) m[lead.status as LeadStatus]++;
    }
    setMetrics(m);
  }, [period, allLeads, allCommissions]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Déconnecté.');
    navigate('/business-login');
  };

  const handleUpdateLeadStatus = async (leadId: string, status: 'contacted' | 'converted' | 'lost') => {
    setUpdatingLeadId(leadId);
    try {
      const { error } = await supabase.from('leads').update({ status }).eq('id', leadId);
      if (error) throw error;
      setAllLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
      toast.success(`Lead marqué comme ${status === 'converted' ? 'Converti' : 'Perdu'}.`);
    } catch (err: any) {
      toast.error('Erreur : ' + err.message);
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const handleDownloadInvoice = () => {
    if (!vendor || commissions.length === 0) {
      toast.error('Aucune donnée de commission disponible.');
      return;
    }

    const headers = ['Date', 'ID LEAD', 'Client', 'Description', 'Montant (FCFA)', 'Taux (%)', 'Statut'];
    const confirmedComms = allCommissions.filter(c => c.status === 'confirmed');
    
    if (confirmedComms.length === 0) {
      toast.error('Aucune commission confirmée à facturer.');
      return;
    }

    const formatAmount = (amt: number) => amt.toLocaleString('fr-FR').replace(/[\s\u00A0]/g, '.');

    const rows = confirmedComms.map(c => [
      new Date(c.created_at).toLocaleDateString('fr-FR'),
      c.lead_id?.slice(0, 8) ?? 'N/A',
      c.leads?.user_name ?? 'N/A',
      `Vente Lead - ${c.leads?.user_name ?? 'Client'}`,
      formatAmount(Number(c.amount)),
      c.commission_rate_applied,
      'Confirmé'
    ]);

    const csvContent = [
      `FACTURE DE COMMISSIONS - KRANTOS\nVendeur: ${vendor.name}\nDate: ${new Date().toLocaleDateString('fr-FR')}\n`,
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Facture_Krantos_${vendor.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Facture téléchargée.');
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  // Pending State View
  if (vendor?.status === 'pending') {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-card p-10 rounded-[3rem] border-yellow-400/20 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5"><Zap size={120} className="text-yellow-400" /></div>
          <div className="w-20 h-20 rounded-3xl bg-yellow-400/10 flex items-center justify-center mx-auto mb-8 animate-pulse">
            <Clock className="w-10 h-10 text-yellow-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-4 tracking-tight">Validation en cours</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Bonjour <span className="text-white font-bold">{vendor.name}</span>. Votre compte est actuellement en cours de revue par l'équipe Krantos. Vous recevrez un accès complet dès validation.
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-500">
              Délai moyen constaté : 24h
            </div>
            <button 
              onClick={handleSignOut}
              className="w-full py-4 rounded-2xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all font-bold text-sm"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center">
               <Briefcase className="w-5 h-5 text-yellow-500" />
            </div>
            <h1 className="text-4xl font-black text-white">Bonjour, {vendor?.name.split(' ')[0]} 👋</h1>
          </div>
          <p className="text-gray-500 text-lg uppercase tracking-widest text-xs font-black">
             Partenaire {vendor?.subscription_type} · Lomé, Togo
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <div className="relative group">
            <button 
              className={`p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all relative ${vendor?.payment_notifications_count && vendor.payment_notifications_count > 0 ? 'animate-bounce text-yellow-400 shadow-lg shadow-yellow-400/20' : ''}`}
            >
              <Bell className={vendor?.payment_notifications_count && vendor.payment_notifications_count > 0 ? 'animate-ring' : ''} />
              {vendor?.payment_notifications_count && vendor.payment_notifications_count > 0 && (
                <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0c] animate-pulse" />
              )}
            </button>
            
            {/* Popover */}
            <div className="absolute right-0 top-full mt-4 w-72 glass-card p-6 rounded-3xl border-white/10 shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all z-50">
               <h3 className="font-black text-xs uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                 <Bell size={14} className="text-yellow-400" /> Notifications
               </h3>
               {vendor?.payment_notifications_count && vendor.payment_notifications_count > 0 ? (
                 <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                      <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-white mb-1">Rappel de paiement</p>
                        <p className="text-[10px] text-red-400 leading-tight">Vous avez {vendor.payment_notifications_count} rappel(s) de paiement pour vos commissions. Veuillez régulariser votre solde.</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleDownloadInvoice}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-400 text-black font-bold text-[10px] uppercase tracking-widest hover:bg-yellow-500 transition-all"
                    >
                      <Download size={14} /> Télécharger Facture
                    </button>
                 </div>
               ) : (
                 <p className="text-[10px] text-gray-500 font-medium text-center py-4 italic">Aucune nouvelle notification.</p>
               )}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 transition-all text-sm font-bold"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ring {
          0% { transform: rotate(0); }
          10% { transform: rotate(15deg); }
          20% { transform: rotate(-15deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-10deg); }
          50% { transform: rotate(5deg); }
          60% { transform: rotate(-5deg); }
          70% { transform: rotate(0); }
          100% { transform: rotate(0); }
        }
        .animate-ring {
          animation: ring 1s ease infinite;
          transform-origin: top center;
        }
      `}} />

      {/* Period Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Performance sur la période</h2>
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/10 overflow-x-auto">
          {[
            { id: 'day', label: 'Jour' },
            { id: 'week', label: 'Semaine' },
            { id: 'month', label: 'Mois' },
            { id: 'quarter', label: 'Trimestre' },
            { id: 'semester', label: 'Semestre' },
            { id: 'year', label: 'An' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                period === p.id 
                  ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' 
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl w-fit mb-12">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-yellow-400 text-gray-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
        >
          Tableau de bord
        </button>
        <button
          onClick={() => setActiveTab('commissions')}
          className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'commissions' ? 'bg-yellow-400 text-gray-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
        >
          Commissions
        </button>
        <Link to="/leads" className="px-6 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-all">
          Leads
        </Link>
        <Link to="/add-product" className="px-6 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-all">
          Produits
        </Link>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-12"
          >
            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {(Object.keys(LEAD_STATUS_CONFIG) as LeadStatus[]).map((status) => {
                const cfg = LEAD_STATUS_CONFIG[status];
                return (
                  <div key={status} className="glass-card p-6 rounded-3xl border-white/5 flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${cfg.bg}`}>
                      {cfg.icon}
                    </div>
                    <div>
                      <p className={`text-2xl font-black ${cfg.color}`}>{metrics[status]}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{cfg.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Revenue Banner */}
            {(() => {
              const totalBalance = allCommissions
                .filter(c => c.status === 'confirmed')
                .reduce((acc, c) => acc + Number(c.amount), 0);
              const periodBalance = commissions
                .filter(c => c.status === 'confirmed')
                .reduce((acc, c) => acc + Number(c.amount), 0);
              return totalBalance > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass-card p-6 rounded-3xl border-yellow-400/20 bg-yellow-400/[0.03] flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-yellow-400">{periodBalance.toLocaleString('fr-FR')} FCFA</p>
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Revenu généré (période)</p>
                    </div>
                  </div>
                  <div className="glass-card p-6 rounded-3xl border-white/5 flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-green-400/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-green-400">{totalBalance.toLocaleString('fr-FR')} FCFA</p>
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Solde total à facturer</p>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Quick Actions & Recent */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* Lead filter tabs */}
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Mes Leads</h2>
                  <Link to="/leads" className="text-xs font-bold text-yellow-400 hover:underline flex items-center gap-1">
                    Voir tout <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'contacted', 'converted', 'lost'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setLeadFilter(f)}
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                        leadFilter === f
                          ? 'bg-yellow-400 text-black border-yellow-400'
                          : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {f === 'all' ? `Tous (${leads.length})` :
                       f === 'contacted' ? `Contacté (${leads.filter(l => l.status === 'contacted').length})` :
                       f === 'converted' ? `Converti (${leads.filter(l => l.status === 'converted').length})` :
                       `Perdu (${leads.filter(l => l.status === 'lost').length})`}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {leads
                    .filter(l => leadFilter === 'all' || l.status === leadFilter)
                    .slice(0, 6)
                    .map((lead) => {
                      const cfg = LEAD_STATUS_CONFIG[lead.status as LeadStatus];
                      const isUpdating = updatingLeadId === lead.id;
                      return (
                        <div key={lead.id} className="glass-card p-4 rounded-3xl border-white/5 hover:border-white/10 transition-colors group/lead">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-sm text-gray-500 flex-shrink-0">
                                {lead.user_name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-white text-sm truncate">{lead.user_name}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{lead.location}</p>
                                  <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${cfg?.bg} ${cfg?.color}`}>
                                    {cfg?.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p className="text-xs font-black text-white hidden md:block">{lead.total_power_needed.toFixed(1)} kVA</p>
                              {isUpdating ? (
                                <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                              ) : (
                                <>
                                  {lead.user_phone && (
                                    <a
                                      href={`https://wa.me/${lead.user_phone.replace(/\D/g,'').length === 8 ? '228' + lead.user_phone.replace(/\D/g,'') : lead.user_phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Bonjour ${lead.user_name}, suite à votre simulation sur Krantos, je suis disponible pour vous accompagner.`)}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all"
                                      title="WhatsApp"
                                    >
                                      <Phone size={13} />
                                    </a>
                                  )}
                                  {lead.status !== 'converted' && (
                                    <button
                                      onClick={() => handleUpdateLeadStatus(lead.id, 'converted')}
                                      className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest px-2"
                                      title="Marquer converti"
                                    >
                                      ✓
                                    </button>
                                  )}
                                  {lead.status !== 'lost' && lead.status !== 'converted' && (
                                    <button
                                      onClick={() => handleUpdateLeadStatus(lead.id, 'lost')}
                                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest px-2"
                                      title="Marquer perdu"
                                    >
                                      ✗
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                  })}
                  {leads.filter(l => leadFilter === 'all' || l.status === leadFilter).length === 0 && (
                    <p className="text-center py-10 text-gray-600 italic text-sm">Aucun lead dans cette catégorie.</p>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] px-2">Mon Profil</h2>
                <div className="glass-card p-8 rounded-[2.5rem] border-white/5 relative overflow-hidden group/profile">
                   <div className="flex items-center gap-4 mb-8">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-yellow-400 overflow-hidden flex items-center justify-center font-black text-gray-900 text-2xl shadow-lg shadow-yellow-400/20">
                           {vendor?.logo_url ? (
                             <img src={vendor.logo_url} alt={vendor.name} className="w-full h-full object-cover" />
                           ) : (
                             vendor?.name.charAt(0)
                           )}
                        </div>
                        <label className="absolute -bottom-2 -right-2 p-2 bg-black border border-white/10 rounded-xl text-white cursor-pointer hover:bg-yellow-400 hover:text-black transition-all shadow-xl opacity-0 group-hover/profile:opacity-100">
                          <Camera size={14} />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file || !vendor) return;

                              const loadingToast = toast.loading('Mise à jour du logo...');
                              try {
                                const fileExt = file.name.split('.').pop();
                                const filePath = `${(await supabase.auth.getUser()).data.user?.id}/logo_${Math.random()}.${fileExt}`;

                                const { error: uploadError } = await supabase.storage
                                  .from('product-images')
                                  .upload(filePath, file, { upsert: true });

                                if (uploadError) throw uploadError;

                                const { data: { publicUrl } } = supabase.storage
                                  .from('product-images')
                                  .getPublicUrl(filePath);

                                const { error: updateError } = await supabase
                                  .from('vendors')
                                  .update({ logo_url: publicUrl })
                                  .eq('id', vendor.id);

                                if (updateError) throw updateError;

                                setVendor({ ...vendor, logo_url: publicUrl });
                                toast.success('Logo mis à jour !', { id: loadingToast });
                              } catch (error: any) {
                                toast.error('Erreur: ' + error.message, { id: loadingToast });
                              }
                            }}
                          />
                        </label>
                      </div>
                      <div>
                         <p className="font-black text-white tracking-tight leading-tight mb-1">{vendor?.name}</p>
                         <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Commission : {vendor?.commission_rate}%</p>
                      </div>
                   </div>
                   <div className="space-y-4 pt-6 border-t border-white/5">
                      <Link to="/add-product" className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
                        <PlusCircle className="w-4 h-4" />
                        Ajouter un produit
                      </Link>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="commissions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Commission Summary */}
                <div className="glass-card p-10 rounded-[2.5rem] border-yellow-400/20 bg-yellow-400/[0.02] accent-glow">
                   <span className="text-[10px] font-black text-yellow-500/50 uppercase tracking-[0.2em] mb-4 block">Solde à facturer</span>
                   <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-5xl font-black text-yellow-400">
                         {commissions.filter(c => c.status === 'confirmed').reduce((acc, c) => acc + Number(c.amount), 0).toLocaleString('fr-FR')}
                      </span>
                      <span className="text-xl font-bold text-yellow-400/60">FCFA</span>
                   </div>
                   <p className="text-xs text-gray-500 font-medium tracking-wide">Calculé sur les ventes confirmées</p>
                </div>

                <div className="glass-card p-10 rounded-[2.5rem] border-white/5">
                   <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 block">Taux appliqué</span>
                   <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-5xl font-black text-white">{vendor?.commission_rate}</span>
                      <span className="text-xl font-bold text-gray-500">%</span>
                   </div>
                   <p className="text-xs text-gray-500 font-medium tracking-wide">Garanti par votre contrat Krantos</p>
                </div>
             </div>

             <div className="space-y-6">
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] px-2">Historique des commissions</h2>
                <div className="space-y-3">
                   {commissions.map((c, i) => {
                      const cfg = COMMISSION_STATUS_CONFIG[c.status] || { label: c.status, color: 'text-gray-400', bg: 'bg-white/5' };
                      return (
                        <div key={c.id} className="glass-card p-5 rounded-2xl border-white/5 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                                 <DollarSign className={`w-5 h-5 ${cfg.color}`} />
                              </div>
                              <div>
                               <p className="text-sm font-bold text-white uppercase tracking-tight">
                                    {c.type === 'conversion' ? `Vente Lead - ${c.leads?.user_name ?? 'Client'}` : 'Modification Taux'}
                                 </p>
                                 <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(c.created_at).toLocaleDateString('fr-FR')} {c.lead_id && `· ID: #${c.lead_id.slice(0, 8)}`}
                                 </p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-sm font-black text-white">
                                 {c.type === 'conversion' ? `${Number(c.amount).toLocaleString('fr-FR')} FCFA` : '—'}
                              </p>
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                                 {cfg.label}
                              </span>
                           </div>
                        </div>
                      );
                   })}
                   {commissions.length === 0 && <p className="text-center py-20 text-gray-600">Aucune commission enregistrée.</p>}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusinessDashboard;
