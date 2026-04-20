// ============================================================
// Krantos Platform — CommissionService
// Requirements: C1.2, C2.1, C2.2, C2.3, C3.3
// ============================================================

import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'annual';

export interface CommissionRecord {
  id: string;
  vendor_id: string;
  lead_id: string | null;
  commission_rate_applied: number;
  amount: number | null;
  status: 'pending_verification' | 'confirmed' | 'rejected' | 'rate_change';
  type: 'conversion' | 'rate_change';
  notes: string | null;
  created_at: string;
}

export interface CommissionSummary {
  vendorId: string;
  period: TimePeriod;
  startDate: Date;
  endDate: Date;
  totalConversions: number;
  totalConfirmed: number;
  totalPending: number;
}

export interface CommissionFilters {
  status?: CommissionRecord['status'];
  period?: TimePeriod;
  page?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the Monday of the current week (ISO week starts on Monday).
 */
function getMondayOfCurrentWeek(now: Date): Date {
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day; // adjust so Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Computes the [startDate, endDate] range for a given TimePeriod.
 * endDate is always today at 23:59:59.
 */
export function getDateRangeForPeriod(period: TimePeriod): { startDate: Date; endDate: Date } {
  const now = new Date();

  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;

  switch (period) {
    case 'daily': {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case 'weekly': {
      startDate = getMondayOfCurrentWeek(now);
      break;
    }
    case 'monthly': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
    }
    case 'quarterly': {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
      break;
    }
    case 'biannual': {
      const semesterStartMonth = now.getMonth() < 6 ? 0 : 6;
      startDate = new Date(now.getFullYear(), semesterStartMonth, 1, 0, 0, 0, 0);
      break;
    }
    case 'annual': {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      break;
    }
  }

  return { startDate, endDate };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Validates and sets the commission rate for a vendor.
 * Rate must be a multiple of 5 between 5 and 100 (inclusive).
 * Requirements: C1.2
 */
export async function setCommissionRate(vendorId: string, rate: number): Promise<void> {
  if (rate < 5 || rate > 100 || rate % 5 !== 0) {
    throw new Error('Le taux de commission doit être un multiple de 5 compris entre 5 et 100.');
  }

  // Update vendor commission_rate
  const { error: updateError } = await supabase
    .from('vendors')
    .update({ commission_rate: rate })
    .eq('id', vendorId);

  if (updateError) {
    throw new Error(`Erreur lors de la mise à jour du taux de commission : ${updateError.message}`);
  }

  // Insert rate_change record
  const { error: insertError } = await supabase.from('commission_records').insert({
    vendor_id: vendorId,
    lead_id: null,
    commission_rate_applied: rate,
    amount: null,
    status: 'rate_change',
    type: 'rate_change',
  });

  if (insertError) {
    throw new Error(
      `Erreur lors de l'enregistrement du changement de taux : ${insertError.message}`
    );
  }
}

/**
 * Records a commission for a converted lead.
 * Requirements: C2.1, C2.2
 */
export async function recordConversion(
  leadId: string,
  vendorId: string,
  saleAmount: number
): Promise<CommissionRecord> {
  // Fetch vendor's current commission rate
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('commission_rate')
    .eq('id', vendorId)
    .single();

  if (vendorError || !vendor) {
    throw new Error(`Erreur lors de la récupération du vendeur : ${vendorError?.message ?? 'Vendeur introuvable'}`);
  }

  const rate: number = vendor.commission_rate ?? 0;
  const amount = (saleAmount * rate) / 100;

  const { data, error: insertError } = await supabase
    .from('commission_records')
    .insert({
      vendor_id: vendorId,
      lead_id: leadId,
      commission_rate_applied: rate,
      amount,
      status: 'pending_verification',
      type: 'conversion',
    })
    .select()
    .single();

  if (insertError || !data) {
    throw new Error(
      `Erreur lors de l'enregistrement de la conversion : ${insertError?.message ?? 'Données manquantes'}`
    );
  }

  return data as CommissionRecord;
}

/**
 * Returns an aggregated commission summary for a vendor over a given period.
 * Requirements: C3.3
 */
export async function getCommissionSummary(
  vendorId: string,
  period: TimePeriod
): Promise<CommissionSummary> {
  const { startDate, endDate } = getDateRangeForPeriod(period);

  const { data, error } = await supabase
    .from('commission_records')
    .select('status, amount')
    .eq('vendor_id', vendorId)
    .eq('type', 'conversion')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error) {
    throw new Error(`Erreur lors de la récupération du résumé des commissions : ${error.message}`);
  }

  const records = (data ?? []) as { status: string; amount: number | null }[];

  const totalConversions = records.length;

  const totalConfirmed = records
    .filter((r) => r.status === 'confirmed')
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const totalPending = records
    .filter((r) => r.status === 'pending_verification')
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return {
    vendorId,
    period,
    startDate,
    endDate,
    totalConversions,
    totalConfirmed,
    totalPending,
  };
}

/**
 * Returns a paginated commission history for a vendor with optional filters.
 * Requirements: C3.3
 */
export async function getCommissionHistory(
  vendorId: string,
  filters: CommissionFilters
): Promise<CommissionRecord[]> {
  const page = filters.page ?? 1;
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('commission_records')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.period) {
    const { startDate, endDate } = getDateRangeForPeriod(filters.period);
    query = query
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Erreur lors de la récupération de l'historique des commissions : ${error.message}`
    );
  }

  return (data ?? []) as CommissionRecord[];
}

/**
 * Confirms a commission record (marks it as confirmed).
 * Requirements: C2.3
 */
export async function confirmCommission(recordId: string): Promise<void> {
  const { error } = await supabase
    .from('commission_records')
    .update({ status: 'confirmed' })
    .eq('id', recordId);

  if (error) {
    throw new Error(`Erreur lors de la confirmation de la commission : ${error.message}`);
  }
}

/**
 * Rejects a commission record with optional notes.
 * Requirements: C2.3
 */
export async function rejectCommission(recordId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('commission_records')
    .update({ status: 'rejected', notes })
    .eq('id', recordId);

  if (error) {
    throw new Error(`Erreur lors du rejet de la commission : ${error.message}`);
  }
}
