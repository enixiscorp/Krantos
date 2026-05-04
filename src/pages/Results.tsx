// ============================================================
// Krantos Platform — Results Page (Premium Dark Overhaul)
// Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4,
//               8.1, 8.2, 8.3, 8.4, 8.5
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
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
  MessageSquare,
  User,
  RotateCcw
} from 'lucide-react';

import type { Product, Vendor, ApplianceInput } from '../lib/supabase';
import { supabase } from '../lib/supabase';
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
  const navigate = useNavigate();
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
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll within the chat container only to avoid page jumps
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
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
    leadId,
    userName,
    userPhone,
    location,
    appliances,
  } = state;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChatSend = async (overrideText?: string) => {
    const msg = (overrideText || chatInput).trim();
    if (!msg || chatLoading || !product) return;
    
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);

    try {
      const history = chatMessages.slice(-5).map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.text
      }));

      const api = await sendChatbotMessage({
        message: msg,
        vendor_id: vendor?.id || '',
        product_id: product.id,
        history: history
      });
      
      setChatMessages(prev => [...prev, { role: 'bot', text: api.response }]);
      setChatSuggestions(api.suggestions || []);
    } catch {
      setChatMessages(prev => [...prev, { role: 'bot', text: "Erreur lors de la réponse. Réessayez." }]);
    } finally {
      chatLoading && setChatLoading(false);
    }
  };

  const handleExportPDF = () => {
     const doc = new jsPDF({ unit: 'mm', format: 'a4' });
     const pageWidth = doc.internal.pageSize.getWidth();
     
     // Krantos Background Header
     doc.setFillColor(20, 20, 24);
     doc.rect(0, 0, pageWidth, 40, 'F');
     
     doc.setTextColor(250, 204, 21); // Krantos Yellow
     doc.setFontSize(26);
     doc.setFont('helvetica', 'bold');
     doc.text('Krantos Energy', 15, 25);
     
     doc.setTextColor(255, 255, 255);
     doc.setFontSize(10);
     doc.text(`Rapport personnalisé — ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 15, 25, { align: 'right' });
     
     let y = 55;

     // Client Section
     doc.setTextColor(50);
     doc.setFontSize(14);
     doc.setFont('helvetica', 'bold');
     doc.text('Détails du Client', 15, y);
     y += 8;
     doc.setFontSize(10);
     doc.setFont('helvetica', 'normal');
     doc.text(`Nom : ${userName}`, 15, y);
     doc.text(`Téléphone : ${userPhone}`, pageWidth / 2, y);
     y += 5;
     doc.text(`Localisation : ${location}`, 15, y);
     y += 15;

     // Energy Results
     doc.setFillColor(250, 204, 21, 0.1);
     doc.rect(10, y-5, pageWidth-20, 30, 'F');
     
     doc.setTextColor(0);
     doc.setFontSize(14);
     doc.setFont('helvetica', 'bold');
     doc.text('Besoin Énergétique Estimé', 15, y+5);
     
     doc.setFontSize(18);
     doc.setTextColor(250, 204, 21);
     doc.text(`${totalWatts.toFixed(0)} W`, pageWidth - 20, y+5, { align: 'right' });
     
     doc.setFontSize(10);
     doc.setTextColor(100);
     doc.text(`Soit environ ${(totalWatts / 1000).toFixed(2)} kW / ${totalKVA.toFixed(2)} kVA`, pageWidth - 20, y+12, { align: 'right' });
     y += 35;

     // Product Section
     if (product) {
       doc.setTextColor(0);
       doc.setFontSize(14);
       doc.setFont('helvetica', 'bold');
       doc.text('Solution Recommandée', 15, y);
       y += 8;
       
       doc.setFontSize(11);
       doc.text(product.name, 15, y);
       doc.setTextColor(250, 204, 21);
       doc.text(`${formatPrice(product.price)} FCFA`, pageWidth - 20, y, { align: 'right' });
       
       y += 6;
       doc.setFontSize(9);
       doc.setTextColor(100);
       const splitDesc = doc.splitTextToSize(product.description || '', pageWidth - 30);
       doc.text(splitDesc, 15, y);
       y += (splitDesc.length * 5) + 10;
     }

     // Vendor Section
     if (vendor) {
       doc.setDrawColor(230);
       doc.line(15, y, pageWidth - 15, y);
       y += 10;
       
       doc.setTextColor(0);
       doc.setFontSize(12);
       doc.setFont('helvetica', 'bold');
       doc.text('Boutique Partenaire', 15, y);
       y += 8;
       
       doc.setFontSize(14);
       doc.setTextColor(250, 204, 21);
       doc.text(vendor.name, 15, y);
       
       y += 6;
       doc.setFontSize(10);
       doc.setTextColor(50);
       doc.text(`Contact WhatsApp : ${vendor.phone}`, 15, y);
       y += 5;
       doc.text(`Email : ${vendor.email}`, 15, y);
     }

     // Footer
     doc.setTextColor(150);
     doc.setFontSize(8);
     doc.text('Ce rapport est une estimation basée sur vos appareils. Krantos Energy Lomé.', pageWidth / 2, 285, { align: 'center' });

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
      const cleanPhone = vendor.phone.replace(/\D/g, '');

      // If lead was not saved to DB (offline fallback), insert it now with status 'contacted'
      if (leadId.startsWith('offline-')) {
        const { error: insertErr } = await supabase
          .from('leads')
          .insert({
            user_name: userName,
            user_phone: userPhone,
            location,
            total_power_needed: totalKVA,
            recommended_product_id: product.id,
            vendor_id: vendor.id,
            status: 'contacted',
          });
        if (insertErr) console.warn('[Lead] Could not save offline lead:', insertErr.message);
      } else {
        // Update existing lead status to 'contacted'
        await updateLeadStatus(leadId, 'contacted');
      }

      sendWhatsAppMessage(cleanPhone, message, vendor.status);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'ouverture de WhatsApp.");
    } finally {
      setIsContactingWhatsApp(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Home Navigation */}
      <div className="flex justify-between items-center mb-12">
        <Link 
          to="/" 
          className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
        >
          <RotateCcw className="w-4 h-4" />
          Retour à l'accueil
        </Link>
        <div className="flex gap-4">
           {/* Add share or other small utils here if needed */}
        </div>
      </div>

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
          {product?.description || `Idéal pour vos besoins calculés de ${totalKVA.toFixed(2)} kVA.`}
        </p>
      </motion.div>

      {/* Main Solution Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-[3rem] border-white/5 overflow-hidden group"
        >
          <div className="aspect-square bg-black/20 relative overflow-hidden">
            {product?.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement?.classList.add('bg-black/40');
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-800">
                <Sparkles className="w-20 h-20 mb-4 opacity-10" />
                <p className="text-xs font-black uppercase tracking-widest opacity-20">Visuel non disponible</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 rounded-lg bg-yellow-400 text-black text-[9px] font-black uppercase tracking-widest">
                  Solution Idéale
                </span>
                <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest">
                  {product?.category}
                </span>
              </div>
              <h3 className="text-2xl font-black text-white">{product?.name}</h3>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 glass-card p-10 rounded-[2.5rem] flex flex-col justify-center border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent"
          >
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 block">Puissance Estimée</span>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-5xl font-black text-white leading-none tracking-tighter">{totalWatts.toFixed(0)}</span>
              <span className="text-xl font-bold text-gray-600">W</span>
            </div>
            <p className="text-[10px] text-gray-500 font-bold tracking-wide uppercase opacity-60">
              ≈ {(totalWatts / 1000).toFixed(2)} kW / {totalKVA.toFixed(2)} kVA
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 glass-card p-10 rounded-[2.5rem] flex flex-col justify-center border-yellow-400/30 accent-glow bg-yellow-400/[0.03] shadow-[0_0_50px_-12px_rgba(250,204,21,0.15)]"
          >
            <span className="text-[10px] font-black text-yellow-500/50 uppercase tracking-[0.2em] mb-4 block">Prix de l'équipement</span>
            <div className="flex items-baseline gap-2 mb-2">
              <motion.span 
                animate={{ opacity: [1, 0.7, 1], scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="text-5xl font-black text-yellow-400 leading-none tracking-tighter"
              >
                {product ? formatPrice(product.price) : "—"}
              </motion.span>
              <span className="text-xl font-bold text-yellow-400/60 uppercase">FCFA</span>
            </div>
            <p className="text-[10px] text-gray-500 font-bold tracking-wide uppercase opacity-80">
              Disponible chez <span className="text-white font-black">{vendor?.name || "un partenaire"}</span>
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-20 items-stretch">
        <motion.button
          onClick={handleWhatsApp}
          animate={{ boxShadow: ["0 0 0px rgba(0,217,95,0)", "0 0 20px rgba(0,217,95,0.4)", "0 0 0px rgba(0,217,95,0)"] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex-[2] flex items-center justify-center gap-3 py-5 rounded-2xl bg-[#00D95F] text-white font-black text-sm uppercase tracking-widest hover:bg-[#00c456] transition-all shadow-xl shadow-green-500/10"
        >
          <MessageCircle className="w-5 h-5 fill-current" />
          Contacter sur WhatsApp
        </motion.button>
        <button
          onClick={handleExportPDF}
          className="flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          <FileDown className="w-5 h-5" />
          Exporter PDF
        </button>
        <button
          onClick={() => {
             if (!vendor) return;
             const cleanPhone = vendor.phone.replace(/\D/g, '');
             window.open(`tel:+${cleanPhone}`, '_self');
          }}
          className="flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          <Phone className="w-5 h-5" />
          Appeler
        </button>
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

        <div className="bg-[#0A0A0B] rounded-[2.5rem] p-8 border border-white/5 h-[450px] flex flex-col">
          <div 
            ref={chatContainerRef}
            className="space-y-6 flex-1 mb-8 overflow-y-auto scrollbar-hide"
          >
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
                    ? 'bg-yellow-400 text-gray-950 font-black shadow-lg shadow-yellow-400/10' 
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
          </div>

          {/* Suggestions */}
          {chatSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2">
              {chatSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChatSend(s)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-gray-400 hover:text-yellow-400 hover:border-yellow-400/50 transition-all flex items-center gap-2 group"
                >
                  {s}
                  <ChevronRight size={10} className="group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          )}

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
              onClick={() => handleChatSend()}
              disabled={chatLoading}
              className="absolute right-2 top-2 bottom-2 px-6 rounded-xl bg-yellow-400 text-gray-950 flex items-center justify-center hover:bg-yellow-500 transition-all disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Results;
