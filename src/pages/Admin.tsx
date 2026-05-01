import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Loader2,
  Users,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  AlertTriangle,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { getAdminDashboard, type AdminDashboardPayload } from '../services/adminService';
import { getStatsLeads } from '../services/statsService';
import { supabase } from '../lib/supabase';

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
  const [chartData, setChartData] = useState<{ label: string; count: number }[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Filters
  const [period, setPeriod] = useState('day');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [dash, roleInfo] = await Promise.all([
          getAdminDashboard(),
          (async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const uid = sessionData.session?.user.id;
            if (!uid) return { super: false };
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', uid)
              .single();
            return { super: profile?.role === 'super_admin' };
          })(),
        ]);
        
        if (!mounted) return;
        setDashboard(dash);
        setIsSuperAdmin(roleInfo.super);
      } catch (e) {
        console.error('Dashboard load error:', e);
        toast.error('Erreur lors du chargement des données.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch stats when filters change
  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const res = await getStatsLeads({ 
          period, 
          vendor_id: selectedVendor === 'all' ? undefined : selectedVendor 
        });
        if (mounted) {
          setChartData(res.chart_data);
        }
      } catch (e) {
        console.error('Stats fetch error:', e);
      } finally {
        if (mounted) setStatsLoading(false);
      }
    };
    fetchStats();
    return () => { mounted = false; };
  }, [period, selectedVendor]);

  if (loading || !dashboard) {
    return (
      <div className="min-h-full flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400 font-medium">Initialisation du Dashboard...</p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(1, ...chartData.map(d => d.count));
  const showPendingAlert = dashboard.pending_vendors > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">
            Vue d'ensemble <span className="text-yellow-400">Plateforme</span>
          </h1>
          <p className="text-gray-500 font-medium">Gestion centrale des opérations Krantos.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Vendeurs Totaux', value: dashboard.total_vendors, icon: <Users className="text-blue-400" />, trend: '+12%', up: true },
          { label: 'Leads Générés', value: dashboard.total_leads, icon: <TrendingUp className="text-yellow-400" />, trend: '+5%', up: true },
          { label: 'Conversion', value: `${dashboard.conversion_rate}%`, icon: <TrendingUp className="text-purple-400" />, trend: '-2%', up: false },
          { label: 'Revenus Est.', value: '8.4M', icon: <DollarSign className="text-green-400" />, trend: '+18%', up: true },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 rounded-[2.5rem] border-white/5 group hover:border-white/10 transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-2xl bg-white/5 group-hover:bg-white/10 transition-colors">
                {stat.icon}
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${stat.up ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {stat.trend}
              </div>
            </div>
            <p className="text-3xl font-black text-white tracking-tighter mb-1">{stat.value}</p>
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Chart Section */}
      <div className="glass-card p-8 rounded-[3rem] border-white/5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 relative z-10">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
              Évolution des Leads
              {statsLoading && <Loader2 size={16} className="animate-spin text-yellow-400" />}
            </h2>
            <p className="text-sm text-gray-500 font-medium">Analyse des flux de conversion par période.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Vendor Filter */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2 group focus-within:border-yellow-400/50 transition-all">
              <Users size={16} className="text-gray-500 group-focus-within:text-yellow-400" />
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-bold text-white cursor-pointer min-w-[120px]"
              >
                <option value="all" className="bg-[#0f0f13]">Tous les vendeurs</option>
                {dashboard.top_vendors.map(v => (
                  <option key={v.vendor_id} value={v.vendor_id} className="bg-[#0f0f13]">{v.name}</option>
                ))}
              </select>
            </div>

            {/* Period Filter */}
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/10">
              {[
                { id: 'day', label: 'Jour' },
                { id: 'week', label: 'Semaine' },
                { id: 'month', label: 'Mois' },
                { id: 'quarter', label: 'Trimestre' },
                { id: 'year', label: 'An' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    period === p.id 
                      ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' 
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="relative h-64 flex items-end gap-2 lg:gap-4 px-2 overflow-x-auto custom-scrollbar pb-4">
          <AnimatePresence mode="popLayout">
            {chartData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-bold text-sm">
                Aucune donnée disponible pour cette période.
              </div>
            ) : (
              chartData.map((d, i) => (
                <motion.div
                  key={d.label}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.5 }}
                  className="flex-1 min-w-[30px] flex flex-col items-center gap-3 group"
                >
                  <div className="relative w-full flex flex-col justify-end h-48">
                    <motion.div
                      className="w-full bg-gradient-to-t from-yellow-400 to-yellow-300 rounded-t-xl group-hover:from-yellow-300 group-hover:to-white transition-all shadow-lg shadow-yellow-400/5 relative"
                      style={{ height: `${(d.count / maxCount) * 100}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black px-2 py-1 rounded text-[10px] font-black shadow-xl pointer-events-none">
                        {d.count}
                      </div>
                    </motion.div>
                  </div>
                  <span className="text-[9px] font-black text-gray-500 group-hover:text-white transition-colors uppercase whitespace-nowrap rotate-45 lg:rotate-0 origin-left mt-2">
                    {d.label.split('-').reverse()[0]}
                  </span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Grid: Alerts & Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Alerts & Tasks */}
        <div className="space-y-6">
          <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest px-1">Alertes prioritaires</h3>
          {showPendingAlert && (
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-start gap-4 p-6 rounded-[2rem] bg-yellow-400/10 border border-yellow-400/20 text-yellow-100">
              <AlertTriangle className="text-yellow-400 shrink-0" />
              <div>
                <p className="font-black mb-1">Validations en attente</p>
                <p className="text-sm opacity-80 mb-4">{dashboard.pending_vendors} nouveaux vendeurs attendent votre validation pour commencer.</p>
                <Link to="/admin/vendors" className="px-4 py-2 rounded-xl bg-yellow-400 text-black text-xs font-black inline-flex items-center gap-2 hover:bg-yellow-500 transition-colors">
                  Voir la liste <ChevronRight size={14} />
                </Link>
              </div>
            </motion.div>
          )}
          <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10">
            <h4 className="font-black text-white mb-4">Objectifs du trimestre</h4>
            <div className="space-y-4">
              {[
                { label: 'Nouveaux Vendeurs', progress: 75, color: 'bg-blue-400' },
                { label: 'Conversion Leads', progress: 40, color: 'bg-yellow-400' },
                { label: 'Revenus Premium', progress: 90, color: 'bg-purple-400' },
              ].map(goal => (
                <div key={goal.label} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-gray-500">{goal.label}</span>
                    <span className="text-white">{goal.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${goal.progress}%` }} className={`h-full ${goal.color}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Vendors Table */}
        <div className="glass-card p-8 rounded-[2.5rem] border-white/5">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Performance Vendeurs</h3>
            <Link to="/admin/vendors" className="text-[10px] font-black uppercase text-yellow-400 hover:underline">Voir tout</Link>
          </div>
          <div className="space-y-1">
            {dashboard.top_vendors.slice(0, 5).map((v, idx) => (
              <div key={v.vendor_id} className="group flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-xs text-gray-500 group-hover:text-yellow-400 group-hover:bg-yellow-400/10">
                    0{idx + 1}
                  </div>
                  <div>
                    <p className="text-white font-bold group-hover:text-yellow-400 transition-colors">{v.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-black">{v.status}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-black tracking-tighter">{v.leads_count} Leads</p>
                  <p className="text-[10px] text-green-400 font-bold">{v.conversion_rate}% Conv.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChevronRight = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export default Admin;
