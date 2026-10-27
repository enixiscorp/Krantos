// ============================================================
// Krantos Platform - Orders made through the platform
// ============================================================
// A lead with status "converted" is a completed order. Its order amount
// (equipment cost) is derived from the commission record:
//   order amount = commission amount × 100 / commission rate
// (the vendor declares the sale amount and the commission is computed from it).
// Without a commission record, the chosen product's price is used and the
// commission is estimated from the vendor's current rate.

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export type CommissionState = 'confirmed' | 'pending' | 'estimated';

export interface PlatformOrder {
  leadId: string;
  clientName: string;
  clientPhone: string | null;
  location: string | null;
  vendorName: string;
  productName: string | null;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  commissionState: CommissionState;
  date: string;
}

export interface LeadRow {
  id: string;
  user_name: string;
  user_phone: string | null;
  location: string | null;
  created_at: string;
  vendors: { name: string; commission_rate: number | null } | null;
  products: { name: string; price: number | null } | null;
}

export interface CommissionRow {
  lead_id: string;
  amount: number | null;
  commission_rate_applied: number | null;
  status: 'confirmed' | 'pending_verification' | 'rejected' | 'rate_change';
  created_at: string;
}

export function usePlatformOrders() {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<PlatformOrder[]>([]);

  const loadPlatformOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id, user_name, user_phone, location, created_at,
          vendors:vendor_id ( name, commission_rate ),
          products:recommended_product_id ( name, price )
        `)
        .eq('status', 'converted')
        .order('created_at', { ascending: false });
      if (leadsError) throw leadsError;

      const leadRows = (leads ?? []) as unknown as LeadRow[];
      const ids = leadRows.map((l) => l.id);

      let commissions: CommissionRow[] = [];
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from('commission_records')
          .select('lead_id, amount, commission_rate_applied, status, created_at')
          .eq('type', 'conversion')
          .in('lead_id', ids)
          .order('created_at', { ascending: false });
        if (error) throw error;
        commissions = (data ?? []) as CommissionRow[];
      }

      // Latest non-rejected commission per lead
      const byLead = new Map<string, CommissionRow>();
      for (const c of commissions) {
        if (c.status === 'rejected' || byLead.has(c.lead_id)) continue;
        byLead.set(c.lead_id, c);
      }

      setOrders(leadRows.map((l) => toPlatformOrder(l, byLead.get(l.id))));
    } catch (err: any) {
      console.error('loadPlatformOrders failed:', err);
      toast.error(`Chargement des commandes plateforme impossible : ${err?.message ?? 'erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const stats = useMemo(() => {
    const sum = (list: PlatformOrder[], key: 'orderAmount' | 'commissionAmount') =>
      list.reduce((acc, o) => acc + o[key], 0);
    return {
      count: orders.length,
      revenue: sum(orders, 'orderAmount'),
      commissionsConfirmed: sum(orders.filter((o) => o.commissionState === 'confirmed'), 'commissionAmount'),
      commissionsPending: sum(orders.filter((o) => o.commissionState !== 'confirmed'), 'commissionAmount'),
    };
  }, [orders]);

  return { loading, orders, stats, loadPlatformOrders };
}

export function toPlatformOrder(lead: LeadRow, commission?: CommissionRow): PlatformOrder {
  const base = {
    leadId: lead.id,
    clientName: lead.user_name,
    clientPhone: lead.user_phone,
    location: lead.location,
    vendorName: lead.vendors?.name ?? 'Vendeur inconnu',
    productName: lead.products?.name ?? null,
  };
  const productPrice = Number(lead.products?.price ?? 0);

  if (commission) {
    const rate = Number(commission.commission_rate_applied ?? 0);
    const amount = Number(commission.amount ?? 0);
    return {
      ...base,
      orderAmount: rate > 0 ? Math.round((amount * 100) / rate) : productPrice,
      commissionRate: rate,
      commissionAmount: amount,
      commissionState: commission.status === 'confirmed' ? 'confirmed' : 'pending',
      date: commission.created_at,
    };
  }

  const rate = Number(lead.vendors?.commission_rate ?? 0);
  return {
    ...base,
    orderAmount: productPrice,
    commissionRate: rate,
    commissionAmount: Math.round((productPrice * rate) / 100),
    commissionState: 'estimated',
    date: lead.created_at,
  };
}
