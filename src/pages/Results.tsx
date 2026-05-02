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
  Phone,
  FileDown,
  Send,
  Bot,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Share2,
  ExternalLink,
  MessageSquare,
  User,
  Package
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
      const api = await sendChatbotMessage({
        message: msg,
        vendor_id: vendor?.id || '',
        product_id: product.id
      });
      setChatMessages(prev => [...prev, { role: 'bot', text: api.response }]);
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
    if (!product || !vendor) return;
    setIsContactingWhatsApp(true);
    try {
      const message = buildWhatsAppMessage(
        { fullName: userName, phone: userPhone, location },
        appliances, totalWatts, totalKVA, product
      );
      
      // Format number: remove +, spaces, dashes. Ensure it's international.
      // If it starts with 00, replace with nothing. If it doesn't have +228, we could add it, 
      // but let's assume the phone in DB is already formatted or has the country code.
      const cleanPhone = vendor.phone.replace(/\D/g, '');
      
      sendWhatsAppMessage(cleanPhone, message, vendor.status);
      await updateLeadStatus(leadId, 'contacted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'ouverture de WhatsApp.");
    } finally {
      setIsContactingWhatsApp(false);
    }
  };

  const handleCall = () => {
    if (!vendor) return;
    const cleanPhone = vendor.phone.replace(/\D/g, '');
    window.open(`tel:+${cleanPhone}`, '_self');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header Recommendation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Notre recommandation</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-white leading-tight">
          {product ? product.name : "Système Énergétique Optimisé"}
        </h1>
        <p className="text-gray-400 text-lg font-medium max-w-2xl">
          {product?.description || `Idéal pour petits foyers : éclairage, TV, ventilateur, frigo. Basé sur votre besoin de ${totalKVA.toFixed(2)} kVA.`}
        </p>
      </motion.div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-10 rounded-[2.5rem] flex flex-col justify-center border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent h-full min-h-[220px]"
        >
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 block">Puissance estimée</span>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-6xl font-black text-white leading-none tracking-tighter">{totalWatts}</span>
            <span className="text-2xl font-bold text-gray-600">W</span>
          </div>
          <p className="text-xs text-gray-500 font-bold tracking-wide uppercase opacity-60">≈ {totalKVA.toFixed(2)} kVA (marge 30% incluse)</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-10 rounded-[2.5rem] flex flex-col justify-center border-yellow-400/30 accent-glow bg-yellow-400/[0.03] shadow-[0_0_50px_-12px_rgba(250,204,21,0.15)] h-full min-h-[220px]"
        >
          <span className="text-[10px] font-black text-yellow-500/50 uppercase tracking-[0.2em] mb-6 block">Prix</span>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-6xl font-black text-yellow-400 leading-none tracking-tighter">{product ? formatPrice(product.price) : "—"}</span>
            <span className="text-2xl font-bold text-yellow-400/60 uppercase">FCFA</span>
          </div>
          <p className="text-xs text-gray-500 font-bold tracking-wide uppercase opacity-80 italic">Vendu par {vendor?.name || "Krantos Energy Lomé"}</p>
        </motion.div>
      </div>

      {/* Main Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-20 items-stretch">
        <button
          onClick={handleWhatsApp}
          className="flex-[2] flex items-center justify-center gap-3 py-5 rounded-2xl bg-[#00D95F] text-white font-black text-sm uppercase tracking-widest hover:bg-[#00c456] transition-all shadow-xl shadow-green-500/10"
        >
          <MessageCircle className="w-5 h-5 fill-current" />
          Contacter sur WhatsApp
        </button>
        <button
          onClick={handleExportPDF}
          className="flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          <FileDown className="w-5 h-5" />
          Exporter PDF
        </button>
        <Link
          to={`/vendor/${vendor?.id}`}
          className="flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          <ExternalLink className="w-5 h-5" />
          Voir le vendeur
        </Link>
      </div>

      {/* Integrated Chat Advice Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-10 rounded-[3rem] border-white/5 mb-20 bg-gradient-to-br from-yellow-400/[0.02] to-transparent"
      >
        <div className="flex items-center gap-3 mb-8">
          <MessageSquare className="w-6 h-6 text-yellow-400" />
          <h2 className="text-2xl font-black text-white tracking-tight uppercase tracking-widest">Conseil personnalisé</h2>
        </div>

        <div className="bg-[#0A0A0B] rounded-[2.5rem] p-8 border border-white/5 min-h-[200px] flex flex-col">
          <div className="space-y-6 flex-1 mb-8">
            {chatMessages.map((msg, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, x: msg.role === 'bot' ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'bot' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-white/10 text-white'}`}>
                    {msg.role === 'bot' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className={`px-6 py-4 rounded-[1.5rem] text-sm font-medium leading-relaxed ${
                    msg.role === 'user' 
                    ? 'bg-yellow-400 text-gray-950 font-black' 
                    : 'bg-white/[0.03] text-gray-300 border border-white/5'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </motion.div>
            ))}
            {chatLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-yellow-400/10 flex items-center justify-center animate-pulse">
                  <Bot size={16} className="text-yellow-400" />
                </div>
                <div className="bg-white/5 px-6 py-4 rounded-[1.5rem] animate-pulse">
                  <div className="w-12 h-2 bg-white/10 rounded-full" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="relative group">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChatSend()}
              placeholder="Posez votre question..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-yellow-400/50 transition-all placeholder:text-gray-600"
            />
            <button
              onClick={handleChatSend}
              disabled={chatLoading}
              className="absolute right-2 top-2 bottom-2 px-6 rounded-xl bg-yellow-400 text-gray-950 flex items-center justify-center hover:bg-yellow-500 transition-all disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Alternatives Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-32"
      >
        <h2 className="text-2xl font-black text-white mb-10 tracking-tight uppercase tracking-widest ml-2">Solutions Alternatives</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { cat: 'Solaire', name: 'Kit Solaire 3 kVA + batteries', price: 1200000, details: '2400 W - 3 kVA' },
            { cat: 'Groupe électrogène essence', name: 'Groupe électrogène 5 kVA - Kipor', price: 850000, details: '4000 W - 5 kVA' },
            { cat: 'Groupe électrogène diesel', name: 'Groupe électrogène 8 kVA Diesel', price: 1850000, details: '6400 W - 8 kVA' },
          ].map((alt, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="glass-card p-8 rounded-[2.5rem] border-white/5 hover:border-white/10 transition-all cursor-pointer group bg-gradient-to-br from-white/[0.01] to-transparent"
            >
              <div className="flex flex-col gap-2 mb-8">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{alt.cat}</span>
                <h3 className="font-bold text-white group-hover:text-yellow-400 transition-colors leading-snug">{alt.name}</h3>
              </div>
              <div className="space-y-1">
                <p className="text-xl font-black text-yellow-400 tracking-tight">{formatPrice(alt.price)} FCFA</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider opacity-60">{alt.details}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Results;
