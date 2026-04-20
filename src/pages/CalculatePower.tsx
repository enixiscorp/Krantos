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
const COMMON_APPLIANCES = [
  'Réfrigérateur',
  'Climatiseur 1 CV',
  'Climatiseur 1.5 CV',
  'Téléviseur LED',
  'Ventilateur',
  'Ampoule LED',
  'Ordinateur portable',
  'Fer à repasser',
  'Micro-ondes',
  'Pompe à eau',
];

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
      const userName = `${userForm.firstName.trim()} ${userForm.lastName.trim()}`;

      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert({
          user_name: userName,
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
          userName,
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
              {[
                { label: 'Prénom', id: 'firstName', value: userForm.firstName, placeholder: 'Prénom', type: 'text', icon: <User className="w-4 h-4 text-gray-500" /> },
                { label: 'Nom', id: 'lastName', value: userForm.lastName, placeholder: 'Nom', type: 'text', icon: <User className="w-4 h-4 text-gray-500" /> },
                { label: 'Téléphone', id: 'phone', value: userForm.phone, placeholder: '+228...', type: 'tel', icon: <Phone className="w-4 h-4 text-gray-500" /> },
                { label: 'Localisation', id: 'location', value: userForm.location, placeholder: 'Lomé, Togo', type: 'text', icon: <MapPin className="w-4 h-4 text-gray-500" /> },
              ].map((field) => (
                <div key={field.id} className="relative group">
                  <label htmlFor={field.id} className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">
                    {field.label}
                  </label>
                  <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all group-focus-within:border-yellow-400/50 ${userErrors[field.id as keyof UserFormErrors] ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'}`}>
                    {field.icon}
                    <input
                      id={field.id}
                      type={field.type}
                      value={field.value}
                      placeholder={field.placeholder}
                      onChange={(e) => {
                        setUserForm(f => ({ ...f, [field.id]: e.target.value }));
                        if (userErrors[field.id as keyof UserFormErrors]) setUserErrors(err => ({ ...err, [field.id]: undefined }));
                      }}
                      className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                    />
                  </div>
                </div>
              ))}
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
                  setApplianceForm(f => ({ ...f, name: e.target.value }));
                  if (applianceErrors.name) setApplianceErrors(err => ({ ...err, name: undefined }));
                }}
                className={`flex-1 bg-white/5 border rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50 ${applianceErrors.name ? 'border-red-500/50' : 'border-white/10'}`}
              >
                <option value="" className="bg-[#0a0a0c]">Sélectionner un appareil...</option>
                {COMMON_APPLIANCES.map(a => <option key={a} value={a} className="bg-[#0a0a0c]">{a}</option>)}
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
                <select
                  value={applianceForm.unit}
                  onChange={(e) => setApplianceForm(f => ({ ...f, unit: e.target.value as PowerUnit }))}
                  className="w-20 bg-white/5 border border-white/10 rounded-2xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                >
                  {UNITS.map(u => <option key={u} value={u} className="bg-[#0a0a0c]">{u}</option>)}
                </select>
              </div>
            </div>

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
