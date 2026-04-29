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
  fullName: string;
  phone: string;
  location: string;
}

interface UserFormErrors {
  fullName?: string;
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
    fullName: '',
    phone: '',
    location: '',
  });
  const [userErrors, setUserErrors] = useState<UserFormErrors>({});

  // ── Location suggestions state ───────────────────────────────────────────
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const ALL_LOCATIONS = [
    'Lomé, Togo',
    'Agbalépédogan, Lomé',
    'Adidogomé, Lomé',
    'Tokoin, Lomé',
    'Cotonou, Bénin',
    'Abidjan, Côte d\'Ivoire',
    'Accra, Ghana',
    'Ouagadougou, Burkina Faso',
    'Dakar, Sénégal',
    'Niamey, Niger',
  ];

  // ── Appliance list state ─────────────────────────────────────────────────
  const [appliances, setAppliances] = useState<ApplianceInput[]>([]);
  const [applianceForm, setApplianceForm] = useState<ApplianceFormData>(emptyApplianceForm());
  const [applianceErrors, setApplianceErrors] = useState<ApplianceFormErrors>({});
  const [applianceListError, setApplianceListError] = useState<string>('');

  // ── Submission state ─────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [cachedCalcData, setCachedCalcData] = useState<{
    totalWatts: number;
    totalKVA: number;
    product: any | null;
    vendor: any | null;
  } | null>(null);

  // ── User form validation ─────────────────────────────────────────────────
  const validateUserForm = (): boolean => {
    const errors: UserFormErrors = {};
    if (!userForm.fullName.trim()) errors.fullName = 'Requis';
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
          user_name: userForm.fullName.trim(),
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
          userName: userForm.fullName.trim(),
          userPhone: userForm.phone.trim(),
          location: userForm.location.trim(),
          appliances,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue.';
      toast.error(`Impossible d'enregistrer votre demande : ${message}`);
      setSubmitFailed(true);
      setCachedCalcData({ totalWatts, totalKVA, product, vendor });
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

    const { totalWatts, totalKVA } = calculateTotalPower(appliances);

    let product = null;
    let vendor = null;
    try {
      const result = await getRecommendation(totalKVA);
      product = result.product;
      vendor = result.vendor;
    } catch { }

    await recordLead(totalWatts, totalKVA, product, vendor);
  };

  const handleRetry = async () => {
    if (!cachedCalcData) return;
    const { totalWatts, totalKVA, product, vendor } = cachedCalcData;
    await recordLead(totalWatts, totalKVA, product, vendor);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-64px)] py-12 px-4 relative">
      <div className="max-w-3xl mx-auto flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl font-bold mb-2">Calculateur de puissance</h1>
          <p className="text-gray-400 text-sm">Remplissez vos infos puis ajoutez vos appareils. On s'occupe du reste.</p>
        </motion.div>

        <form onSubmit={handleSubmit} noValidate className="w-full space-y-6">
          {/* Section 1 : Informations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-8 rounded-[2rem]"
          >
            <div className="flex items-center gap-2 mb-8">
              <span className="text-sm font-bold text-gray-300 uppercase tracking-widest">Vos informations</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              <div className="relative group md:col-span-2">
                <label htmlFor="fullName" className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">
                  Nom et Prénoms
                </label>
                <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all group-focus-within:border-yellow-400/50 ${userErrors.fullName ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'}`}>
                  <User className="w-4 h-4 text-gray-500" />
                  <input
                    id="fullName"
                    type="text"
                    value={userForm.fullName}
                    placeholder="Votre nom complet"
                    onChange={(e) => {
                      setUserForm(f => ({ ...f, fullName: e.target.value }));
                      if (userErrors.fullName) setUserErrors(err => ({ ...err, fullName: undefined }));
                    }}
                    className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                  />
                </div>
              </div>

              <div className="relative group">
                <label htmlFor="phone" className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">
                  Téléphone
                </label>
                <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all group-focus-within:border-yellow-400/50 ${userErrors.phone ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'}`}>
                  <Phone className="w-4 h-4 text-gray-500" />
                  <input
                    id="phone"
                    type="tel"
                    value={userForm.phone}
                    placeholder="+228..."
                    onChange={(e) => {
                      setUserForm(f => ({ ...f, phone: e.target.value }));
                      if (userErrors.phone) setUserErrors(err => ({ ...err, phone: undefined }));
                    }}
                    className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                  />
                </div>
              </div>

              <div className="relative group">
                <label htmlFor="location" className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">
                  Localisation
                </label>
                <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all group-focus-within:border-yellow-400/50 ${userErrors.location ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'}`}>
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <input
                    id="location"
                    type="text"
                    value={userForm.location}
                    placeholder="Lomé, Togo"
                    autoComplete="off"
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserForm(f => ({ ...f, location: val }));
                      if (userErrors.location) setUserErrors(err => ({ ...err, location: undefined }));
                      
                      if (val.length >= 2) {
                        const matches = ALL_LOCATIONS.filter(l => 
                          l.toLowerCase().includes(val.toLowerCase())
                        );
                        setLocationSuggestions(matches);
                        setShowSuggestions(matches.length > 0);
                      } else {
                        setShowSuggestions(false);
                      }
                    }}
                    onBlur={() => {
                      // Small delay to allow click on suggestion
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                  />
                </div>
                
                <AnimatePresence>
                  {showSuggestions && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      {locationSuggestions.map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => {
                            setUserForm(f => ({ ...f, location: loc }));
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                          <MapPin className="w-3 h-3 text-yellow-400/50" />
                          {loc}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Section 2 : Appareils */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-8 rounded-[2rem]"
          >
            <div className="flex items-center justify-between mb-8">
              <span className="text-sm font-bold text-gray-300 uppercase tracking-widest">Vos appareils</span>
              <button
                type="button"
                onClick={handleAddAppliance}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-400 text-gray-900 font-bold text-sm hover:bg-yellow-500 transition-all hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>

            {/* Formulaire d'ajout rapide (ligne format) */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <select
                value={COMMON_APPLIANCES.includes(applianceForm.name) ? applianceForm.name : ''}
                onChange={(e) => {
                  const label = e.target.value;
                  const preset = findAppliancePreset(label);
                  setApplianceForm((f) => ({
                    ...f,
                    name: label,
                    unit: preset ? 'W' : f.unit,
                    power: preset ? String(preset.typical_watts) : f.power,
                  }));
                  if (applianceErrors.name) setApplianceErrors(err => ({ ...err, name: undefined }));
                }}
                className={`flex-1 bg-white/5 border rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50 ${applianceErrors.name ? 'border-red-500/50' : 'border-white/10'}`}
              >
                <option value="" className="bg-[#0a0a0c]">Sélectionner un appareil...</option>
                {APPLIANCE_CATEGORIES.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {APPLIANCE_CATALOG.filter((p) => p.category === cat).map((p) => (
                      <option key={p.id} value={p.label} className="bg-[#0a0a0c]">
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {!COMMON_APPLIANCES.includes(applianceForm.name) && applianceForm.name !== '' && (
                <input
                  type="text"
                  placeholder="Nom de l'appareil"
                  value={applianceForm.name}
                  onChange={(e) => setApplianceForm(f => ({ ...f, name: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                />
              )}

              <div className="flex gap-2 min-w-[300px]">
                <input
                  type="number"
                  placeholder="Qté"
                  value={applianceForm.quantity}
                  onChange={(e) => setApplianceForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-20 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                />
                <input
                  type="number"
                  placeholder="Puiss."
                  value={applianceForm.power}
                  onChange={(e) => setApplianceForm(f => ({ ...f, power: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const preset = findAppliancePreset(applianceForm.name);
                      const step = 10;
                      const cur = Number(applianceForm.power || 0);
                      const next = preset ? clamp(cur + step, preset.min_watts, preset.max_watts) : cur + step;
                      setApplianceForm((f) => ({ ...f, power: String(next || '') }));
                    }}
                    className="h-[26px] w-[44px] rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all text-sm font-black"
                    title="Augmenter"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const preset = findAppliancePreset(applianceForm.name);
                      const step = 10;
                      const cur = Number(applianceForm.power || 0);
                      const next = preset ? clamp(cur - step, preset.min_watts, preset.max_watts) : Math.max(0, cur - step);
                      setApplianceForm((f) => ({ ...f, power: String(next || '') }));
                    }}
                    className="h-[26px] w-[44px] rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all text-sm font-black"
                    title="Diminuer"
                  >
                    −
                  </button>
                </div>
                <select
                  value={applianceForm.unit}
                  onChange={(e) => setApplianceForm(f => ({ ...f, unit: e.target.value as PowerUnit }))}
                  className="w-20 bg-white/5 border border-white/10 rounded-2xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                >
                  {UNITS.map(u => <option key={u} value={u} className="bg-[#0a0a0c]">{u}</option>)}
                </select>
              </div>
            </div>

            {(() => {
              const preset = findAppliancePreset(applianceForm.name);
              if (!preset) return null;
              return (
                <div className="mb-6 text-xs text-gray-400">
                  Puissance moyenne suggérée : <span className="text-yellow-300 font-bold">{preset.typical_watts} W</span>{' '}
                  <span className="text-gray-600">(plage {preset.min_watts}–{preset.max_watts} W)</span>
                </div>
              );
            })()}

            {/* Liste des appareils ajoutés */}
            {applianceListError && <p className="text-red-400 text-xs mb-4 font-medium">{applianceListError}</p>}
            
            <div className="space-y-3">
              <AnimatePresence>
                {appliances.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-6 py-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{a.name}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">{a.quantity} × {a.power} {a.unit}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAppliance(i)}
                      className="p-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Bouton Final */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="pt-4"
          >
            {submitFailed && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isSubmitting}
                className="w-full mb-4 py-4 rounded-[2rem] border-2 border-yellow-400/50 text-yellow-400 font-bold flex items-center justify-center gap-2 hover:bg-yellow-400/10 transition-all"
              >
                <RotateCcw className="w-5 h-5" />
                Réessayer la connexion
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-[2rem] bg-yellow-400 text-gray-900 font-black text-xl hover:bg-yellow-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-yellow-400/20 disabled:opacity-50 accent-glow"
            >
              {isSubmitting ? (
                 <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              ) : (
                <>
                  <Zap className="w-6 h-6 fill-current" />
                  Calculer ma puissance
                  <ChevronRight className="w-6 h-6" />
                </>
              )}
            </button>
          </motion.div>
        </form>
      </div>
    </div>
  );
};

export default CalculatePower;
