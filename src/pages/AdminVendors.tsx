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
  Download,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vendor, VendorStatus } from '../lib/supabase';
import { EmailService } from '../services/emailService';


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  "Énergie solaire",
  "Énergie éolienne",
  "Biomasse & Biogaz",
  "Hydroélectricité",
  "Géothermie",
  "Audit Énergétique",
  "Installation Électrique",
  "Maintenance & SAV",
  "Pompage Solaire",
  "Éclairage Public",
  "Froid & Climatisation",
  "Formation & Conseil",
  "Vente de Matériel"
];

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

const SUBSCRIPTION_BENEFITS: Record<string, { leads: string; access: string; priority: string; features: string[] }> = {
  free: {
    leads: '2 leads gratuits',
    access: 'Accès limité (14 jours)',
    priority: 'Pas de priorité',
    features: ['Simulation de puissance', 'Profil public basique']
  },
  basic: {
    leads: '10 - 35 leads inclus',
    access: 'Accès standard (1-3 mois)',
    priority: 'Priorité standard',
    features: ['Gestion des produits', 'Dashboard analytique', 'Support email']
  },
  premium: {
    leads: '80 - 180 leads inclus',
    access: 'Accès illimité (6-12 mois)',
    priority: 'Haute priorité',
    features: ['Dashboard avancé', 'Support prioritaire', 'Mise en avant premium', 'Statistiques détaillées']
  }
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

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVendor, setNewVendor] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    category: 'Énergie solaire',
    subscription_type: 'free',
    billing_period: 'monthly'
  });

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/admin-login', { replace: true });
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
    try {
      const { data: currentVendor } = await supabase.from('vendors').select('name, email').eq('id', vendorId).single();

      const updates: any = { status };
      if (status === 'active') {
        updates.access_status = 'active';
      }

      const { error } = await supabase
        .from('vendors')
        .update(updates)
        .eq('id', vendorId);

      if (error) throw error;
      
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status } : v));
      if (selectedVendor?.id === vendorId) {
        setSelectedVendor(prev => prev ? { ...prev, status } : null);
      }
      
      toast.success(`Statut du vendeur mis à jour.`);

      // Trigger automatic email if applicable
      if (currentVendor?.email) {
        if (status === 'active') {
          await EmailService.sendValidationEmail(currentVendor.name, currentVendor.email);
        } else if (status === 'suspended') {
          await EmailService.sendSuspensionEmail(currentVendor.name, currentVendor.email);
        }
      }
    } catch (err) {
      toast.error('Erreur lors de la mise à jour.');
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pro-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          company_name: newVendor.name,
          category: newVendor.category,
          phone: newVendor.phone,
          email: newVendor.email,
          password: newVendor.password,
          contract_duration: 12,
          subscription_type: newVendor.subscription_type,
          billing_period: newVendor.billing_period,
        }),
      });

      if (!res.ok) throw new Error('Erreur lors de la création');

      toast.success('Vendeur créé avec succès !');
      setShowAddModal(false);
      setNewVendor({ name: '', email: '', password: '', phone: '', category: 'Énergie solaire', subscription_type: 'free', billing_period: 'monthly' });
      // Refresh list
      const { data } = await supabase.from('vendors').select('*').order('created_at', { ascending: false });
      setVendors(data ?? []);
    } catch (err) {
      toast.error('Impossible de créer le vendeur.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (vendors.length === 0) return;

    const headers = ['Nom', 'Email', 'Téléphone', 'Catégorie', 'Statut', 'Abonnement', 'Date Inscription'];
    const rows = filteredVendors.map(v => [
      v.name,
      v.email || '',
      v.phone,
      v.category,
      STATUS_CONFIG[v.status as VendorStatus]?.label || v.status,
      SUBSCRIPTION_LABELS[v.subscription_type] || v.subscription_type,
      new Date(v.created_at).toLocaleDateString('fr-FR')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vendeurs_krantos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Fichier CSV généré.');
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
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group font-bold text-xs uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter">Vendeurs</h1>
          <p className="text-gray-500 text-lg font-medium">Gestion des partenaires et validation des comptes.</p>
        </motion.div>

        <div className="flex items-center gap-3">
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-yellow-400 text-gray-900 font-black text-xs uppercase tracking-widest hover:bg-yellow-500 transition-all active:scale-95 shadow-lg shadow-yellow-400/20"
          >
            <Zap className="w-4 h-4" />
            + Nouveau Vendeur
          </motion.button>
          
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </motion.button>
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
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {(['all', 'pending', 'active', 'suspended'] as const).map(s => {
            const count = s === 'all' ? vendors.length : (countsByStatus[s] ?? 0);
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
        {filteredVendors.length === 0 ? (
          <div className="glass-card p-20 rounded-[3rem] text-center border-white/5">
            <Users className="w-16 h-16 text-gray-800 mx-auto mb-6" />
            <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Aucun vendeur trouvé.</p>
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
                transition={{ delay: i * 0.02 }}
                className="glass-card p-6 rounded-3xl border-white/5 hover:border-white/10 transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 overflow-hidden flex items-center justify-center font-black text-gray-500 text-2xl group-hover:bg-yellow-400/10 group-hover:text-yellow-400 transition-all shadow-lg">
                      {vendor.logo_url ? (
                        <img src={vendor.logo_url} alt={vendor.name} className="w-full h-full object-cover" />
                      ) : (
                        vendor.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-black text-white uppercase tracking-tight text-lg">{vendor.name}</h3>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusCfg.bg} ${statusCfg.color} flex items-center gap-1.5`}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/5">
                           {SUBSCRIPTION_LABELS[vendor.subscription_type] || vendor.subscription_type}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                         <span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> {vendor.category}</span>
                         <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {vendor.phone}</span>
                         <span className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {vendor.email || 'Pas d\'email'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 leading-none">
                     {isUpdating ? (
                       <div className="px-6">
                         <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                       </div>
                     ) : (
                       <>
                         {vendor.status !== 'active' && (
                           <button
                             onClick={() => handleUpdateStatus(vendor.id, 'active')}
                             className="px-4 py-3 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                           >
                             <Check className="w-4 h-4" />
                             Valider
                           </button>
                         )}
                         {vendor.status !== 'suspended' && (
                           <button
                             onClick={() => handleUpdateStatus(vendor.id, 'suspended')}
                             className="px-4 py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                           >
                             <AlertTriangle className="w-4 h-4" />
                             Suspendre
                           </button>
                         )}
                         <button 
                           onClick={() => setSelectedVendor(vendor)}
                           className="p-3 rounded-xl bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                         >
                            <ChevronRight className="w-5 h-5" />
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

      {/* Details Modal */}
      <AnimatePresence>
        {selectedVendor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVendor(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-3xl bg-yellow-400/10 flex items-center justify-center font-black text-yellow-400 text-3xl">
                      {selectedVendor.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">{selectedVendor.name}</h2>
                      <div className="flex items-center gap-3">
                         <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${STATUS_CONFIG[selectedVendor.status as VendorStatus].bg} ${STATUS_CONFIG[selectedVendor.status as VendorStatus].color} flex items-center gap-1.5`}>
                           {STATUS_CONFIG[selectedVendor.status as VendorStatus].icon}
                           {STATUS_CONFIG[selectedVendor.status as VendorStatus].label}
                         </span>
                         <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/5">
                            {SUBSCRIPTION_LABELS[selectedVendor.subscription_type] || selectedVendor.subscription_type}
                         </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedVendor(null)}
                    className="p-3 rounded-2xl bg-white/5 text-gray-500 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-10">
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Informations de contact</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-white font-bold text-sm bg-white/5 p-4 rounded-2xl border border-white/5">
                          <Mail className="w-4 h-4 text-yellow-400" />
                          {selectedVendor.email || 'Non renseigné'}
                        </div>
                        <div className="flex items-center gap-3 text-white font-bold text-sm bg-white/5 p-4 rounded-2xl border border-white/5">
                          <Phone className="w-4 h-4 text-yellow-400" />
                          {selectedVendor.phone}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Détails entreprise</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-white font-bold text-sm bg-white/5 p-4 rounded-2xl border border-white/5">
                          <Building2 className="w-4 h-4 text-yellow-400" />
                          {selectedVendor.category}
                        </div>
                        <div className="flex items-center gap-3 text-white font-bold text-sm bg-white/5 p-4 rounded-2xl border border-white/5">
                          <Calendar className="w-4 h-4 text-yellow-400" />
                          Inscrit le {new Date(selectedVendor.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest ml-1">Période de facturation</label>
                          <select
                            value={(selectedVendor as any).billing_period || 'monthly'}
                            onChange={async (e) => {
                              const val = e.target.value;
                              try {
                                const { error } = await supabase.from('vendors').update({ billing_period: val }).eq('id', selectedVendor.id);
                                if (error) throw error;
                                setVendors(prev => prev.map(v => v.id === selectedVendor.id ? { ...v, billing_period: val } as any : v));
                                setSelectedVendor(prev => prev ? { ...prev, billing_period: val } as any : null);
                                toast.success('Période mise à jour');
                              } catch (err) {
                                toast.error('Erreur lors du changement de période');
                              }
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-yellow-400/50"
                          >
                            <option value="weekly" className="bg-[#0A0A0A]">Hebdomadaire (Seuil: 4)</option>
                            <option value="monthly" className="bg-[#0A0A0A]">Mensuel (Seuil: 3)</option>
                            <option value="quarterly" className="bg-[#0A0A0A]">Trimestriel (Seuil: 4)</option>
                            <option value="semi-annual" className="bg-[#0A0A0A]">Semestriel (Seuil: 2)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription Objectives Section */}
                <div className="mb-10 p-6 rounded-[2rem] bg-yellow-400/5 border border-yellow-400/20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <ShieldCheck size={80} className="text-yellow-400" />
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-xs font-black text-yellow-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Zap size={14} />
                      Objectifs & Avantages de l'abonnement
                    </h4>
                    
                    {(() => {
                      const benefits = SUBSCRIPTION_BENEFITS[selectedVendor.subscription_type] || SUBSCRIPTION_BENEFITS.free;
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                            <p className="text-[8px] text-gray-500 uppercase font-black mb-1">Capacité Leads</p>
                            <p className="text-xs font-bold text-white">{benefits.leads}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                            <p className="text-[8px] text-gray-500 uppercase font-black mb-1">Durée / Accès</p>
                            <p className="text-xs font-bold text-white">{benefits.access}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                            <p className="text-[8px] text-gray-500 uppercase font-black mb-1">Niveau Priorité</p>
                            <p className="text-xs font-bold text-white">{benefits.priority}</p>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Fonctionnalités incluses :</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {(SUBSCRIPTION_BENEFITS[selectedVendor.subscription_type] || SUBSCRIPTION_BENEFITS.free).features.map((f, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[10px] text-gray-400">
                            <div className="w-1 h-1 rounded-full bg-yellow-400" />
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-t border-white/10 pt-8">
                   <button
                     disabled={updatingId === selectedVendor.id || selectedVendor.status === 'active'}
                     onClick={() => handleUpdateStatus(selectedVendor.id, 'active')}
                     className="flex-1 h-14 rounded-2xl bg-green-500 text-white font-black text-xs uppercase tracking-widest hover:bg-green-600 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                   >
                     <Check className="w-5 h-5" />
                     Valider le compte
                   </button>
                   <button
                     disabled={updatingId === selectedVendor.id || selectedVendor.status === 'suspended'}
                     onClick={() => handleUpdateStatus(selectedVendor.id, 'suspended')}
                     className="flex-1 h-14 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                   >
                     <AlertTriangle className="w-5 h-5" />
                     Suspendre
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Add Vendor Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden p-10"
            >
              <h2 className="text-3xl font-black text-white mb-6 tracking-tight uppercase">Nouveau Vendeur</h2>
              <form onSubmit={handleAddVendor} className="space-y-4">
                <input
                  value={newVendor.name}
                  onChange={e => setNewVendor({...newVendor, name: e.target.value})}
                  placeholder="Nom de l'entreprise"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm"
                  required
                />
                <input
                  type="email"
                  value={newVendor.email}
                  onChange={e => setNewVendor({...newVendor, email: e.target.value})}
                  placeholder="Email Professionnel"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm"
                  required
                />
                <input
                  type="password"
                  value={newVendor.password}
                  onChange={e => setNewVendor({...newVendor, password: e.target.value})}
                  placeholder="Mot de passe provisoire"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm"
                  required
                />
                <input
                  value={newVendor.phone}
                  onChange={e => setNewVendor({...newVendor, phone: e.target.value})}
                  placeholder="Téléphone (+228...)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm"
                  required
                />
                <select
                  value={newVendor.category}
                  onChange={e => setNewVendor({...newVendor, category: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm"
                  required
                >
                  <option value="" disabled className="bg-[#0A0A0A]">Sélectionner une catégorie</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-[#0A0A0A]">{cat}</option>
                  ))}
                </select>
                <select
                  value={newVendor.billing_period}
                  onChange={e => setNewVendor({...newVendor, billing_period: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm"
                  required
                >
                  <option value="weekly" className="bg-[#0A0A0A]">Période: Hebdomadaire (4 rappels)</option>
                  <option value="monthly" className="bg-[#0A0A0A]">Période: Mensuelle (3 rappels)</option>
                  <option value="quarterly" className="bg-[#0A0A0A]">Période: Trimestrielle (4 rappels)</option>
                  <option value="semi-annual" className="bg-[#0A0A0A]">Période: Semestrielle (2 rappels)</option>
                </select>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 h-14 rounded-2xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] h-14 rounded-2xl bg-yellow-400 text-gray-900 font-black text-xs uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-400/20"
                  >
                    Créer le compte
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminVendors;
