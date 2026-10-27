// ============================================================
// Krantos Platform - CalculatePower Page (Offline-First)
// Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5, 14.4
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Trash2, Zap, User, Phone, MapPin, ChevronRight, RotateCcw, WifiOff, Database, AlertCircle } from 'lucide-react';

import { supabase } from '../lib/supabase';
import type { ApplianceInput, PowerUnit } from '../lib/supabase';
import { calculateTotalPower } from '../utils/powerCalculator';
import { getRecommendation, getRecommendationFromCache } from '../services/recommendationEngine';
import { APPLIANCE_CATALOG, APPLIANCE_CATEGORIES, findAppliancePreset } from '../constants/applianceCatalog';
import { enqueueAction } from '../lib/offlineQueue';
import { v4 as uuidv4 } from '../lib/uuid';
import { normalizeWhatsAppPhone } from '../services/whatsappService';

/** Togo local number (8 digits) or international number (8–15 digits). */
function isValidPhone(raw: string): boolean {
  if (/[^\d\s+().-]/.test(raw)) return false;
  const digits = normalizeWhatsAppPhone(raw);
  return digits.length >= 10 && digits.length <= 15;
}

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

  // ── Location suggestions state (Nominatim / OpenStreetMap) ─────────────
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Fetches address suggestions from Nominatim (OpenStreetMap).
   * No API key required. Rate-limit: 1 req/s handled by 400ms debounce.
   *
   * To swap for another provider (Google Places, Mapbox…),
   * replace only this function - the state & UI below stay identical.
   */
  const fetchLocationSuggestions = useCallback(async (query: string) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLocationLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '6',
        addressdetails: '1',
        'accept-language': 'fr',
      });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          signal: abortRef.current.signal,
          headers: {
            // Required by Nominatim usage policy: identify your app
            'User-Agent': 'Krantos/1.0 (contact@krantos.com)',
          },
        }
      );
      if (!res.ok) throw new Error('Nominatim error');
      const data: Array<{ display_name: string }> = await res.json();
      const labels = data.map((item) => item.display_name);
      setLocationSuggestions(labels);
      setShowSuggestions(labels.length > 0);
    } catch (err: unknown) {
      // AbortError means the user kept typing - not a real error
      if (err instanceof Error && err.name !== 'AbortError') {
        setLocationSuggestions([]);
        setShowSuggestions(false);
      }
    } finally {
      setLocationLoading(false);
    }
  }, []);

  /** Debounced handler - waits 400 ms after the last keystroke */
  const handleLocationChange = useCallback((val: string) => {
    setUserForm((f) => ({ ...f, location: val }));
    setUserErrors((err) => ({ ...err, location: undefined }));

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.length < 3) {
      setShowSuggestions(false);
      setLocationSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchLocationSuggestions(val);
    }, 400);
  }, [fetchLocationSuggestions]);

  // Cleanup timers & in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);
  // ── Appliance list state ─────────────────────────────────────────────────
  const [appliances, setAppliances] = useState<ApplianceInput[]>([]);
  const [applianceForm, setApplianceForm] = useState<ApplianceFormData>(emptyApplianceForm());
  const [applianceErrors, setApplianceErrors] = useState<ApplianceFormErrors>({});
  const [applianceListError, setApplianceListError] = useState<string>('');
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

  // ── Submission state ─────────────────────────────────────────────────────
  const [isLoadingReco, setIsLoadingReco] = useState(false);
  const recoRequestRef = useRef(0);
  const [step, setStep] = useState<'input' | 'suggestions'>('input');
  const [recommendations, setRecommendations] = useState<{
    product: any;
    vendor: any;
    alternatives: { product: any; vendor: any }[];
    fromCache?: boolean;
  } | null>(null);
  const [calculatedPower, setCalculatedPower] = useState({ watts: 0, kva: 0 });
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Warm up cache when online
      getRecommendation(1).catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial warm up if online
    if (navigator.onLine) {
      getRecommendation(1).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── User form validation ─────────────────────────────────────────────────
  const validateUserForm = (): boolean => {
    const errors: UserFormErrors = {};
    if (!userForm.firstName.trim()) errors.firstName = 'Requis';
    if (!userForm.lastName.trim()) errors.lastName = 'Requis';
    if (!userForm.phone.trim()) errors.phone = 'Requis';
    else if (!isValidPhone(userForm.phone)) {
      errors.phone = 'Numéro invalide : 8 chiffres (ex. 90 12 34 56) ou format international (+228…).';
    }
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
  // Navigates to the results page instantly; the lead is saved in the background.
  const recordLead = (
    totalWatts: number,
    totalKVA: number,
    product: any | null,
    vendor: any | null
  ) => {
    const userName = `${userForm.firstName.trim()} ${userForm.lastName.trim()}`;
    const leadPayload = {
      user_name: userName,
      user_phone: userForm.phone.trim(),
      location: userForm.location.trim(),
      total_power_needed: totalKVA,
      recommended_product_id: product?.id ?? null,
      vendor_id: vendor?.id ?? null,
      status: 'new' as const,
    };
    const appliancesPayload = appliances.map((a) => ({
      appliance_name: a.name,
      quantity: a.quantity,
      power: a.power,
      unit: a.unit,
      power_in_watts: a.unit === 'A' ? a.power * 220 : a.power,
    }));

    const online = isOnline && navigator.onLine;
    const leadId = uuidv4();

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

    const queueLead = (lead: object) =>
      enqueueAction({
        type: 'INSERT',
        table: 'leads_with_appliances',
        label: `Calcul de ${userName}`,
        payload: { lead, appliances: appliancesPayload },
      }).catch((err) => console.error('Offline queue failed:', err));

    if (!online) {
      toast.info("📵 Mode Hors-ligne : Votre demande sera envoyée dès votre retour en ligne.");
      queueLead({ id: leadId, ...leadPayload });
      return;
    }

    (async () => {
      const { error: leadError } = await supabase.from('leads').insert({ id: leadId, ...leadPayload });
      if (leadError) {
        console.error('Lead recording failed, queued for retry:', leadError.message);
        queueLead({ id: leadId, ...leadPayload });
        return;
      }
      const rows = appliancesPayload.map((a) => ({ ...a, lead_id: leadId }));
      const { error: appliancesError } = await supabase.from('appliances_input').insert(rows);
      if (appliancesError) {
        console.error('Appliances recording failed:', appliancesError.message);
      }
    })();
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
    setCalculatedPower({ watts: totalWatts, kva: totalKVA });

    // Show the result instantly; products load in the background.
    setRecommendations(null);
    setIsLoadingReco(true);
    setStep('suggestions');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Ignore answers from an older calculation (user went back and recalculated)
    const requestId = ++recoRequestRef.current;
    let onlineDone = false;

    // 1. Local cache first (filled when the page loads) → near-instant products
    getRecommendationFromCache(totalKVA)
      .then((cached) => {
        if (onlineDone || requestId !== recoRequestRef.current || !cached.product) return;
        setRecommendations(cached);
        setIsLoadingReco(false);
      })
      .catch(() => {});

    // 2. Fresh results from Supabase replace the cached ones
    try {
      const result = await getRecommendation(totalKVA);
      onlineDone = true;
      if (requestId !== recoRequestRef.current) return;
      setRecommendations(result);
      if (result.fromCache) {
        toast.info('📦 Résultats affichés depuis le cache local (mode hors-ligne).');
      }
    } catch (err) {
      onlineDone = true;
      if (requestId !== recoRequestRef.current) return;
      toast.error("Erreur lors de la recherche de produits.");
      setRecommendations((prev) => prev ?? { product: null, vendor: null, alternatives: [] });
    } finally {
      if (requestId === recoRequestRef.current) setIsLoadingReco(false);
    }
  };

  const handleSelectProduct = (product: any, vendor: any) => {
    recordLead(calculatedPower.watts, calculatedPower.kva, product, vendor);
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
                    <div className="relative group">
                      <label htmlFor="phone" className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">Téléphone</label>
                      <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all group-focus-within:border-yellow-400/50 ${userErrors.phone ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'}`}>
                        <Phone className="w-4 h-4 text-gray-500" />
                        <input id="phone" type="tel" value={userForm.phone} placeholder="+228..." onChange={(e) => { setUserForm(f => ({ ...f, phone: e.target.value })); if (userErrors.phone) setUserErrors(err => ({ ...err, phone: undefined })); }} className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm" />
                      </div>
                      {userErrors.phone && userErrors.phone !== 'Requis' && (
                        <p className="text-red-400 text-xs mt-1 ml-1 font-medium">{userErrors.phone}</p>
                      )}
                    </div>
                    <div className={`relative group ${showSuggestions ? 'z-[100]' : ''}`}>
                      <label htmlFor="location" className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider ml-1">Localisation</label>
                      <div className={`flex items-center gap-3 bg-white/5 border rounded-2xl px-4 py-3 transition-all group-focus-within:border-yellow-400/50 ${userErrors.location ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'}`}>
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <input id="location" type="text" value={userForm.location} placeholder="Lomé, Togo" autoComplete="off" onChange={(e) => handleLocationChange(e.target.value)} onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }} className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm" />
                      </div>
                      <AnimatePresence>
                        {showSuggestions && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: 10 }} 
                            className="absolute left-0 right-0 bottom-full mb-2 bg-[#1A1A1E] border border-white/20 rounded-2xl shadow-[0_-20px_50px_rgba(0,0,0,0.8)] z-[999] overflow-hidden backdrop-blur-xl max-h-48 overflow-y-auto scrollbar-hide"
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
                    className="w-full flex items-center justify-center gap-3 py-5 rounded-[2rem] bg-yellow-400 text-gray-900 font-black text-xl hover:bg-yellow-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-yellow-400/20 disabled:opacity-50 accent-glow"
                  >
                    <Zap className="w-6 h-6 fill-current" />
                    Calculer ma puissance
                    <ChevronRight className="w-6 h-6" />
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
                {recommendations?.fromCache && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4 ml-2">
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Depuis cache local</span>
                  </div>
                )}
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
                          className="px-6 py-3 rounded-xl bg-yellow-400 text-black font-black text-xs uppercase tracking-widest hover:bg-yellow-500 transition-all flex items-center gap-2"
                        >
                          Choisir
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
                          className="px-6 py-3 rounded-xl bg-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all"
                        >
                          Choisir
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Fallback if no products found (common when offline with empty cache) */}
                {isLoadingReco && (
                  <div className="col-span-full glass-card p-12 rounded-[2.5rem] border-white/5 text-center flex flex-col items-center gap-4">
                    <span className="animate-spin h-8 w-8 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full" />
                    <p className="text-gray-400 text-sm">Recherche des générateurs adaptés à {calculatedPower.kva.toFixed(2)} kVA…</p>
                  </div>
                )}
                {!isLoadingReco && !recommendations?.product && (recommendations?.alternatives?.length ?? 0) === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="col-span-full glass-card p-12 rounded-[2.5rem] border-white/5 text-center flex flex-col items-center gap-6"
                  >
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                      <AlertCircle className="w-10 h-10 text-gray-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Aucun produit trouvé en cache</h3>
                      <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
                        Nous ne trouvons pas de recommandation immédiate pour votre puissance hors-ligne. 
                        Pas d'inquiétude : continuez pour enregistrer votre demande, nous vous contacterons dès notre retour en ligne.
                      </p>
                    </div>
                    <button
                      onClick={() => handleSelectProduct(null, null)}
                      className="px-10 py-4 rounded-2xl bg-yellow-400 text-black font-black text-sm uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-xl shadow-yellow-400/20"
                    >
                      Continuer sans sélection
                    </button>
                  </motion.div>
                )}
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
