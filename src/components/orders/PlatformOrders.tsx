import { motion } from 'framer-motion';
import { BadgeCheck, Coins, Hourglass, Loader2, PackageCheck, TrendingUp } from 'lucide-react';
import type { CommissionState, PlatformOrder } from '../../hooks/usePlatformOrders';

const COMMISSION_BADGE: Record<CommissionState, { label: string; cls: string }> = {
  confirmed: { label: 'Perçue', cls: 'bg-green-400/10 border-green-400/20 text-green-300' },
  pending: { label: 'En vérification', cls: 'bg-yellow-400/10 border-yellow-400/20 text-yellow-300' },
  estimated: { label: 'Estimée', cls: 'bg-white/5 border-white/10 text-gray-400' },
};

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

export function PlatformOrders(props: {
  loading: boolean;
  orders: PlatformOrder[];
  stats: { count: number; revenue: number; commissionsConfirmed: number; commissionsPending: number };
}) {
  const { loading, orders, stats } = props;

  const cards = [
    { label: 'Commandes effectuées', value: stats.count.toLocaleString('fr-FR'), icon: <PackageCheck className="w-5 h-5 text-blue-400" />, cls: 'text-white' },
    { label: 'CA via la plateforme', value: fcfa(stats.revenue), icon: <TrendingUp className="w-5 h-5 text-yellow-400" />, cls: 'text-yellow-300' },
    { label: 'Commissions perçues', value: fcfa(stats.commissionsConfirmed), icon: <BadgeCheck className="w-5 h-5 text-green-400" />, cls: 'text-green-300' },
    { label: 'Commissions à percevoir', value: fcfa(stats.commissionsPending), icon: <Hourglass className="w-5 h-5 text-orange-400" />, cls: 'text-orange-300' },
  ];

  return (
    <section className="mb-14">
      <div className="mb-5">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Coins className="w-5 h-5 text-yellow-400" />
          Commandes effectuées via la plateforme
        </h2>
        <p className="text-gray-500 text-xs mt-1">
          Prospects convertis : coût de l'équipement vendu et commission Krantos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5 rounded-3xl border-white/5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{c.label}</p>
              {c.icon}
            </div>
            <p className={`text-2xl font-black mt-3 break-words ${c.cls}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-card rounded-3xl border border-white/5 p-8 text-center text-gray-500 text-sm">
          Aucun prospect converti pour le moment.
        </div>
      ) : (
        <div className="glass-card rounded-3xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase border-b border-white/5">
                  <th className="p-4">Client</th>
                  <th className="p-4">Vendeur</th>
                  <th className="p-4">Équipement</th>
                  <th className="p-4 text-right">Montant commande</th>
                  <th className="p-4 text-right">Commission</th>
                  <th className="p-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const badge = COMMISSION_BADGE[o.commissionState];
                  return (
                    <tr key={o.leadId} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="p-4">
                        <div className="font-bold text-white">{o.clientName}</div>
                        <div className="text-xs text-gray-500">{[o.clientPhone, o.location].filter(Boolean).join(' · ') || '—'}</div>
                      </td>
                      <td className="p-4 text-gray-300">{o.vendorName}</td>
                      <td className="p-4 text-gray-300">{o.productName ?? '—'}</td>
                      <td className="p-4 text-right font-black text-yellow-300 whitespace-nowrap">{fcfa(o.orderAmount)}</td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="font-black text-green-300">{fcfa(o.commissionAmount)}</div>
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <span className="text-[10px] text-gray-500">{o.commissionRate}%</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-black ${badge.cls}`}>{badge.label}</span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-400 whitespace-nowrap">{day(o.date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
