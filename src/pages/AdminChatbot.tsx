import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Sparkles, 
  Save, 
  Loader2, 
  MessageSquare, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatbotSetting {
  id: string;
  intent: string;
  response_template: string;
  use_whatsapp: boolean;
}

const AdminChatbot = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ChatbotSetting[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chatbot_settings')
      .select('*')
      .order('intent');

    if (error) {
      toast.error('Erreur lors du chargement des réglages.');
    } else {
      setSettings(data || []);
    }
    setLoading(false);
  };

  const handleUpdate = async (id: string, updates: Partial<ChatbotSetting>) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const setting of settings) {
        const { error } = await supabase
          .from('chatbot_settings')
          .update({
            response_template: setting.response_template,
            use_whatsapp: setting.use_whatsapp,
            updated_at: new Date().toISOString()
          })
          .eq('id', setting.id);
        
        if (error) throw error;
      }
      toast.success('Réglages enregistrés avec succès !');
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour Dashboard
          </Link>
          <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-4">
            <Sparkles className="w-10 h-10 text-yellow-400" />
            Réglages Chatbot
          </h1>
          <p className="text-gray-500 text-lg">Personnalisez les réponses automatiques et les intentions.</p>
        </div>
        <button
          onClick={saveAll}
          disabled={saving}
          className="h-12 px-8 rounded-2xl bg-yellow-400 text-gray-900 font-black hover:bg-yellow-500 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Enregistrer tout
        </button>
      </div>

      <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-3xl p-6 mb-10 flex gap-4 items-start">
        <AlertCircle className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-200/80 leading-relaxed">
          <p className="font-bold text-yellow-400 mb-1">Variables disponibles :</p>
          <ul className="list-disc list-inside space-y-1">
            <li><code className="text-white font-mono">{`{product_name}`}</code> : Nom de l'équipement</li>
            <li><code className="text-white font-mono">{`{price}`}</code> : Prix formaté</li>
            <li><code className="text-white font-mono">{`{vendor_name}`}</code> : Nom du vendeur</li>
            <li><code className="text-white font-mono">{`{power}`}</code> : Puissance (kVA)</li>
            <li><code className="text-white font-mono">{`{description}`}</code> : Description technique</li>
          </ul>
        </div>
      </div>

      <div className="space-y-6">
        {settings.map((setting) => (
          <motion.div
            key={setting.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 rounded-[2rem] border-white/5 space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Intention : {setting.intent}</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Utiliser WhatsApp</span>
                <button
                  onClick={() => handleUpdate(setting.id, { use_whatsapp: !setting.use_whatsapp })}
                  className={`w-12 h-6 rounded-full transition-all relative ${setting.use_whatsapp ? 'bg-green-500' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${setting.use_whatsapp ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] text-gray-500 uppercase font-black px-1 tracking-widest">Modèle de réponse</label>
              <textarea
                value={setting.response_template}
                onChange={(e) => handleUpdate(setting.id, { response_template: e.target.value })}
                className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm focus:border-yellow-400/50 outline-none transition-all resize-none"
                placeholder="Saisissez le texte de réponse..."
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminChatbot;
