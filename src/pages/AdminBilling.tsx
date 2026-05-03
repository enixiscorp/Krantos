// ============================================================
// Krantos Platform — /admin/billing (Premium Dark Overhaul)
// Requirements: 7.2, 7.3, 7.4 (Billing export)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Zap,
  Loader2,
  FileText,
  Calendar,
  Download,
  ArrowLeft,
  Users,
  Search,
  ChevronRight,
  TrendingUp,
  Bell,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vendor } from '../lib/supabase';
import { generateReport, exportToPDF } from '../services/billingService';
import type { BillingReport } from '../services/billingService';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminBilling = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Report state
  const [report, setReport] = useState<BillingReport | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/business-login', { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('name');

      if (error) {
        toast.error('Erreur lors du chargement des vendeurs.');
      } else if (mounted) {
        setVendors(data ?? []);
      }
      if (mounted) setLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleGeneratePreview = async () => {
    if (!selectedVendor) {
      toast.error('Veuillez sélectionner un vendeur.');
      return;
    }

    setIsGenerating(true);
    setReport(null);

    try {
      const rep = await generateReport(
        selectedVendor.id,
        new Date(startDate),
        new Date(endDate)
      );
      setReport(rep);
      if (rep.lines.length === 0) {
        toast.info('Aucune commission trouvée pour cette période.');
      } else {
        toast.success('Rapport généré avec succès.');
      }
    } catch (err) {
      toast.error('Erreur lors de la génération du rapport.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNotifyVendor = async () => {
    if (!report) return;
    
    setIsGenerating(true);
    try {
      const { error } = await supabase.rpc('notify_vendor_payment', {
        v_id: report.vendor.id
      });

      if (error) throw error;

      toast.success(`Notification envoyée à ${report.vendor.name}.`);
      
      // Refresh report to show updated count
      const rep = await generateReport(
        report.vendor.id,
        report.period.start,
        report.period.end
      );
      setReport(rep);
    } catch (err) {
      toast.error('Erreur lors de l’envoi de la notification.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!report) return;
    try {
      exportToPDF(report);
      toast.success('Déchargement du PDF démarré.');
    } catch (err) {
      toast.error('Erreur lors de l’export PDF.');
    }
  };

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Retour Dashboard
        </Link>
        <h1 className="text-4xl font-black text-white mb-2">Facturation</h1>
        <p className="text-gray-500 text-lg">Génération de rapports et factures pour les vendeurs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Step 1: Selection */}
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-10 rounded-[2.5rem] border-white/5"
          >
            <div className="flex items-center gap-2 mb-8 uppercase tracking-widest text-[10px] font-black text-gray-500">
              <span className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center mr-1">1</span>
              Configuration du rapport
            </div>

            <div className="space-y-6">
              {/* Vendor Search/Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Sélectionner un vendeur</label>
                <div className="relative group mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-yellow-400 transition-colors" />
                  <input
                    type="text"
                    placeholder="Filtrer par nom..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                  />
                </div>
                
                <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                  {filteredVendors.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVendor(v)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                        selectedVendor?.id === v.id
                          ? 'bg-yellow-400 border-yellow-400 text-gray-900 shadow-lg shadow-yellow-400/20'
                          : 'bg-white/5 border-white/5 text-white hover:border-white/20'
                      }`}
                    >
                      <span className="font-bold text-sm tracking-tight">{v.name}</span>
                      {selectedVendor?.id === v.id && <ChevronRight className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Dénut</label>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-4 focus-within:border-yellow-400/40">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="bg-transparent border-none outline-none text-white text-sm w-full"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Fin</label>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-4 focus-within:border-yellow-400/40">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="bg-transparent border-none outline-none text-white text-sm w-full"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleGeneratePreview}
                disabled={isGenerating || !selectedVendor}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white text-gray-900 font-black text-sm hover:bg-yellow-400 transition-all active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
                Générer l'aperçu
              </button>
            </div>
          </motion.div>
        </div>

        {/* Step 2: Preview */}
        <div className="space-y-8">
          <AnimatePresence mode="wait">
            {!report ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full flex flex-col items-center justify-center glass-card p-10 rounded-[2.5rem] border-white/5 border-dashed border-2 text-center"
              >
                <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-6">
                  <FileText className="w-8 h-8 text-gray-700" />
                </div>
                <h3 className="text-xl font-bold text-gray-600">Aucun rapport généré</h3>
                <p className="text-sm text-gray-700 mt-2">Sélectionnez un vendeur et une période à gauche.</p>
              </motion.div>
            ) : (
              <motion.div
                key="report"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-10 rounded-[2.5rem] border-yellow-400/20 bg-yellow-400/[0.02] relative"
              >
                <div className="flex items-center gap-2 mb-10 uppercase tracking-widest text-[10px] font-black text-yellow-500/50">
                  <span className="w-6 h-6 rounded-lg bg-yellow-400/10 flex items-center justify-center mr-1">2</span>
                  Aperçu du rapport
                </div>

                <div className="space-y-10">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4">Total à facturer</span>
                    <div className="flex items-baseline gap-2 mb-2">
                       <span className="text-5xl font-black text-white">{report.total.toLocaleString('fr-FR')}</span>
                       <span className="text-xl font-bold text-gray-500">FCFA</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">
                         {report.lines.length} commissions confirmées
                      </p>
                      {report.vendor.payment_notifications_count > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest">
                          <AlertTriangle className="w-3 h-3" />
                          {report.vendor.payment_notifications_count} Rappels envoyés
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest px-2">Détails récents</p>
                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2 scrollbar-hide">
                      {report.lines.map((line, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Leads: {line.leadId.slice(0, 8)}</span>
                            <span className="text-sm font-bold text-white">{new Date(line.date).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-white">{line.amount.toLocaleString('fr-FR')} FCFA</p>
                            <p className="text-[10px] font-bold text-yellow-400/50 uppercase">Taux: {line.rateApplied}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={handleDownloadPDF}
                      className="h-14 rounded-2xl bg-yellow-400 text-gray-900 font-black text-sm hover:bg-yellow-500 transition-all flex items-center justify-center gap-2 accent-glow"
                    >
                      <Download className="w-5 h-5" />
                      Télécharger PDF
                    </button>
                    <button
                      onClick={handleNotifyVendor}
                      disabled={isGenerating}
                      className="h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
                      Envoyer Rappel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AdminBilling;
