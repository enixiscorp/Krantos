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
  Zap,
  Package,
  Store,
  MessageCircle,
  FileDown,
  X,
  Send,
  Bot,
  User,
  ExternalLink,
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
import { processMessage } from '../services/chatbotEngine';

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
      const response = await processMessage(msg, product.id);
      setChatMessages(prev => [...prev, { role: 'bot', text: response }]);
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

      {/* Personalized Advice (Chatbot) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-8 rounded-[2.5rem] mb-16"
      >
        <div className="flex items-center gap-2 mb-8">
          <Bot className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Conseil personnalisé</span>
        </div>

        <div className="space-y-6 mb-8 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-5 py-4 rounded-3xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-yellow-400 text-gray-900 font-bold rounded-tr-sm'
                    : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="relative">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleChatSend()}
            placeholder="Posez votre question..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/50 pr-16 transition-all"
          />
          <button
            onClick={handleChatSend}
            className="absolute right-2 top-2 bottom-2 w-12 rounded-xl bg-yellow-400 text-gray-900 flex items-center justify-center hover:bg-yellow-500 transition-all active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

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
