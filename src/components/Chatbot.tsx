import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { sendChatbotMessage, getChatbotConfig } from '../services/chatbotApi';
import { toast } from 'sonner';

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

interface ChatbotProps {
  vendorId: string;
  vendorName: string;
  productId?: string | null;
}

const Chatbot = ({ vendorId, vendorName, productId }: ChatbotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [config, setConfig] = useState<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadConfig();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConfig = async () => {
    try {
      const data = await getChatbotConfig(vendorId);
      setConfig(data);
      const welcome = data?.welcome_message?.replace('{vendor_name}', vendorName) || `Bonjour ! Comment puis-je vous aider ?`;
      setMessages([{ role: 'assistant', content: welcome }]);
      setSuggestions(data?.suggestions?.map((s: any) => s.question) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const res = await sendChatbotMessage({
        message: text,
        vendor_id: vendorId,
        product_id: productId,
        history: messages.slice(-5) // Send last 5 messages for context
      });

      setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
      setSuggestions(res.suggestions || []);
    } catch (err) {
      toast.error("Erreur de connexion avec l'assistant.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[999]">
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="w-16 h-16 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-2xl shadow-yellow-400/40 hover:scale-110 transition-all active:scale-95 group"
          >
            <MessageSquare className="w-7 h-7 group-hover:rotate-12 transition-transform" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-zinc-900 animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="w-[380px] h-[600px] max-h-[85vh] glass-card rounded-[2.5rem] border-white/10 shadow-2xl flex flex-col overflow-hidden bg-zinc-900/95 backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-gradient-to-r from-yellow-400/10 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/20">
                  <Bot className="w-7 h-7 text-black" />
                </div>
                <div>
                  <h3 className="font-black text-white uppercase tracking-tight text-sm">Assistant Krantos</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{vendorName} (IA)</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
            >
              {messages.map((m, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-white/5' : 'bg-yellow-400/20'}`}>
                      {m.role === 'user' ? <User size={14} className="text-gray-400" /> : <Sparkles size={14} className="text-yellow-400" />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user' 
                        ? 'bg-yellow-400 text-black font-bold rounded-tr-none shadow-lg shadow-yellow-400/10' 
                        : 'bg-white/5 text-gray-200 rounded-tl-none border border-white/5'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start animate-pulse">
                  <div className="flex gap-3 items-center">
                    <div className="w-8 h-8 rounded-xl bg-yellow-400/10 flex items-center justify-center text-yellow-400">
                      <Loader2 size={14} className="animate-spin" />
                    </div>
                    <div className="bg-white/5 px-4 py-2 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Réflexion...
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions & Input */}
            <div className="p-6 space-y-4 bg-white/[0.02] border-t border-white/5">
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(s)}
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-gray-400 hover:text-yellow-400 hover:border-yellow-400/50 transition-all flex items-center gap-2 group"
                    >
                      {s}
                      <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  ))}
                </div>
              )}

              <div className="relative group">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                  placeholder="Posez votre question..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-6 pr-14 py-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-400/50 transition-all"
                />
                <button
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={!inputValue.trim() || loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-yellow-400 text-black flex items-center justify-center hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[8px] text-center text-gray-700 uppercase font-black tracking-widest">IA Krantos v1.2 — Propulsé par Gemini</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chatbot;
