// ============================================================
// Krantos Platform — Results Page (Premium Dark Overhaul)
// Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4,
//               8.1, 8.2, 8.3, 8.4, 8.5
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import {
  MessageCircle,
  FileDown,
  Send,
  Bot,
  ChevronRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

import type { Product, Vendor, ApplianceInput } from '../lib/supabase';
import {
  buildWhatsAppMessage,
  sendWhatsAppMessage,
  updateLeadStatus,
} from '../services/whatsappService';
import { sendChatbotMessage } from '../services/chatbotApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResultsState {
  totalWatts: number;
  totalKVA: number;
  product: Product | null;
  vendor: Vendor | null;
  alternatives?: { product: Product; vendor: Vendor }[];
  leadId: string;
  userName: string;
  userPhone: string;
  location: string;
  appliances: ApplianceInput[];
}

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  cta?: 'whatsapp' | 'none';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number): string {
  return Number(price).toLocaleString('fr-FR');
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const Results = () => {
  const { state } = useLocation() as { state: ResultsState | null };
  const [showChatbot, setShowChatbot] = useState(false);
  const [isContactingWhatsApp, setIsContactingWhatsApp] = useState(false);
  
  // Chatbot state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'bot',
      text: "Bonjour 👋 je suis votre conseiller Krantos. Posez-moi vos questions : prix, caractéristiques, garantie, fiabilité, durée de vie.",
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const quickPrompts = ['Quel est le prix ?', 'Quelle est la durée de vie ?', 'Est-ce fiable ?', 'Je veux commander'];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!state) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Aucun résultat disponible</h1>
        <p className="text-gray-400 mb-6 text-sm">Veuillez d'abord effectuer un calcul de puissance.</p>
        <Link
          to="/calculate-power"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-yellow-400 text-gray-900 font-bold transition-all hover:scale-105"
        >
          Calculer mes besoins
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const {
    totalWatts,
    totalKVA,
    product,
    vendor,
    alternatives = [],
    leadId,
    userName,
    userPhone,
    location,
    appliances,
  } = state;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading || !product) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);

    try {
      const api = await sendChatbotMessage(msg, product.id);
      setChatMessages(prev => [...prev, { role: 'bot', text: api.response, cta: api.cta }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'bot', text: "Erreur lors de la réponse. Réessayez." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleExportPDF = () => {
     const doc = new jsPDF({ unit: 'mm', format: 'a4' });
     const pageWidth = doc.internal.pageSize.getWidth();
     let y = 20;

     doc.setFontSize(22);
     doc.setFont('helvetica', 'bold');
     doc.text('Krantos Energy', pageWidth / 2, y, { align: 'center' });
     y += 12;

     doc.setFontSize(10);
     doc.setFont('helvetica', 'normal');
     doc.setTextColor(150);
     doc.text(`Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, y, { align: 'center' });
     y += 15;

     doc.setTextColor(0);
     doc.setFontSize(14);
     doc.text('Besoins énergétiques', 15, y); y += 8;
     doc.setFontSize(10);
     doc.text(`Puissance estimée : ${totalWatts} W (${totalKVA.toFixed(2)} kVA)`, 15, y); y += 10;

     if (product) {
       doc.setFontSize(14);
       doc.text('Produit recommandé', 15, y); y += 8;
       doc.setFontSize(10);
       doc.text(`Nom : ${product.name}`, 15, y); y += 5;
       doc.text(`Prix : ${formatPrice(product.price)} FCFA`, 15, y); y += 10;
     }

     doc.save(`krantos-report-${userName.replace(/\s+/g, '-')}.pdf`);
     toast.success('Rapport PDF exporté.');
  };

  const handleWhatsApp = async () => {
    if (!vendor || !product) return;
    setIsContactingWhatsApp(true);
    try {
      const message = buildWhatsAppMessage(
        { first_name: userName.split(' ')[0], last_name: userName.split(' ')[1] || '', phone: userPhone, location },
        appliances, totalWatts, totalKVA, product
      );
      sendWhatsAppMessage(vendor.phone || '', message, 'active');
      await updateLeadStatus(leadId, 'contacted');
    } catch (err) {
      toast.error("Erreur lors de l'ouverture de WhatsApp.");
    } finally {
      setIsContactingWhatsApp(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header Recommendation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Notre recommandation</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-white">
          {product ? product.name : "Aucun produit trouvé"}
        </h1>
        <p className="text-gray-400 text-lg">
          {product ? `Idéal pour votre besoin de ${totalKVA.toFixed(2)} kVA.` : "Ajustez vos critères ou contactez un expert."}
        </p>
      </motion.div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-10 rounded-[2.5rem] flex flex-col items-center text-center group border-white/5"
        >
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4">Puissance estimée</span>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-black text-white">{totalWatts}</span>
            <span className="text-xl font-bold text-gray-500">W</span>
          </div>
          <p className="text-xs text-gray-500 font-medium tracking-wide">≈ {totalKVA.toFixed(2)} kVA (marge 30% incluse)</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-10 rounded-[2.5rem] flex flex-col items-center text-center group border-yellow-400/20 accent-glow bg-yellow-400/[0.02]"
        >
          <span className="text-[10px] font-bold text-yellow-500/50 uppercase tracking-[0.2em] mb-4">Prix</span>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-black text-yellow-400">{product ? formatPrice(product.price) : "—"}</span>
            <span className="text-xl font-bold text-yellow-400/60">FCFA</span>
          </div>
          <p className="text-xs text-gray-500 font-medium tracking-wide">Vendu par {vendor?.name || "un partenaire Krantos"}</p>
        </motion.div>
      </div>

      {/* Main Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-16">
        <button
          onClick={handleWhatsApp}
          className="flex-1 flex items-center justify-center gap-3 py-5 rounded-[2rem] bg-green-500 text-white font-black text-lg hover:bg-green-600 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-green-500/20"
        >
          <MessageCircle className="w-6 h-6 fill-current" />
          Contacter sur WhatsApp
        </button>
        <button
          onClick={handleExportPDF}
          className="px-8 py-5 rounded-[2rem] border-2 border-white/10 text-white font-bold hover:bg-white/5 transition-all flex items-center justify-center gap-2"
        >
          <FileDown className="w-5 h-5" />
          Exporter PDF
        </button>
        <Link
          to={`/vendor/${vendor?.id}`}
          className="px-8 py-5 rounded-[2rem] border-2 border-white/10 text-white font-bold hover:bg-white/5 transition-all flex items-center justify-center gap-2"
        >
          Voir le vendeur
        </Link>
      </div>

      {/* Floating chatbot button */}
      <button
        onClick={() => setShowChatbot(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-yellow-400 text-gray-900 shadow-2xl shadow-yellow-400/30 flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Ouvrir le chatbot"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {showChatbot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
            onClick={() => setShowChatbot(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl glass-card rounded-3xl border border-white/10 p-5 md:p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm font-bold text-white">Assistant Krantos</span>
                </div>
                <button
                  onClick={() => setShowChatbot(false)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Fermer
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setChatInput(prompt)}
                    className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="space-y-4 mb-4 max-h-[320px] overflow-y-auto pr-1">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                        msg.role === 'user'
                          ? 'bg-yellow-400 text-gray-900 font-bold'
                          : 'bg-white/5 text-gray-200 border border-white/10'
                      }`}
                    >
                      <p>{msg.text}</p>
                      {msg.role === 'bot' && msg.cta === 'whatsapp' && (
                        <button
                          onClick={handleWhatsApp}
                          className="mt-3 text-xs px-3 py-1.5 rounded-full bg-green-500 text-white font-bold hover:bg-green-600"
                        >
                          Contacter sur WhatsApp
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="text-xs text-gray-400">Le bot écrit...</div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                  placeholder="Posez votre question..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/50 pr-14"
                />
                <button
                  onClick={handleChatSend}
                  className="absolute right-2 top-2 bottom-2 w-10 rounded-xl bg-yellow-400 text-gray-900 flex items-center justify-center hover:bg-yellow-500"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold mb-8 ml-2">Alternatives</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {alternatives.map((alt, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className="glass-card p-6 rounded-3xl flex flex-col gap-4 border-white/5 hover:border-white/10 transition-all cursor-pointer group"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{alt.product.category}</span>
                  <h3 className="font-bold text-white group-hover:text-yellow-400 transition-colors">{alt.product.name}</h3>
                </div>
                <div>
                  <p className="text-lg font-black text-yellow-400">{formatPrice(alt.product.price)} FCFA</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{alt.product.power_rating} kVA - 2400 W</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Results;
