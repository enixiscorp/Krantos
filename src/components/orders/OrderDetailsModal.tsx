import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle, XCircle, Truck, Package, RefreshCcw } from 'lucide-react';
import type { OrderStatus, OrderWithDetails } from '../../hooks/useOrders';

const STATUS_UI: Record<
  OrderStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  pending: { label: 'En attente', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', icon: <Clock className="w-4 h-4" /> },
  confirmed: { label: 'Confirmée', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: <CheckCircle className="w-4 h-4" /> },
  processing: { label: 'Traitement', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', icon: <RefreshCcw className="w-4 h-4" /> },
  shipped: { label: 'Expédiée', color: 'text-cyan-400', bg: 'bg-cyan-400/10 border-cyan-400/20', icon: <Truck className="w-4 h-4" /> },
  delivered: { label: 'Livrée', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20', icon: <Package className="w-4 h-4" /> },
  cancelled: { label: 'Annulée', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: <XCircle className="w-4 h-4" /> },
};

export function OrderDetailsModal(props: {
  open: boolean;
  order: OrderWithDetails | null;
  onClose: () => void;
}) {
  const { open, order, onClose } = props;

  return (
    <AnimatePresence>
      {open && order && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="relative w-full max-w-3xl glass-card rounded-3xl border border-white/10 overflow-hidden"
          >
            <div className="flex items-start justify-between p-6 border-b border-white/5">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Commande</p>
                <h3 className="text-xl font-black text-white tracking-tight">{order.id}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {order.client_name} · {order.client_phone ?? '—'} · {order.client_location ?? '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-2xl border border-white/5 p-5">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">Articles</p>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {order.items.length === 0 ? (
                    <p className="text-gray-500 text-sm">Aucun article.</p>
                  ) : (
                    order.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <p className="text-white font-bold text-sm">{it.product_name}</p>
                          <p className="text-xs text-gray-500">{it.quantity} × {Number(it.price).toLocaleString('fr-FR')}</p>
                        </div>
                        <p className="text-sm font-black text-yellow-300">
                          {(Number(it.price) * Number(it.quantity)).toLocaleString('fr-FR')} {order.currency}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="glass-card rounded-2xl border border-white/5 p-5">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">Parcours de statut</p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {order.status_history.length === 0 ? (
                    <p className="text-gray-500 text-sm">Aucun historique.</p>
                  ) : (
                    order.status_history.map((h) => {
                      const ui = STATUS_UI[h.new_status];
                      return (
                        <div key={h.id} className="flex items-center justify-between py-2 border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${ui.bg} ${ui.color} text-xs font-black`}>
                              {ui.icon}
                              {ui.label}
                            </span>
                            <span className="text-xs text-gray-600">
                              {new Date(h.changed_at).toLocaleString('fr-FR')}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-600 font-mono">{h.changed_by?.slice(0, 8) ?? '—'}…</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Total</p>
                <p className="text-2xl font-black text-white">
                  {Number(order.amount_total).toLocaleString('fr-FR')} <span className="text-gray-500 text-lg">{order.currency}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Statut actuel :</span>
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${STATUS_UI[order.status].bg} ${STATUS_UI[order.status].color} text-xs font-black`}>
                  {STATUS_UI[order.status].icon}
                  {STATUS_UI[order.status].label}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

