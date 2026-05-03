import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Sparkles, 
  Save, 
  Loader2, 
  MessageSquare, 
  Plus,
  Trash2,
  Bot,
  User,
  Settings2,
  Zap,
  Search,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatbotConfig {
  id?: string;
  vendor_id: string;
  welcome_message: string;
  suggestions: { question: string; answer: string }[];
  ai_enabled: boolean;
  ai_context: string;
  address?: string;
  delivery_info?: string;
  consumption_info?: string;
  usage_info?: string;
}

const AdminChatbot = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [config, setConfig] = useState<ChatbotConfig | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeConfigs, setActiveConfigs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    if (selectedVendorId) {
      fetchConfig(selectedVendorId);
    } else {
      setConfig(null);
    }
  }, [selectedVendorId]);

  const fetchVendors = async () => {
    const { data: vData, error: vError } = await supabase
      .from('vendors')
      .select('id, name')
      .order('name');
    
    if (!vError && vData) setVendors(vData);

    // Fetch active chatbot configs to show status
    const { data: cData } = await supabase
      .from('chatbot_configs')
      .select('vendor_id');
    
    if (cData) {
      const statusMap: Record<string, boolean> = {};
      cData.forEach(c => statusMap[c.vendor_id] = true);
      setActiveConfigs(statusMap);
    }
    
    setLoading(false);
  };

  const fetchConfig = async (vendorId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chatbot_configs')
      .select('*')
      .eq('vendor_id', vendorId)
      .single();

    if (error && error.code !== 'PGRST116') {
      toast.error('Erreur lors du chargement de la configuration.');
    } else if (data) {
      setConfig(data);
    } else {
      // Default config
      setConfig({
        vendor_id: vendorId,
        welcome_message: "Bonjour ! Je suis l'assistant de {vendor_name}. Comment puis-je vous aider ?",
        suggestions: [],
        ai_enabled: false,
        ai_context: "",
        address: "",
        delivery_info: "",
        consumption_info: "",
        usage_info: ""
      });
    }
    setLoading(false);
  };

  const handleAddSuggestion = () => {
    if (!config) return;
    setConfig({
      ...config,
      suggestions: [{ question: '', answer: '' }, ...config.suggestions]
    });
    toast.success('Nouvelle question ajoutée en haut de la liste');
  };

  const handleUpdateSuggestion = (index: number, field: 'question' | 'answer', value: string) => {
    if (!config) return;
    const newSuggestions = [...config.suggestions];
    newSuggestions[index][field] = value;
    setConfig({ ...config, suggestions: newSuggestions });
  };

  const handleRemoveSuggestion = (index: number) => {
    if (!config) return;
    const newSuggestions = config.suggestions.filter((_, i) => i !== index);
    setConfig({ ...config, suggestions: newSuggestions });
  };

  const saveConfig = async () => {
    if (!config || !selectedVendorId) return;
    setSaving(true);
    try {
      const payload = {
        vendor_id: selectedVendorId,
        welcome_message: config.welcome_message,
        suggestions: config.suggestions,
        ai_enabled: config.ai_enabled,
        ai_context: config.ai_context,
        address: config.address,
        delivery_info: config.delivery_info,
        consumption_info: config.consumption_info,
        usage_info: config.usage_info,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('chatbot_configs')
        .upsert(payload, { onConflict: 'vendor_id' });

      if (error) throw error;
      setShowSuccessModal(true);
      toast.success('Configuration enregistrée !');
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  if (loading && vendors.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors group font-bold text-xs uppercase tracking-widest">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Dashboard
            </Link>
            {selectedVendorId && (
              <button 
                onClick={() => setSelectedVendorId('')}
                className="inline-flex items-center gap-2 text-yellow-500 hover:text-yellow-400 transition-colors font-bold text-xs uppercase tracking-widest"
              >
                <ArrowLeft className="w-4 h-4" />
                Changer de vendeur
              </button>
            )}
          </div>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter flex items-center gap-4">
            Intelligence <span className="text-yellow-400">Conversationnelle</span>
          </h1>
          <p className="text-gray-500 text-lg font-medium">Configurez l'assistant virtuel IA pour chaque partenaire.</p>
        </div>
      </div>

      {/* Searchable Vendor Selector */}
      <div className="glass-card p-8 rounded-[2.5rem] border-white/5 mb-8 bg-gradient-to-r from-yellow-400/5 to-transparent relative z-[60]">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 flex items-center justify-center">
            <User className="w-8 h-8 text-yellow-400" />
          </div>
          <div className="flex-1 space-y-2 relative">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block ml-1">Sélectionner un Vendeur</label>
            <div className="relative">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={selectedVendorId ? (vendors.find(v => v.id === selectedVendorId)?.name || '') : vendorSearch}
                placeholder="Saisir ou choisir un partenaire..."
                onClick={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setVendorSearch(e.target.value);
                  setIsDropdownOpen(true);
                  if (selectedVendorId) setSelectedVendorId('');
                }}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white text-lg font-bold focus:border-yellow-400/50 outline-none transition-all"
              />
              
              <AnimatePresence>
                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl z-20 max-h-60 overflow-y-auto scrollbar-hide"
                    >
                      {filteredVendors.length > 0 ? (
                        filteredVendors.map(v => (
                          <button
                            key={v.id}
                            onClick={() => {
                              setSelectedVendorId(v.id);
                              setVendorSearch('');
                              setIsDropdownOpen(false);
                            }}
                            className="w-full text-left px-6 py-4 text-white hover:bg-yellow-400/10 transition-colors font-bold flex items-center justify-between border-b border-white/5"
                          >
                            {v.name}
                            <ChevronRight size={16} className="text-gray-600" />
                          </button>
                        ))
                      ) : (
                        <div className="p-6 text-center text-gray-500 text-sm font-bold uppercase tracking-widest">
                          Aucun vendeur trouvé
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!selectedVendorId ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass-card rounded-[3rem] border-white/5 overflow-hidden"
          >
            <div className="p-10 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight uppercase tracking-widest">Liste des Partenaires & IA</h3>
                <p className="text-sm text-gray-500 font-medium">Visualisez l'état de configuration du chatbot pour chaque boutique.</p>
              </div>
              <Bot className="w-10 h-10 text-gray-800" />
            </div>

            <div className="max-h-[500px] overflow-y-auto scrollbar-hide">
              {vendors.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {vendors.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVendorId(v.id)}
                      className="w-full flex items-center justify-between p-8 hover:bg-white/[0.03] transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${activeConfigs[v.id] ? 'bg-yellow-400 text-black' : 'bg-white/5 text-gray-600'}`}>
                          {v.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <h4 className="font-bold text-white group-hover:text-yellow-400 transition-colors">{v.name}</h4>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">ID: {v.id.substring(0, 8)}...</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {activeConfigs[v.id] ? (
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Chatbot Actif</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Non configuré</span>
                          </div>
                        )}
                        <ChevronRight size={20} className="text-gray-700 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-20 text-center">
                  <p className="text-gray-500 font-black uppercase tracking-widest text-sm italic">Aucun vendeur trouvé sur la plateforme.</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : config ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="space-y-8"
          >
            {/* AI Toggle */}
            <div className="glass-card p-8 rounded-[2.5rem] border-white/5 flex items-center justify-between bg-gradient-to-br from-purple-500/[0.03] to-transparent">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl transition-all ${config.ai_enabled ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-gray-600'}`}>
                  <Zap className={config.ai_enabled ? 'animate-pulse' : ''} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Réponses Génératives par IA</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Activer la compréhension automatique des besoins</p>
                </div>
              </div>
              <button
                onClick={() => setConfig({ ...config, ai_enabled: !config.ai_enabled })}
                className={`w-16 h-8 rounded-full transition-all relative ${config.ai_enabled ? 'bg-purple-500 shadow-lg shadow-purple-500/20' : 'bg-gray-800'}`}
              >
                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${config.ai_enabled ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            {/* Welcome & Context */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="glass-card p-8 rounded-[2.5rem] border-white/5 space-y-6">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <MessageSquare size={14} className="text-yellow-400" />
                  Message d'accueil
                </h4>
                <textarea
                  value={config.welcome_message}
                  onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm focus:border-yellow-400/50 outline-none transition-all resize-none font-medium"
                  placeholder="Ex: Bonjour ! Je suis l'assistant de {vendor_name}..."
                />
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Variable disponible: {'{vendor_name}'}</p>
              </div>

              <div className="glass-card p-8 rounded-[2.5rem] border-white/5 space-y-6">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Bot size={14} className="text-purple-400" />
                  Contexte IA (Personnalité)
                </h4>
                <textarea
                  value={config.ai_context}
                  onChange={(e) => setConfig({ ...config, ai_context: e.target.value })}
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm focus:border-purple-400/50 outline-none transition-all resize-none font-medium"
                  placeholder="Décrivez comment l'IA doit se comporter (ex: Expert solaire, ton amical...)"
                />
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest italic">Visible uniquement par le modèle génératif.</p>
              </div>
            </div>

            {/* Keyword Knowledge Base */}
            <div className="glass-card p-10 rounded-[3rem] border-white/5 bg-gradient-to-br from-yellow-400/[0.02] to-transparent">
               <h3 className="text-2xl font-black text-white tracking-tight mb-8">Base de Connaissance par <span className="text-yellow-400">Mots-Clés</span></h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       <Search size={14} className="text-yellow-400" />
                       Adresse de la Boutique (Mot-clé: Boutique/Adresse)
                    </label>
                    <textarea
                      value={config.address || ''}
                      onChange={(e) => setConfig({ ...config, address: e.target.value })}
                      className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm focus:border-yellow-400/50 outline-none transition-all resize-none"
                      placeholder="Ex: Rue 12, Quartier Plateau, Abidjan. Ouvert de 8h à 18h."
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       <Zap size={14} className="text-yellow-400" />
                       Infos Livraison (Mot-clé: Livraison/Boutique)
                    </label>
                    <textarea
                      value={config.delivery_info || ''}
                      onChange={(e) => setConfig({ ...config, delivery_info: e.target.value })}
                      className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm focus:border-yellow-400/50 outline-none transition-all resize-none"
                      placeholder="Ex: Livraison gratuite à domicile sous 24h à Abidjan."
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       <TrendingUp size={14} className="text-yellow-400" />
                       Détails Consommation (Mot-clé: Consommation)
                    </label>
                    <textarea
                      value={config.consumption_info || ''}
                      onChange={(e) => setConfig({ ...config, consumption_info: e.target.value })}
                      className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm focus:border-yellow-400/50 outline-none transition-all resize-none"
                      placeholder="Ex: Ce kit est optimisé pour une décharge lente et une recharge solaire rapide."
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       <Settings2 size={14} className="text-yellow-400" />
                       Guide d'Usage/Appareils (Mot-clé: Usage)
                    </label>
                    <textarea
                      value={config.usage_info || ''}
                      onChange={(e) => setConfig({ ...config, usage_info: e.target.value })}
                      className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm focus:border-yellow-400/50 outline-none transition-all resize-none"
                      placeholder="Ex: Peut supporter un frigo, TV, et 10 ampoules simultanément."
                    />
                  </div>
               </div>
            </div>

            {/* FAQ Suggestions */}
            <div className="glass-card p-10 rounded-[3rem] border-white/5">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Suggestions de Questions (FAQ)</h3>
                  <p className="text-sm text-gray-500 font-medium">Questions rapides affichées au client lors de l'ouverture du chat.</p>
                </div>
                <button
                  onClick={handleAddSuggestion}
                  className="p-3 rounded-2xl bg-yellow-400 text-gray-900 hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-400/20"
                >
                  <Plus />
                </button>
              </div>

              <div className="space-y-4">
                {config.suggestions.map((s, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 flex flex-col md:flex-row gap-4 items-start"
                  >
                    <div className="flex-1 space-y-4 w-full">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Question suggérée</label>
                        <input
                          type="text"
                          value={s.question}
                          onChange={(e) => handleUpdateSuggestion(idx, 'question', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white text-sm focus:border-yellow-400/50 outline-none transition-all"
                          placeholder="Ex: Quels sont vos délais de livraison ?"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Réponse automatique</label>
                        <textarea
                          value={s.answer}
                          onChange={(e) => handleUpdateSuggestion(idx, 'answer', e.target.value)}
                          className="w-full h-20 bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white text-xs focus:border-yellow-400/50 outline-none transition-all resize-none"
                          placeholder="La réponse qui sera affichée instantanément..."
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveSuggestion(idx)}
                      className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </motion.div>
                ))}

                {config.suggestions.length === 0 && (
                  <div className="py-12 text-center text-gray-600 italic text-sm">
                    Aucune suggestion configurée. Le chat utilisera uniquement l'IA ou le message d'accueil.
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-50">
              <div className="glass-card p-4 rounded-[2.5rem] border-white/10 shadow-2xl bg-zinc-900/90 backdrop-blur-xl flex gap-3">
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="flex-1 h-16 rounded-[2rem] bg-yellow-400 text-gray-900 font-black text-sm uppercase tracking-widest hover:bg-yellow-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-yellow-400/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  Enregistrer la configuration
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSuccessModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0A0A0A] border border-yellow-400/30 rounded-[3rem] p-12 text-center shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-yellow-400" />
              <div className="w-20 h-20 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <Zap size={40} className="text-yellow-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">Configuration Enregistrée</h2>
              <p className="text-gray-400 font-medium mb-10 leading-relaxed">
                Le chatbot de <span className="text-white font-bold">{vendors.find(v => v.id === selectedVendorId)?.name}</span> est maintenant à jour et prêt à répondre à vos clients.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-5 rounded-2xl bg-white/5 text-white font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10"
                >
                  Continuer l'édition
                </button>
                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    setSelectedVendorId('');
                  }}
                  className="w-full py-5 rounded-2xl bg-yellow-400 text-black font-black uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-400/20"
                >
                  Changer de vendeur
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminChatbot;
