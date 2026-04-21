// Statistiques détaillées (Edge Function admin-stats)
import { supabase } from '../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function getFunction<T>(name: string, searchParams: URLSearchParams): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');
  const qs = `?${searchParams.toString()}`;
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}${qs}`, {
    method: 'GET',
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return json as T;
}

export async function getStatsVendors() {
  const sp = new URLSearchParams({ type: 'vendors' });
  return getFunction<{
    total: number;
    active: number;
    suspended: number;
    new_vendors_last_7_days: number;
  }>('admin-stats', sp);
}

export async function getStatsLeads() {
  const sp = new URLSearchParams({ type: 'leads' });
  return getFunction<{
    total_leads: number;
    leads_per_day: Array<{ date: string; count: number }>;
    conversion_rate: number;
  }>('admin-stats', sp);
}

export async function getStatsProducts() {
  const sp = new URLSearchParams({ type: 'products' });
  return getFunction<{
    total_products: number;
    most_demanded: unknown[];
  }>('admin-stats', sp);
}
