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
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatbotConfig {
  id?: string;
  vendor_id: string;
  welcome_message: string;
  suggestions: { question: string; answer: string }[];
  ai_enabled: boolean;
  ai_context: string;
}

const AdminChatbot = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [config, setConfig] = useState<ChatbotConfig | null>(null);

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
    const { data, error } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    
    if (!error && data) setVendors(data);
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
        ai_context: ""
      });
    }
    setLoading(false);
  };

  const handleAddSuggestion = () => {
    if (!config) return;
    setConfig({
      ...config,
      suggestions: [...config.suggestions, { question: '', answer: '' }]
    });
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
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('chatbot_configs')
        .upsert(payload, { onConflict: 'vendor_id' });

      if (error) throw error;
      toast.success('Configuration enregistrée !');
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

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
          <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group font-bold text-xs uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tighter flex items-center gap-4">
            Intelligence <span className="text-yellow-400">Conversationnelle</span>
          </h1>
          <p className="text-gray-500 text-lg font-medium">Configurez l'assistant virtuel IA pour chaque partenaire.</p>
        </div>
      </div>

      {/* Vendor Selector */}
      <div className="glass-card p-8 rounded-[2.5rem] border-white/5 mb-8 bg-gradient-to-r from-yellow-400/5 to-transparent">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 flex items-center justify-center">
            <User className="w-8 h-8 text-yellow-400" />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block ml-1">Sélectionner un Vendeur</label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-lg font-bold focus:border-yellow-400/50 outline-none transition-all cursor-pointer appearance-none"
            >
              <option value="" className="bg-[#0f0f13]">Choisir un partenaire...</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id} className="bg-[#0f0f13]">{v.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!selectedVendorId ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-20 text-center glass-card rounded-[3rem] border-white/5 border-dashed"
          >
            <Bot className="w-16 h-16 text-gray-800 mx-auto mb-6" />
            <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Sélectionnez un vendeur pour configurer son IA.</p>
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
                  <Settings2 size={14} className="text-purple-400" />
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
    </div>
  );
};

export default AdminChatbot;
