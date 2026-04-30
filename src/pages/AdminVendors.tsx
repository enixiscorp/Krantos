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

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

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

      const { error } = await supabase
        .from('vendors')
        .update({ status })
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
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center font-black text-gray-500 text-2xl group-hover:bg-yellow-400/10 group-hover:text-yellow-400 transition-all">
                      {vendor.name.charAt(0)}
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
    </div>
  );
};

export default AdminVendors;
