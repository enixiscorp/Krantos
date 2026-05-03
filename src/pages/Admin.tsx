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
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Settings,
  Bell,
  CheckCircle2,
  XCircle,
  Smartphone
} from 'lucide-react';
import { getAdminDashboard, type AdminDashboardPayload } from '../services/adminService';
import { getStatsLeads, getStatsRevenue } from '../services/statsService';
import { supabase } from '../lib/supabase';

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
  const [chartData, setChartData] = useState<{ label: string; count: number }[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Filters
  const [period, setPeriod] = useState('month');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [chartType, setChartType] = useState<'leads' | 'revenue'>('leads');

  // Settings & PWA
  const [showSettings, setShowSettings] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const playNotificationSound = () => {
    if (!notificationsEnabled) return;
    const audio = new Audio('/sounds/notifications_Krantos.mp3');
    audio.play().catch(e => console.warn('Sound play prevented by browser:', e));
  };

  useEffect(() => {
    // Realtime Notifications for Admin
    const channel = supabase.channel('admin_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        playNotificationSound();
        toast.success(`Nouveau lead : ${payload.new.user_name} (${payload.new.total_power_needed} W)`, {
          icon: '🔔',
          duration: 10000,
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vendors' }, (payload) => {
        playNotificationSound();
        toast.info(`Nouveau vendeur inscrit : ${payload.new.name}`, {
          icon: '🏪',
          duration: 10000,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [notificationsEnabled]);

  useEffect(() => {
    // PWA Install Prompt Listener
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchDashboard = async () => {
      try {
        const [dash, roleInfo] = await Promise.all([
          getAdminDashboard(period),
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
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchDashboard();
    return () => { mounted = false; };
  }, [period]);

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const params = { 
          period, 
          vendor_id: selectedVendor === 'all' ? undefined : (selectedVendor || undefined)
        };
        
        const res = chartType === 'leads' 
          ? await getStatsLeads(params)
          : await getStatsRevenue(params);

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
  }, [period, selectedVendor, chartType]);

  const handleInstallPWA = () => {
    if (!installPrompt) {
      toast.info("L'application est déjà installée ou votre navigateur ne supporte pas l'installation directe. Utilisez le menu du navigateur (Installer).");
      return;
    }
    installPrompt.prompt();
    installPrompt.userChoice.then((choice: any) => {
      if (choice.outcome === 'accepted') {
        toast.success("Installation lancée !");
      }
      setInstallPrompt(null);
    });
  };

  if (loading || !dashboard) {
    return (
      <div className="min-h-full flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400 font-medium tracking-widest uppercase text-[10px] font-black">Initialisation Krantos OS...</p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(1, ...(chartData || []).map(d => d.count));
  
  // Real Dynamic Trends from API
  const trends = dashboard?.trends || {
    vendors: { val: '0%', up: true },
    leads: { val: '0%', up: true }
  };

  const showPendingAlert = (dashboard?.pending_vendors ?? 0) > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-1000">
      {/* Top Header with Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2">
            Vue d'ensemble <span className="text-yellow-400">Plateforme</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Système de gestion centrale v2.4.0</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleInstallPWA}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all group"
          >
            <Smartphone className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" />
            Installer App
          </button>
          
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-3 rounded-2xl border transition-all ${showSettings ? 'bg-yellow-400 border-yellow-400 text-black shadow-lg shadow-yellow-400/20' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
          >
            <Settings className={`w-5 h-5 ${showSettings ? 'animate-spin-slow' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-8 rounded-[2.5rem] border-yellow-400/20 bg-yellow-400/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-3">
                  <Settings size={16} className="text-yellow-400" />
                  Paramètres de Notifications
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white"><XCircle size={20} /></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white">Inscriptions Vendeurs</p>
                    <p className="text-[10px] text-gray-500 uppercase font-black">Alerte temps réel sur mobile/desktop</p>
                  </div>
                  <button 
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`w-12 h-6 rounded-full transition-all relative ${notificationsEnabled ? 'bg-yellow-400' : 'bg-gray-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notificationsEnabled ? 'left-7 shadow-lg shadow-black/50' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5 opacity-50 cursor-not-allowed">
                  <div>
                    <p className="text-sm font-bold text-white">Demandes Clients (Leads)</p>
                    <p className="text-[10px] text-gray-500 uppercase font-black">Rapport quotidien par email</p>
                  </div>
                  <CheckCircle2 className="text-yellow-400/30" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Vendeurs Totaux',
            value: dashboard.total_vendors,
            sub: `${dashboard.active_vendors} actifs`,
            icon: <Users className="text-blue-400" />,
            trend: trends.vendors
          },
          {
            label: 'Leads (Période)',
            value: dashboard.total_leads,
            sub: `${dashboard.total_leads_all ?? dashboard.total_leads} au total`,
            icon: <TrendingUp className="text-yellow-400" />,
            trend: trends.leads
          },
          {
            label: 'Taux Conversion',
            value: `${dashboard.conversion_rate.toFixed(1)}%`,
            sub: 'Leads convertîs / total',
            icon: <TrendingUp className="text-purple-400" />,
            trend: trends.conversion
          },
          {
            label: 'Revenus Période',
            value: `${(dashboard.total_revenue ?? 0).toLocaleString('fr-FR')} FCFA`,
            sub: `Total: ${(dashboard.total_revenue_all ?? dashboard.total_revenue ?? 0).toLocaleString('fr-FR')} FCFA`,
            icon: <DollarSign className="text-green-400" />,
            trend: trends.revenue
          },
        ].map((stat, i) => {
          const trend = stat.trend;
          return (
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
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${trend?.up ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {trend?.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {trend?.val ?? '0%'}
                </div>
              </div>
              <p className="text-3xl font-black text-white tracking-tighter mb-0.5">{stat.value}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{stat.label}</p>
              <p className="text-[9px] text-gray-600 font-medium mt-1">{stat.sub}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Main Chart Section */}
      <div className="glass-card p-8 rounded-[3rem] border-white/5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 relative z-10">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
              Flux d'Acquisition
              {statsLoading && <Loader2 size={16} className="animate-spin text-yellow-400" />}
            </h2>
            <div className="flex items-center gap-4 mt-1">
              <button 
                onClick={() => setChartType('leads')}
                className={`text-[10px] font-black uppercase tracking-widest transition-colors ${chartType === 'leads' ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
              >
                Volume Leads
              </button>
              <div className="w-1 h-1 rounded-full bg-white/10" />
              <button 
                onClick={() => setChartType('revenue')}
                className={`text-[10px] font-black uppercase tracking-widest transition-colors ${chartType === 'revenue' ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
              >
                Flux Revenus
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2 group focus-within:border-yellow-400/50 transition-all">
              <Users size={16} className="text-gray-500 group-focus-within:text-yellow-400" />
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-bold text-white cursor-pointer min-w-[120px]"
              >
                <option value="all" className="bg-[#0f0f13]">Tous les vendeurs</option>
                {dashboard?.top_vendors?.map(v => (
                  <option key={v.vendor_id} value={v.vendor_id} className="bg-[#0f0f13]">{v.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/10">
              {[
                { id: 'day',      label: 'Jour' },
                { id: 'week',     label: 'Semaine' },
                { id: 'month',    label: 'Mois' },
                { id: 'quarter',  label: 'Trimestre' },
                { id: 'semester', label: 'Semestre' },
                { id: 'year',     label: 'An' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
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

        <div className="relative h-64 flex items-end gap-2 lg:gap-4 px-2 overflow-x-auto custom-scrollbar pb-4">
          <AnimatePresence mode="popLayout">
            {!chartData || chartData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-bold text-sm">
                En attente de nouvelles interactions...
              </div>
            ) : (
              chartData?.map((d, i) => (
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
                      className="w-full bg-gradient-to-t from-yellow-400 to-yellow-300 rounded-t-xl group-hover:from-yellow-300 group-hover:to-white transition-all shadow-lg shadow-yellow-400/10 relative"
                      style={{ height: `${(d.count / maxCount) * 100}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black px-2 py-1 rounded text-[10px] font-black shadow-xl pointer-events-none whitespace-nowrap">
                        {chartType === 'revenue' ? `${d.count.toLocaleString()} FCFA` : d.count}
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

      {/* Bottom Grid: Activity & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Alertes & Priorités</h3>
            {showPendingAlert && <span className="px-2 py-1 rounded-lg bg-yellow-400 text-black text-[10px] font-black animate-pulse">ACTION REQUISE</span>}
          </div>
          
          {showPendingAlert && (
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-start gap-4 p-6 rounded-[2rem] bg-yellow-400/10 border border-yellow-400/20 text-yellow-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Users size={80} /></div>
              <AlertTriangle className="text-yellow-400 shrink-0" />
              <div className="relative z-10">
                <p className="font-black mb-1">Inscriptions en attente</p>
                <p className="text-sm opacity-80 mb-4">{dashboard.pending_vendors} nouveaux comptes à valider pour débloquer leur interface.</p>
                <Link to="/admin/vendors" className="px-5 py-2.5 rounded-xl bg-yellow-400 text-black text-xs font-black inline-flex items-center gap-2 hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-400/20">
                  Accéder aux validations
                </Link>
              </div>
            </motion.div>
          )}

          <div className="p-8 rounded-[3rem] bg-white/5 border border-white/10">
            <h4 className="font-black text-white mb-6 uppercase tracking-widest text-[10px]">Pipeline de conversion</h4>
            <div className="space-y-6">
              {[
                {
                  label: 'Acquisition Vendeurs',
                  progress: dashboard.goals.acquisition,
                  color: 'bg-blue-400',
                  sub: `${dashboard.goals.acquisition_count ?? 0} / ${dashboard.goals.acquisition_target ?? 100} vendeurs cette période`,
                },
                {
                  label: 'Taux de Validation',
                  progress: dashboard.goals.validation,
                  color: 'bg-green-400',
                  sub: `${dashboard.active_vendors} actifs sur ${dashboard.total_vendors} inscrits`,
                },
                {
                  label: 'Revenus Premium',
                  progress: dashboard.goals.premium,
                  color: 'bg-purple-400',
                  sub: `${(dashboard.goals.revenue_current ?? 0).toLocaleString('fr-FR')} / ${(dashboard.goals.revenue_target ?? 1000000).toLocaleString('fr-FR')} FCFA`,
                },
              ].map(goal => (
                <div key={goal.label} className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <div>
                      <span className="text-white block mb-0.5">{goal.label}</span>
                      <span className="text-gray-600 lowercase font-medium">{goal.sub}</span>
                    </div>
                    <span className="text-yellow-400">{goal.progress}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      key={`${goal.label}-${period}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${goal.progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`h-full ${goal.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card p-8 rounded-[3rem] border-white/5">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Classement Performance</h3>
            <Link to="/admin/vendors" className="text-[10px] font-black uppercase text-yellow-400 hover:underline">Full Report</Link>
          </div>
          <div className="space-y-1">
            {dashboard?.top_vendors?.slice(0, 6).map((v, idx) => (
              <div key={v.vendor_id} className="group flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-xs text-gray-500 group-hover:text-yellow-400 group-hover:bg-yellow-400/10 transition-all">
                    {(idx + 1).toString().padStart(2, '0')}
                  </div>
                  <div>
                    <p className="text-white font-bold group-hover:text-yellow-400 transition-colors">{v.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-black">{v.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-black tracking-tighter">{v.leads_count} Leads</p>
                  <p className={`text-[10px] font-bold ${v.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>{v.status.toUpperCase()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Leads Journal */}
      <div className="glass-card p-8 rounded-[3rem] border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
        <div className="flex items-center justify-between mb-8 px-2">
          <div>
            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Journal d'activité Lead</h3>
            <p className="text-[10px] text-gray-600 mt-1">Leads reçus sur la période sélectionnée</p>
          </div>
          <Link to="/admin/leads" className="text-[10px] font-black uppercase text-yellow-400 hover:underline">Flux complet</Link>
        </div>
        {(dashboard?.recent_leads?.length ?? 0) === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">Aucun lead sur cette période</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboard?.recent_leads?.slice(0, 8).map((l) => {
              const statusColors: Record<string, string> = {
                new: 'text-blue-400',
                contacted: 'text-yellow-400',
                converted: 'text-green-400',
                lost: 'text-red-400',
              };
              const statusLabels: Record<string, string> = {
                new: 'Nouveau',
                contacted: 'Contacté',
                converted: 'Converti',
                lost: 'Perdu',
              };
              return (
                <div key={l.id} className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between gap-4 group hover:border-white/10 hover:bg-white/[0.04] transition-all">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs font-black">
                      {l.user_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="px-2 py-1 rounded-lg bg-yellow-400/10 text-yellow-400 text-[10px] font-black uppercase">
                      {l.total_power_needed.toFixed(2)} kVA
                    </div>
                  </div>
                  <div>
                    <p className="text-white font-bold group-hover:text-yellow-400 transition-colors truncate">{l.user_name}</p>
                    {l.location && <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{l.location}</p>}
                    <p className="text-[10px] text-gray-600 mt-1">
                      {new Date(l.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-3 border-t border-white/5">
                    <span className={statusColors[l.status] ?? 'text-gray-500'}>{statusLabels[l.status] ?? l.status}</span>
                    <Link to="/admin/leads" className="text-yellow-400/50 hover:text-yellow-400 transition-colors">#ID-{l.id.slice(0, 4)}</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
