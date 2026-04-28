// ============================================================
// Krantos Platform — /admin/orders (Premium Orders)
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  ShoppingCart,
  PlusCircle,
  TrendingUp,
  Clock,
  BadgeCheck,
} from 'lucide-react';

import { useOrders, type OrderStatus } from '../hooks/useOrders';
import { OrderList } from '../components/orders/OrderList';
import { OrderDetailsModal } from '../components/orders/OrderDetailsModal';

const STATUS_OPTIONS: Array<{ id: OrderStatus; label: string }> = [
  { id: 'pending', label: 'En attente' },
  { id: 'confirmed', label: 'Confirmée' },
  { id: 'processing', label: 'Traitement' },
  { id: 'shipped', label: 'Expédiée' },
  { id: 'delivered', label: 'Livrée' },
  { id: 'cancelled', label: 'Annulée' },
];

const AdminOrders = () => {
  const { loading, orders, stats, selected, setSelected, loadOrders, loadOrderDetails, updateOrderStatus, deleteOrder } =
    useOrders();

  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const rows = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const openDetails = async (id: string) => {
    const data = await loadOrderDetails(id);
    if (data) setSelected(data);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette commande ?')) return;
    await deleteOrder(id);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="flex items-start gap-4">
          <Link
            to="/admin"
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <ShoppingCart className="w-9 h-9 text-yellow-400" />
              Commandes
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Gestion premium — historique automatique, statuts, détail complet.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as OrderStatus | 'all')}
            className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
          >
            <option value="all">Tous</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              toast.info('Création UI rapide: prochain sprint. (Hook createOrder prêt si besoin.)')
            }
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-400 text-gray-900 font-black text-sm hover:bg-yellow-500 transition-all"
          >
            <PlusCircle className="w-5 h-5" />
            Nouvelle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-3xl border-white/5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Total</p>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-black text-white mt-3">{stats.total}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-6 rounded-3xl border-white/5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-black uppercase tracking-widest">En attente</p>
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-black text-yellow-300 mt-3">{stats.pending}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 rounded-3xl border-white/5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Revenus</p>
            <BadgeCheck className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-black text-green-300 mt-3">{stats.revenue.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-gray-600 font-bold">XOF</p>
        </motion.div>
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
        </div>
      ) : (
        <>
          <OrderList rows={rows} onOpen={openDetails} onDelete={handleDelete} />
          <div className="mt-6 text-xs text-gray-600">
            Tip: le trigger SQL ajoute automatiquement l’historique et les notifications à chaque changement de statut.
          </div>
        </>
      )}

      <OrderDetailsModal
        open={Boolean(selected)}
        order={selected}
        onClose={() => setSelected(null)}
      />

      {selected && (
        <div className="mt-6 glass-card p-5 rounded-2xl border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-sm text-gray-400">
            <span className="text-white font-bold">Mettre à jour le statut</span> — {selected.id}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selected.status}
              onChange={(e) => {
                const next = e.target.value as OrderStatus;
                void updateOrderStatus(selected.id, next);
              }}
              className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all text-sm font-black"
            >
              Rafraîchir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;

