// ============================================================
// Krantos Platform — CalculatePower Page (Premium Dark Overhaul)
// Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5, 14.4
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Trash2, Zap, User, Phone, MapPin, ChevronRight, RotateCcw } from 'lucide-react';

import { supabase } from '../lib/supabase';
import type { ApplianceInput, PowerUnit } from '../lib/supabase';
import { calculateTotalPower } from '../utils/powerCalculator';
import { getRecommendation } from '../services/recommendationEngine';
import { APPLIANCE_CATALOG, APPLIANCE_CATEGORIES, findAppliancePreset } from '../constants/applianceCatalog';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface UserFormData {
  firstName: string;
  lastName: string;
  phone: string;
  location: string;
}

interface UserFormErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
  location?: string;
}

interface ApplianceFormData {
  name: string;
  quantity: string;
  power: string;
  unit: PowerUnit;
}

interface ApplianceFormErrors {
  name?: string;
  quantity?: string;
  power?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UNITS: PowerUnit[] = ['W', 'A', 'V'];

const emptyApplianceForm = (): ApplianceFormData => ({
  name: '',
  quantity: '1',
  power: '',
  unit: 'W',
});

// A few common appliances for the dropdown
const COMMON_APPLIANCES = APPLIANCE_CATALOG.map((p) => p.label);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CalculatePower = () => {
  const navigate = useNavigate();

  // ── User form state ──────────────────────────────────────────────────────
  const [userForm, setUserForm] = useState<UserFormData>({
    firstName: '',
    lastName: '',
    phone: '',
    location: '',
  });
  const [userErrors, setUserErrors] = useState<UserFormErrors>({});

  // ── Location suggestions state ───────────────────────────────────────────
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const ALL_LOCATIONS = [
    'Ablogamé, Lomé - Togo',
    'Kégué, Lomé - Togo',
    'Akodésséwa, Lomé - Togo',
    'Dékon, Lomé - Togo',
    'Avédji, Lomé - Togo',
    'Sagbado, Lomé - Togo',
    'Djidjolé, Lomé - Togo',
    'Adakpamé, Lomé - Togo',
    'Aného - Togo',
    'Tsévié - Togo',
    'Kpalimé - Togo',
    'Atakpamé - Togo',
    'Sokodé - Togo',
    'Kara - Togo',
    'Dapaong - Togo',
    'Cotonou - Bénin',
    'Ouidah - Bénin',
    'Porto-Novo - Bénin',
    'Accra - Ghana',
    'Kumasi - Ghana',
    'Abidjan - Côte d’Ivoire',
    'Yamoussoukro - Côte d’Ivoire',
    'Dakar - Sénégal',
    'Bamako - Mali',
    'Ouagadougou - Burkina Faso',
    'Niamey - Niger',
    'Lagos - Nigeria',
    'Abuja - Nigeria',
    'Douala - Cameroun',
    'Yaoundé - Cameroun',
    'Libreville - Gabon',
    'Kinshasa - RDC',
    'Paris - France',
    'Marseille - France',
    'Bruxelles - Belgique',
    'Genève - Suisse',
    'Montréal - Canada',
    'New York - USA',
    'Washington - USA',
    'São Paulo - Brésil',
    'Dubaï - Émirats Arabes Unis',
    'Casablanca - Maroc',
    'Tunis - Tunisie',
    'Alger - Algérie',
    'Le Caire - Égypte',
    'Johannesburg - Afrique du Sud',
    'Nairobi - Kenya',
    'Addis-Abeba - Éthiopie'
  ];

  // ── Appliance list state ─────────────────────────────────────────────────
  const [appliances, setAppliances] = useState<ApplianceInput[]>([]);
  const [applianceForm, setApplianceForm] = useState<ApplianceFormData>(emptyApplianceForm());
  const [applianceErrors, setApplianceErrors] = useState<ApplianceFormErrors>({});
  const [applianceListError, setApplianceListError] = useState<string>('');
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

  // ── Submission state ─────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [step, setStep] = useState<'input' | 'suggestions'>('input');
  const [recommendations, setRecommendations] = useState<{
    product: any;
    vendor: any;
    alternatives: { product: any; vendor: any }[];
  } | null>(null);
  const [calculatedPower, setCalculatedPower] = useState({ watts: 0, kva: 0 });

  // ── User form validation ─────────────────────────────────────────────────
  const validateUserForm = (): boolean => {
    const errors: UserFormErrors = {};
    if (!userForm.firstName.trim()) errors.firstName = 'Requis';
    if (!userForm.lastName.trim()) errors.lastName = 'Requis';
    if (!userForm.phone.trim()) errors.phone = 'Requis';
    if (!userForm.location.trim()) errors.location = 'Requis';
    setUserErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Appliance form validation ────────────────────────────────────────────
  const validateApplianceForm = (): boolean => {
    const errors: ApplianceFormErrors = {};
    if (!applianceForm.name.trim()) errors.name = "Nom requis";
    const qty = parseInt(applianceForm.quantity, 10);
    if (!applianceForm.quantity.trim() || isNaN(qty) || qty < 1) errors.quantity = '!';
    const pwr = parseFloat(applianceForm.power);
    if (!applianceForm.power.trim() || isNaN(pwr) || pwr <= 0) errors.power = '!';
    setApplianceErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Add appliance ────────────────────────────────────────────────────────
  const handleAddAppliance = () => {
    if (!validateApplianceForm()) return;
    const newAppliance: ApplianceInput = {
      name: applianceForm.name.trim(),
      quantity: parseInt(applianceForm.quantity, 10),
      power: parseFloat(applianceForm.power),
      unit: applianceForm.unit,
    };
    setAppliances((prev) => [...prev, newAppliance]);
    setApplianceForm(emptyApplianceForm());
    setApplianceErrors({});
    setApplianceListError('');
  };

  // ── Remove appliance ─────────────────────────────────────────────────────
  const handleRemoveAppliance = (index: number) => {
    setAppliances((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Core submit / record lead ────────────────────────────────────────────
  const recordLead = async (
    totalWatts: number,
    totalKVA: number,
    product: any | null,
    vendor: any | null
  ) => {
    setIsSubmitting(true);
    setSubmitFailed(false);

    try {
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert({
          user_name: `${userForm.firstName.trim()} ${userForm.lastName.trim()}`,
          user_phone: userForm.phone.trim(),
          location: userForm.location.trim(),
          total_power_needed: totalKVA,
          recommended_product_id: product?.id ?? null,
          vendor_id: vendor?.id ?? null,
          status: 'new',
        })
        .select('id')
        .single();

      if (leadError || !leadData) {
        throw new Error(leadError?.message ?? 'Erreur lors de la création du lead.');
      }

      const leadId = leadData.id as string;

      const appliancesPayload = appliances.map((a) => {
        let powerInWatts: number;
        if (a.unit === 'A') {
          powerInWatts = a.power * 220;
        } else {
          powerInWatts = a.power;
        }
        return {
          lead_id: leadId,
          appliance_name: a.name,
          quantity: a.quantity,
          power: a.power,
          unit: a.unit,
          power_in_watts: powerInWatts,
        };
      });

      const { error: appliancesError } = await supabase
        .from('appliances_input')
        .insert(appliancesPayload);

      if (appliancesError) throw new Error(appliancesError.message);

      navigate('/results', {
        state: {
          totalWatts,
          totalKVA,
          product,
          vendor,
          leadId,
          userName: `${userForm.firstName.trim()} ${userForm.lastName.trim()}`,
          userPhone: userForm.phone.trim(),
          location: userForm.location.trim(),
          appliances,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue.';
      console.error('Lead recording failed:', message);
      
      // We still want to show the results even if recording the lead fails!
      // This is crucial for user experience.
      toast.warning("Votre résultat est prêt, mais nous n'avons pas pu enregistrer votre contact. Veuillez contacter le vendeur directement.");
      
      navigate('/results', {
        state: {
          totalWatts,
          totalKVA,
          product,
          vendor,
          leadId: 'offline-' + Date.now(), // Fallback ID
          userName: `${userForm.firstName.trim()} ${userForm.lastName.trim()}`,
          userPhone: userForm.phone.trim(),
          location: userForm.location.trim(),
          appliances,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userValid = validateUserForm();
    if (appliances.length === 0) {
      setApplianceListError('Veuillez ajouter au moins un appareil électrique.');
    } else {
      setApplianceListError('');
    }
    if (!userValid || appliances.length === 0) return;

    setIsSubmitting(true);
    const { totalWatts, totalKVA } = calculateTotalPower(appliances);
    setCalculatedPower({ watts: totalWatts, kva: totalKVA });

    try {
      const result = await getRecommendation(totalKVA);
      setRecommendations(result);
      setStep('suggestions');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error("Erreur lors de la recherche de produits.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectProduct = async (product: any, vendor: any) => {
    await recordLead(calculatedPower.watts, calculatedPower.kva, product, vendor);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-64px)] py-12 px-4 relative">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        <AnimatePresence mode="wait">
          {step === 'input' ? (
            <motion.div
              key="input-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <div className="text-center mb-10">
                <h1 className="text-4xl font-black mb-4 text-white tracking-tight">Calculateur de puissance</h1>
                <p className="text-gray-400 text-sm max-w-md mx-auto">Remplissez vos infos puis ajoutez vos appareils. On s'occupe de vous proposer les meilleures solutions.</p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="w-full space-y-6">
                {/* Section 1 : Informations */}
                <div className="glass-card p-8 rounded-[2rem]">
                  <div className="flex items-center gap-2 mb-8">
                    <span className="text-sm font-bold text-gray-300 uppercase tracking-widest">Vos informations</span>
                  </div>
                  {/* ... (Existing form inputs) ... */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                    <div className={`relative group md:col-span-2 ${showSuggestions ? 'z-[50]' : ''}`}>
                      <label htmlFor="location" className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">Localisation</label>
                      <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all group-focus-within:border-yellow-400/50 ${userErrors.location ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'}`}>
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <input id="location" type="text" value={userForm.location} placeholder="Rechercher votre ville..." autoComplete="off" onChange={(e) => { const val = e.target.value; setUserForm(f => ({ ...f, location: val })); if (userErrors.location) setUserErrors(err => ({ ...err, location: undefined })); if (val.length >= 2) { const matches = ALL_LOCATIONS.filter(l => l.toLowerCase().includes(val.toLowerCase())); setLocationSuggestions(matches); setShowSuggestions(matches.length > 0); } else { setShowSuggestions(false); } }} onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }} className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm" />
                      </div>
                      <AnimatePresence>
                        {showSuggestions && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -10 }} 
                            className="absolute left-0 right-0 top-full mt-2 bg-[#1A1A1E] border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[999] overflow-hidden backdrop-blur-xl max-h-48 overflow-y-auto scrollbar-hide"
                          >
                            {locationSuggestions.map((loc) => (
                              <button key={loc} type="button" onMouseDown={(e) => { e.preventDefault(); setUserForm(f => ({ ...f, location: loc })); setShowSuggestions(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2">
                                <MapPin className="w-3 h-3 text-yellow-400/50 flex-shrink-0" />
                                {loc}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="relative group">
                      <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">Prénom</label>
                      <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all group-focus-within:border-yellow-400/50 ${userErrors.firstName ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'}`}>
                        <User className="w-4 h-4 text-gray-500" />
                        <input type="text" value={userForm.firstName} placeholder="Votre prénom" onChange={(e) => { setUserForm(f => ({ ...f, firstName: e.target.value })); if (userErrors.firstName) setUserErrors(err => ({ ...err, firstName: undefined })); }} className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm font-medium" />
                      </div>
                    </div>
                    <div className="relative group">
                      <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">Nom</label>
                      <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all group-focus-within:border-yellow-400/50 ${userErrors.lastName ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'}`}>
                        <User className="w-4 h-4 text-gray-500" />
                        <input type="text" value={userForm.lastName} placeholder="Votre nom" onChange={(e) => { setUserForm(f => ({ ...f, lastName: e.target.value })); if (userErrors.lastName) setUserErrors(err => ({ ...err, lastName: undefined })); }} className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm font-medium" />
                      </div>
                    </div>
                    <div className="relative group md:col-span-2">
                      <label htmlFor="phone" className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">Téléphone</label>
                      <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all group-focus-within:border-yellow-400/50 ${userErrors.phone ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'}`}>
                        <Phone className="w-4 h-4 text-gray-500" />
                        <input id="phone" type="tel" value={userForm.phone} placeholder="+228..." onChange={(e) => { setUserForm(f => ({ ...f, phone: e.target.value })); if (userErrors.phone) setUserErrors(err => ({ ...err, phone: undefined })); }} className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2 : Appareils */}
                <div className="glass-card p-8 rounded-[2rem]">
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-sm font-bold text-gray-300 uppercase tracking-widest">Vos appareils</span>
                    <button type="button" onClick={handleAddAppliance} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-400 text-gray-900 font-bold text-sm hover:bg-yellow-500 transition-all hover:scale-105">
                      <Plus className="w-4 h-4" />
                      Ajouter
                    </button>
                  </div>
                  <div className="relative mb-8">
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">Sélectionner un appareil</label>
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 relative">
                        <button type="button" onClick={() => setShowDeviceDropdown(!showDeviceDropdown)} className={`w-full bg-white/5 border rounded-2xl px-6 py-4 text-left text-sm transition-all flex items-center justify-between ${applianceErrors.name ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'}`}>
                          <span className={applianceForm.name ? 'text-white font-bold' : 'text-gray-600'}>{applianceForm.name || "Sélectionner un appareil..."}</span>
                          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showDeviceDropdown ? 'rotate-90' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {showDeviceDropdown && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowDeviceDropdown(false)} />
                              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute left-0 right-0 top-full mt-2 bg-[#1A1A1E] border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 max-h-80 overflow-y-auto scrollbar-hide backdrop-blur-xl">
                                {APPLIANCE_CATEGORIES.map((cat) => (
                                  <div key={cat} className="p-2">
                                    <div className="px-4 py-2 text-[10px] font-black text-yellow-400 uppercase tracking-[0.2em] bg-yellow-400/5 rounded-lg mb-1">{cat}</div>
                                    {APPLIANCE_CATALOG.filter((p) => p.category === cat).map((p) => (
                                      <button key={p.id} type="button" onClick={() => { const preset = findAppliancePreset(p.label); setApplianceForm((f) => ({ ...f, name: p.label, unit: preset ? 'W' : f.unit, power: preset ? String(preset.typical_watts) : f.power, })); setShowDeviceDropdown(false); if (applianceErrors.name) setApplianceErrors(err => ({ ...err, name: undefined })); }} className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors rounded-xl font-medium">{p.label}</button>
                                    ))}
                                  </div>
                                ))}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex gap-2 min-w-[300px]">
                        <div className="relative flex-1 group">
                          <input type="number" placeholder="Qté" value={applianceForm.quantity} onChange={(e) => setApplianceForm(f => ({ ...f, quantity: e.target.value }))} className="w-full h-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-yellow-400/50" />
                        </div>
                        <div className="relative flex-[2] group">
                          <div className={`flex items-center bg-white/5 border rounded-2xl transition-all group-focus-within:border-yellow-400/50 ${applianceErrors.power ? 'border-red-500/50' : 'border-white/10'}`}>
                            <button type="button" onClick={() => { const preset = findAppliancePreset(applianceForm.name); const step = 10; const cur = Number(applianceForm.power || 0); const next = preset ? clamp(cur - step, preset.min_watts, preset.max_watts) : Math.max(0, cur - step); setApplianceForm((f) => ({ ...f, power: String(next || '') })); }} className="px-4 py-4 text-gray-500 hover:text-white transition-colors font-black">−</button>
                            <input type="number" placeholder="Puiss." value={applianceForm.power} onChange={(e) => setApplianceForm(f => ({ ...f, power: e.target.value }))} className="w-full bg-transparent border-none outline-none text-white text-center text-sm font-bold placeholder:text-gray-700" />
                            <button type="button" onClick={() => { const preset = findAppliancePreset(applianceForm.name); const step = 10; const cur = Number(applianceForm.power || 0); const next = preset ? clamp(cur + step, preset.min_watts, preset.max_watts) : cur + step; setApplianceForm((f) => ({ ...f, power: String(next || '') })); }} className="px-4 py-4 text-gray-500 hover:text-white transition-colors font-black">+</button>
                          </div>
                        </div>
                        <select value={applianceForm.unit} onChange={(e) => setApplianceForm(f => ({ ...f, unit: e.target.value as PowerUnit }))} className="w-20 bg-white/5 border border-white/10 rounded-2xl px-3 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50 font-bold">
                          {UNITS.map(u => <option key={u} value={u} className="bg-[#0a0a0c]">{u}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  {applianceListError && <p className="text-red-400 text-xs mb-4 font-medium">{applianceListError}</p>}
                  <div className="space-y-3">
                    <AnimatePresence>
                      {appliances.map((a, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center"><Zap className="w-5 h-5 text-yellow-400" /></div>
                            <div><p className="font-bold text-white text-sm">{a.name}</p><p className="text-xs text-gray-500 uppercase tracking-widest">{a.quantity} × {a.power} {a.unit}</p></div>
                          </div>
                          <button type="button" onClick={() => handleRemoveAppliance(i)} className="p-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 className="w-5 h-5" /></button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-3 py-5 rounded-[2rem] bg-yellow-400 text-gray-900 font-black text-xl hover:bg-yellow-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-yellow-400/20 disabled:opacity-50 accent-glow"
                  >
                    {isSubmitting ? <span className="animate-spin h-6 w-6 border-4 border-black/20 border-t-black rounded-full" /> : (
                      <>
                        <Zap className="w-6 h-6 fill-current" />
                        Calculer ma puissance
                        <ChevronRight className="w-6 h-6" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="suggestions-step"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full"
            >
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 mb-4">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Calcul terminé : {calculatedPower.watts.toFixed(0)} W ({(calculatedPower.watts / 1000).toFixed(2)} kW)</span>
                </div>
                <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Choisissez votre solution</h2>
                <p className="text-gray-400 text-sm max-w-md mx-auto">Sélectionnez le vendeur qui vous convient le mieux pour continuer vers les détails.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-12">
                {/* Primary Recommendation */}
                {recommendations?.product && (
                  <motion.div
                    whileHover={{ y: -5 }}
                    className="glass-card p-8 rounded-[2.5rem] border-yellow-400/30 relative overflow-hidden bg-yellow-400/[0.02]"
                  >
                    <div className="absolute top-0 right-0 px-4 py-1 bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">
                      Recommandé
                    </div>
                    <div className="flex flex-col h-full">
                      <div className="mb-8">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 block">{recommendations.vendor.name}</span>
                        <h3 className="text-2xl font-black text-white leading-tight mb-2">{recommendations.product.name}</h3>
                        <p className="text-gray-400 text-xs line-clamp-2">{recommendations.product.description}</p>
                      </div>
                      <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                        <div>
                          <motion.p 
                            animate={{ opacity: [1, 0.7, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-2xl font-black text-yellow-400"
                          >
                            {recommendations.product.price.toLocaleString('fr-FR')} FCFA
                          </motion.p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase">
                            {recommendations.product.power_rating} kVA / {(recommendations.product.power_rating).toFixed(2)} kW
                          </p>
                        </div>
                        <button
                          onClick={() => handleSelectProduct(recommendations.product, recommendations.vendor)}
                          disabled={isSubmitting}
                          className="px-6 py-3 rounded-xl bg-yellow-400 text-black font-black text-xs uppercase tracking-widest hover:bg-yellow-500 transition-all flex items-center gap-2"
                        >
                          {isSubmitting ? <span className="animate-spin h-4 w-4 border-2 border-black/20 border-t-black rounded-full" /> : 'Choisir'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Alternatives */}
                {recommendations?.alternatives.map((alt, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ y: -5 }}
                    className="glass-card p-8 rounded-[2.5rem] border-white/5 relative overflow-hidden"
                  >
                    <div className="flex flex-col h-full">
                      <div className="mb-8">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 block">{alt.vendor.name}</span>
                        <h3 className="text-xl font-bold text-white leading-tight mb-2">{alt.product.name}</h3>
                        <p className="text-gray-400 text-xs line-clamp-2">{alt.product.description}</p>
                      </div>
                      <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                        <div>
                          <motion.p 
                            animate={{ opacity: [1, 0.8, 1] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="text-xl font-bold text-white"
                          >
                            {alt.product.price.toLocaleString('fr-FR')} FCFA
                          </motion.p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase">
                            {alt.product.power_rating} kVA / {(alt.product.power_rating).toFixed(2)} kW
                          </p>
                        </div>
                        <button
                          onClick={() => handleSelectProduct(alt.product, alt.vendor)}
                          disabled={isSubmitting}
                          className="px-6 py-3 rounded-xl bg-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all"
                        >
                          Choisir
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <button
                onClick={() => setStep('input')}
                className="text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Modifier mon calcul
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CalculatePower;
