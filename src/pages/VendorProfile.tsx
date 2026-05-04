// ============================================================
// Krantos Platform — /vendor-profile (Premium Dark)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  User,
  Phone,
  Store,
  CreditCard,
  Truck,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Camera,
  Loader2,
  ChevronDown,
  Mail,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentMethod {
  type: string;
  details: string;
}

interface DeliveryOption {
  type: string;
  details: string;
}

interface VendorProfileData {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  logo_url: string | null;
  payment_methods: PaymentMethod[];
  delivery_options: DeliveryOption[];
}

const PAYMENT_TYPES = [
  "Flooz Money",
  "Mixx by Yaas",
  "T-Money",
  "Moov Money",
  "Espèces",
  "Virement Bancaire"
];

const DELIVERY_TYPES = [
  "Boutique",
  "Livraison à domicile (par équipe)",
  "Livraison à domicile (Frais du client)",
  "Point Relais"
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VendorProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendor, setVendor] = useState<VendorProfileData | null>(null);
  const [uploading, setUploading] = useState(false);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [upgradeForm, setUpgradeForm] = useState({
    tier: 'basic',
    period: 'monthly'
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/business-login');
        return;
      }

      const [vRes, rRes] = await Promise.all([
        supabase
          .from('vendors')
          .select('id, name, phone, email, logo_url, payment_methods, delivery_options, subscription_type, billing_period')
          .eq('profile_id', session.user.id)
          .single(),
        supabase
          .from('subscription_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
      ]);

      if (vRes.error || !vRes.data) {
        toast.error('Erreur lors du chargement du profil.');
        navigate('/business-dashboard');
        return;
      }

      setVendor({
        ...vRes.data,
        payment_methods: vRes.data.payment_methods || [],
        delivery_options: vRes.data.delivery_options || []
      });
      if (rRes.data && rRes.data.length > 0) {
        setPendingRequest(rRes.data[0]);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [navigate]);

  const handleUpgradeSubmit = async () => {
    if (!vendor) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('subscription_requests')
        .insert({
          vendor_id: vendor.id,
          requested_tier: upgradeForm.tier,
          requested_period: upgradeForm.period
        });

      if (error) throw error;
      toast.success('Demande d\'upgrade soumise avec succès.');
      setShowUpgradeModal(false);
      setPendingRequest({ requested_tier: upgradeForm.tier, requested_period: upgradeForm.period });
    } catch (err: any) {
      toast.error('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!vendor || saving) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('vendors')
        .update({
          name: vendor.name,
          phone: vendor.phone,
          payment_methods: vendor.payment_methods,
          delivery_options: vendor.delivery_options
        })
        .eq('id', vendor.id);

      if (error) throw error;
      toast.success('Profil mis à jour avec succès.');
    } catch (err: any) {
      toast.error('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vendor) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 2MB.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendor.id}-${Math.random()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('vendors')
        .update({ logo_url: publicUrl })
        .eq('id', vendor.id);

      if (updateError) throw updateError;

      setVendor(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      toast.success('Logo mis à jour.');
    } catch (err: any) {
      toast.error('Erreur upload : ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const addPaymentMethod = () => {
    if (!vendor) return;
    setVendor({
      ...vendor,
      payment_methods: [...vendor.payment_methods, { type: PAYMENT_TYPES[0], details: '' }]
    });
  };

  const removePaymentMethod = (index: number) => {
    if (!vendor) return;
    const newList = [...vendor.payment_methods];
    newList.splice(index, 1);
    setVendor({ ...vendor, payment_methods: newList });
  };

  const updatePaymentMethod = (index: number, field: keyof PaymentMethod, value: string) => {
    if (!vendor) return;
    const newList = [...vendor.payment_methods];
    newList[index] = { ...newList[index], [field]: value };
    setVendor({ ...vendor, payment_methods: newList });
  };

  const addDeliveryOption = () => {
    if (!vendor) return;
    setVendor({
      ...vendor,
      delivery_options: [...vendor.delivery_options, { type: DELIVERY_TYPES[0], details: '' }]
    });
  };

  const removeDeliveryOption = (index: number) => {
    if (!vendor) return;
    const newList = [...vendor.delivery_options];
    newList.splice(index, 1);
    setVendor({ ...vendor, delivery_options: newList });
  };

  const updateDeliveryOption = (index: number, field: keyof DeliveryOption, value: string) => {
    if (!vendor) return;
    const newList = [...vendor.delivery_options];
    newList[index] = { ...newList[index], [field]: value };
    setVendor({ ...vendor, delivery_options: newList });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <Link to="/business-dashboard" className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all group">
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Profil Entreprise</h1>
              <p className="text-gray-500 text-sm font-black uppercase tracking-widest mt-1">Personnalisez votre présence sur Krantos</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-4 rounded-2xl bg-yellow-400 text-black font-black text-sm uppercase tracking-widest hover:bg-yellow-500 transition-all flex items-center gap-2 shadow-xl shadow-yellow-400/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Enregistrer
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar: Identity */}
          <div className="space-y-8">
            <div className="glass-card p-8 rounded-[2.5rem] border-white/5 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative inline-block mb-6">
                <div className="w-32 h-32 rounded-[2.5rem] bg-white/5 border-2 border-white/10 flex items-center justify-center overflow-hidden">
                  {vendor?.logo_url ? (
                    <img src={vendor.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Store size={48} className="text-gray-700" />
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-yellow-400 text-black flex items-center justify-center cursor-pointer hover:bg-yellow-500 transition-all shadow-lg shadow-black/50 group/upload">
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                </label>
              </div>

              <div className="space-y-4 text-left">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block mb-2">Nom de l'entreprise</label>
                  <div className="relative">
                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type="text"
                      value={vendor?.name || ''}
                      onChange={e => setVendor(prev => prev ? { ...prev, name: e.target.value } : null)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-yellow-400/50 outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block mb-2">Téléphone principal</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type="tel"
                      value={vendor?.phone || ''}
                      onChange={e => setVendor(prev => prev ? { ...prev, phone: e.target.value } : null)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-yellow-400/50 outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-3 text-gray-600 text-[10px] font-black uppercase tracking-widest px-1">
                  <Mail size={12} />
                  <span className="truncate">{vendor?.email}</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-8 rounded-[2.5rem] border-yellow-400/10 bg-yellow-400/[0.02]">
               <div className="flex items-center gap-3 mb-4">
                  <Zap className="text-yellow-500 w-5 h-5" />
                  <h4 className="text-sm font-black uppercase tracking-widest">Conseil Krantos</h4>
               </div>
               <p className="text-xs text-gray-500 leading-relaxed font-medium mb-6">
                 Ajoutez vos modes de paiement et options de livraison pour rassurer vos clients et faciliter leurs achats directement depuis le rapport énergétique.
               </p>
            </div>

            {/* Subscription Section */}
            <div className="glass-card p-8 rounded-[2.5rem] border-white/5 relative overflow-hidden group">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black tracking-tight">Abonnement & Contrat</h3>
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500">
                    <ShieldCheck size={16} />
                  </div>
               </div>
               
               <div className="space-y-4">
                 <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                   <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Plan Actuel</p>
                   <p className="text-sm font-black text-yellow-400 uppercase tracking-tight">{(vendor as any)?.subscription_type || 'Free'}</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                   <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Cycle de facturation</p>
                   <p className="text-sm font-black text-white uppercase tracking-tight">{(vendor as any)?.billing_period || 'Mensuel'}</p>
                 </div>

                 {pendingRequest ? (
                   <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                     <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Demande en cours</p>
                     <p className="text-xs font-bold text-white">Upgrade vers {pendingRequest.requested_tier} ({pendingRequest.requested_period})</p>
                   </div>
                 ) : (
                   <button 
                     onClick={() => setShowUpgradeModal(true)}
                     className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-yellow-400 hover:text-black transition-all"
                   >
                     Mettre à jour / Upgrade
                   </button>
                 )}
               </div>
            </div>
          </div>

          {/* Main Content: Methods */}
          <div className="lg:col-span-2 space-y-8">
            {/* Payment Methods */}
            <div className="glass-card p-10 rounded-[3rem] border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Modes de Paiement</h3>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">Spécifiez vos canaux de réception de fonds</p>
                  </div>
                </div>
                <button
                  onClick={addPaymentMethod}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {vendor?.payment_methods.map((method, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
                    >
                      <div className="md:col-span-4">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2 block ml-1">Type</label>
                        <div className="relative">
                          <select
                            value={method.type}
                            onChange={e => updatePaymentMethod(idx, 'type', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold appearance-none outline-none focus:border-yellow-400/50 transition-all"
                          >
                            {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                        </div>
                      </div>
                      <div className="md:col-span-7">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2 block ml-1">Détails (Numéro, compte...)</label>
                        <input
                          type="text"
                          value={method.details}
                          onChange={e => updatePaymentMethod(idx, 'details', e.target.value)}
                          placeholder="Ex: +228 90 00 00 00"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold outline-none focus:border-yellow-400/50 transition-all"
                        />
                      </div>
                      <div className="md:col-span-1 pb-1">
                        <button
                          onClick={() => removePaymentMethod(idx)}
                          className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-all group"
                        >
                          <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {vendor?.payment_methods.length === 0 && (
                  <div className="py-12 text-center bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                    <p className="text-gray-600 font-bold text-sm">Aucun mode de paiement ajouté.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Options */}
            <div className="glass-card p-10 rounded-[3rem] border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                    <Truck size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Options de Récupération</h3>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">Logistique et retrait des équipements</p>
                  </div>
                </div>
                <button
                  onClick={addDeliveryOption}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {vendor?.delivery_options.map((option, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
                    >
                      <div className="md:col-span-5">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2 block ml-1">Type de service</label>
                        <div className="relative">
                          <select
                            value={option.type}
                            onChange={e => updateDeliveryOption(idx, 'type', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold appearance-none outline-none focus:border-yellow-400/50 transition-all"
                          >
                            {DELIVERY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                        </div>
                      </div>
                      <div className="md:col-span-6">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2 block ml-1">Détails optionnels</label>
                        <input
                          type="text"
                          value={option.details}
                          onChange={e => updateDeliveryOption(idx, 'details', e.target.value)}
                          placeholder="Ex: Gratuit dès 500k, Lomé Nord..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold outline-none focus:border-yellow-400/50 transition-all"
                        />
                      </div>
                      <div className="md:col-span-1 pb-1">
                        <button
                          onClick={() => removeDeliveryOption(idx)}
                          className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-all group"
                        >
                          <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {vendor?.delivery_options.length === 0 && (
                  <div className="py-12 text-center bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                    <p className="text-gray-600 font-bold text-sm">Aucune option de livraison ajoutée.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowUpgradeModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] shadow-2xl p-10"
            >
              <h2 className="text-3xl font-black text-white mb-2 tracking-tight uppercase">Upgrade Abonnement</h2>
              <p className="text-gray-500 text-sm mb-8">Choisissez la nouvelle catégorie pour booster votre visibilité.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-1">Choisir un Tier</label>
                  <select
                    value={upgradeForm.tier}
                    onChange={e => setUpgradeForm({...upgradeForm, tier: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm font-bold"
                  >
                    <option value="basic" className="bg-[#0A0A0A]">BASIC (Standard)</option>
                    <option value="premium" className="bg-[#0A0A0A]">PREMIUM (Visibilité Maximale)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-1">Choisir une Période</label>
                  <select
                    value={upgradeForm.period}
                    onChange={e => setUpgradeForm({...upgradeForm, period: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm font-bold"
                  >
                    <option value="weekly" className="bg-[#0A0A0A]">Hebdomadaire</option>
                    <option value="monthly" className="bg-[#0A0A0A]">Mensuelle</option>
                    <option value="quarterly" className="bg-[#0A0A0A]">Trimestrielle</option>
                    <option value="semi-annual" className="bg-[#0A0A0A]">Semestrielle</option>
                  </select>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="flex-1 py-4 rounded-2xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleUpgradeSubmit}
                    disabled={saving}
                    className="flex-[2] py-4 rounded-2xl bg-yellow-400 text-gray-900 font-black text-xs uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-400/20"
                  >
                    Soumettre la demande
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

export default VendorProfile;
