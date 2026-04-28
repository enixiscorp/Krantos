import { useCallback, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type OrderRow = {
  id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_location: string | null;
  amount_total: number;
  currency: string;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  price: number;
  created_at: string;
};

export type OrderStatusHistoryRow = {
  id: string;
  order_id: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
};

export type OrderWithDetails = OrderRow & {
  items: OrderItemRow[];
  status_history: OrderStatusHistoryRow[];
};

export function useOrders() {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selected, setSelected] = useState<OrderWithDetails | null>(null);

  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const revenue = orders.reduce((acc, o) => acc + Number(o.amount_total || 0), 0);
    return { total, pending, revenue };
  }, [orders]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders((data ?? []) as OrderRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de charger les commandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOrderDetails = useCallback(async (orderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders_with_details')
        .select('*')
        .eq('id', orderId)
        .single();
      if (error) throw error;
      setSelected(data as unknown as OrderWithDetails);
      return data as unknown as OrderWithDetails;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de charger le détail de la commande.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrder = useCallback(
    async (payload: {
      client_name: string;
      client_phone?: string | null;
      client_email?: string | null;
      client_location?: string | null;
      notes?: string | null;
      currency?: string;
      items: Array<{ product_name: string; quantity: number; price: number }>;
    }) => {
      setLoading(true);
      try {
        const amount_total = payload.items.reduce(
          (acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 0),
          0
        );
        const { data: created, error: createError } = await supabase
          .from('orders')
          .insert({
            client_name: payload.client_name,
            client_phone: payload.client_phone ?? null,
            client_email: payload.client_email ?? null,
            client_location: payload.client_location ?? null,
            notes: payload.notes ?? null,
            currency: payload.currency ?? 'XOF',
            amount_total,
            status: 'pending',
          })
          .select('*')
          .single();
        if (createError) throw createError;
        const order = created as unknown as OrderRow;

        if (payload.items.length > 0) {
          const { error: itemsError } = await supabase.from('order_items').insert(
            payload.items.map((it) => ({
              order_id: order.id,
              product_name: it.product_name,
              quantity: it.quantity,
              price: it.price,
            }))
          );
          if (itemsError) throw itemsError;
        }

        // Notification “commande créée”
        await supabase.from('admin_notifications').insert({
          type: 'order_created',
          title: 'Nouvelle commande',
          message: `Commande ${order.id} créée pour ${order.client_name}`,
          order_id: order.id,
        });

        toast.success('Commande créée.');
        await loadOrders();
        return order;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Impossible de créer la commande.');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [loadOrders]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      setLoading(true);
      try {
        const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
        if (error) throw error;
        toast.success('Statut mis à jour.');
        await loadOrders();
        if (selected?.id === orderId) {
          await loadOrderDetails(orderId);
        }
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Impossible de mettre à jour le statut.');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadOrders, loadOrderDetails, selected?.id]
  );

  const deleteOrder = useCallback(
    async (orderId: string) => {
      setLoading(true);
      try {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) throw error;
        toast.success('Commande supprimée.');
        if (selected?.id === orderId) setSelected(null);
        await loadOrders();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Impossible de supprimer la commande.');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadOrders, selected?.id]
  );

  return {
    loading,
    orders,
    stats,
    selected,
    setSelected,
    loadOrders,
    loadOrderDetails,
    createOrder,
    updateOrderStatus,
    deleteOrder,
  };
}

