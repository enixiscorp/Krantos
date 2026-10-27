import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

import { toPlatformOrder, type LeadRow } from './usePlatformOrders';

const lead: LeadRow = {
  id: 'lead-1',
  user_name: 'Kofi Mensah',
  user_phone: '90123456',
  location: 'Lomé',
  created_at: '2026-10-01T10:00:00Z',
  vendors: { name: 'ZE BE LIGHT', commission_rate: 10 },
  products: { name: 'Groupe 5 kVA', price: 850000 },
};

describe('toPlatformOrder', () => {
  it('déduit le montant de la commande depuis la commission (montant × 100 / taux)', () => {
    const order = toPlatformOrder(lead, {
      lead_id: 'lead-1',
      amount: 90000,
      commission_rate_applied: 10,
      status: 'confirmed',
      created_at: '2026-10-05T10:00:00Z',
    });
    expect(order.orderAmount).toBe(900000);
    expect(order.commissionAmount).toBe(90000);
    expect(order.commissionState).toBe('confirmed');
    expect(order.date).toBe('2026-10-05T10:00:00Z');
  });

  it('commission déclarée par le vendeur → en vérification', () => {
    const order = toPlatformOrder(lead, {
      lead_id: 'lead-1',
      amount: 50000,
      commission_rate_applied: 5,
      status: 'pending_verification',
      created_at: '2026-10-05T10:00:00Z',
    });
    expect(order.orderAmount).toBe(1000000);
    expect(order.commissionState).toBe('pending');
  });

  it('sans commission enregistrée : prix du produit et commission estimée', () => {
    const order = toPlatformOrder(lead);
    expect(order.orderAmount).toBe(850000);
    expect(order.commissionAmount).toBe(85000);
    expect(order.commissionState).toBe('estimated');
  });

  it('taux à 0 : utilise le prix du produit (pas de division par zéro)', () => {
    const order = toPlatformOrder(lead, {
      lead_id: 'lead-1',
      amount: 0,
      commission_rate_applied: 0,
      status: 'confirmed',
      created_at: '2026-10-05T10:00:00Z',
    });
    expect(order.orderAmount).toBe(850000);
  });
});
