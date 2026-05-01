// Services appelant les Edge Functions admin (super_admin requis côté backend)
import { supabase } from '../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function withAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');
  return session;
}

/** GET vers une edge function avec query string (invoke ne supporte pas l’URL complète) */
async function getFunction<T>(name: string, searchParams?: URLSearchParams): Promise<T> {
  const session = await withAuth();
  const qs = searchParams && [...searchParams].length > 0 ? `?${searchParams.toString()}` : '';
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}${qs}`, {
    method: 'GET',
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return json as T;
}

export interface AdminDashboardPayload {
  total_vendors: number;
  active_vendors: number;
  pending_vendors: number;
  total_products: number;
  total_leads: number;
  conversion_rate: number;
  trends: {
    vendors: { val: string; up: boolean };
    leads: { val: string; up: boolean };
  };
  top_vendors: Array<{
    vendor_id: string;
    name: string;
    status: string;
    category: string;
    leads_count: number;
    conversion_rate: number;
  }>;
  recent_leads: Array<{
    id: string;
    user_name: string;
    status: string;
    total_power_needed: number;
    created_at: string;
  }>;
}

export async function getAdminDashboard(period: string = 'day') {
  const sp = new URLSearchParams({ period });
  return getFunction<AdminDashboardPayload>('admin-dashboard', sp);
}

export async function getAdminVendorsList(params?: {
  status?: string;
  from?: string;
  to?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.from) sp.set('from', params.from);
  if (params?.to) sp.set('to', params.to);
  return getFunction<{ vendors: unknown[] }>('admin-vendors-list', sp);
}

export async function getAdminVendorDetail(vendorId: string) {
  const sp = new URLSearchParams({ vendor_id: vendorId });
  return getFunction<unknown>('admin-vendor-detail', sp);
}

export async function getAdminProducts(sort: 'price' | 'popularity' | 'vendor' = 'price') {
  const sp = new URLSearchParams({ sort });
  return getFunction<{ products: unknown[]; sort: string }>('admin-products', sp);
}

export async function getAdminLeadsList(params?: {
  vendor_id?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.vendor_id) sp.set('vendor_id', params.vendor_id);
  if (params?.status) sp.set('status', params.status);
  if (params?.from) sp.set('from', params.from);
  if (params?.to) sp.set('to', params.to);
  return getFunction<{ leads: unknown[] }>('admin-leads', sp);
}

export async function getAdminLeadDetail(leadId: string) {
  const sp = new URLSearchParams({ id: leadId });
  return getFunction<unknown>('admin-leads', sp);
}
