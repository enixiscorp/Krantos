import { motion } from 'framer-motion';
import { Eye, Trash2 } from 'lucide-react';
import type { OrderRow, OrderStatus } from '../../hooks/useOrders';

const STATUS_BADGE: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: 'En attente', cls: 'bg-yellow-400/10 border-yellow-400/20 text-yellow-300' },
  confirmed: { label: 'Confirmée', cls: 'bg-blue-400/10 border-blue-400/20 text-blue-300' },
  processing: { label: 'Traitement', cls: 'bg-purple-400/10 border-purple-400/20 text-purple-300' },
  shipped: { label: 'Expédiée', cls: 'bg-cyan-400/10 border-cyan-400/20 text-cyan-300' },
  delivered: { label: 'Livrée', cls: 'bg-green-400/10 border-green-400/20 text-green-300' },
  cancelled: { label: 'Annulée', cls: 'bg-red-400/10 border-red-400/20 text-red-300' },
};

export function OrderList(props: {
  rows: OrderRow[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { rows, onOpen, onDelete } = props;

  return (
    <div className="glass-card rounded-3xl border border-white/5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase border-b border-white/5">
              <th className="p-4">Client</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Statut</th>
              <th className="p-4">Montant</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o, idx) => {
              const badge = STATUS_BADGE[o.status];
              return (
                <motion.tr
                  key={o.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(0.2, idx * 0.01) }}
                  className="border-b border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="p-4">
                    <div className="font-bold text-white">{o.client_name}</div>
                    <div className="text-xs text-gray-500">{o.client_location ?? '—'}</div>
                  </td>
                  <td className="p-4 text-gray-400">
                    <div>{o.client_phone ?? '—'}</div>
                    <div className="text-xs">{o.client_email ?? '—'}</div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-black ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="p-4 font-black text-yellow-300">
                    {Number(o.amount_total).toLocaleString('fr-FR')} {o.currency}
                  </td>
                  <td className="p-4 text-gray-500 text-xs">
                    {new Date(o.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onOpen(o.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <Eye className="w-4 h-4" />
                        Détail
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(o.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:text-white hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        Suppr.
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="p-10 text-center text-gray-500 text-sm">Aucune commande.</div>
      )}
    </div>
  );
}

