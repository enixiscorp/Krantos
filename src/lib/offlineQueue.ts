// ============================================================
// Krantos Platform — Offline Queue Service
// Gère la file d'attente des actions hors-ligne et leur
// synchronisation avec Supabase au retour en ligne.
// ============================================================

import { v4 as uuidv4 } from './uuid';
import { offlineQueueStore, type QueuedAction } from './offlineDB';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Enqueue an action (called when offline or as a safe fallback)
// ---------------------------------------------------------------------------

export async function enqueueAction(
  params: Omit<QueuedAction, 'id' | 'createdAt' | 'retries'>
): Promise<string> {
  const action: QueuedAction = {
    id: uuidv4(),
    ...params,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  await offlineQueueStore.add(action);
  return action.id;
}

// ---------------------------------------------------------------------------
// Process queue — Called when back online
// ---------------------------------------------------------------------------

export interface SyncResult {
  success: number;
  failed: number;
  failedActions: QueuedAction[];
}

export async function processQueue(): Promise<SyncResult> {
  const actions = await offlineQueueStore.getAll();
  let success = 0;
  const failedActions: QueuedAction[] = [];

  for (const action of actions) {
    try {
      await executeAction(action);
      await offlineQueueStore.remove(action.id);
      success++;
    } catch (err) {
      console.error(`[OfflineQueue] Failed to sync action ${action.id}:`, err);
      // Increment retries
      await offlineQueueStore.add({ ...action, retries: action.retries + 1 });
      await offlineQueueStore.remove(action.id);
      failedActions.push(action);
    }
  }

  return { success, failed: failedActions.length, failedActions };
}

// ---------------------------------------------------------------------------
// Execute a single queued action against Supabase
// ---------------------------------------------------------------------------

async function executeAction(action: QueuedAction): Promise<void> {
  // Special case: leads offline sync (legacy localStorage migration)
  if (action.table === 'leads_with_appliances') {
    await syncLeadWithAppliances(action.payload);
    return;
  }

  // Special case: contract renewal
  if (action.table === 'contracts_renewal') {
    const { vendorId, newEndDate } = action.payload as { vendorId: string; newEndDate: string };
    const { error } = await supabase
      .from('vendors')
      .update({ status: 'active', contract_end_date: newEndDate })
      .eq('id', vendorId);
    if (error) throw new Error(error.message);
    // Reactivate products
    const { error: prodError } = await supabase
      .from('products')
      .update({ is_active: true })
      .eq('vendor_id', vendorId);
    if (prodError) throw new Error(prodError.message);
    return;
  }

  // Standard CRUD operations
  switch (action.type) {
    case 'INSERT': {
      const { error } = await supabase.from(action.table).insert(action.payload);
      if (error) throw new Error(error.message);
      break;
    }
    case 'UPDATE': {
      const { id, ...rest } = action.payload as { id: string; [key: string]: unknown };
      const { error } = await supabase.from(action.table).update(rest).eq('id', id);
      if (error) throw new Error(error.message);
      break;
    }
    case 'DELETE': {
      const { id } = action.payload as { id: string };
      const { error } = await supabase.from(action.table).delete().eq('id', id);
      if (error) throw new Error(error.message);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Sync a lead + its appliances (special case from CalculatePower offline)
// ---------------------------------------------------------------------------

async function syncLeadWithAppliances(payload: Record<string, unknown>): Promise<void> {
  const { lead, appliances } = payload as {
    lead: Record<string, unknown>;
    appliances: Record<string, unknown>[];
  };

  const { data: leadData, error: leadError } = await supabase
    .from('leads')
    .insert(lead)
    .select('id')
    .single();

  if (leadError || !leadData) throw new Error(leadError?.message ?? 'Lead insert failed');

  const appsWithLeadId = appliances.map((a) => ({ ...a, lead_id: leadData.id }));
  const { error: appsError } = await supabase.from('appliances_input').insert(appsWithLeadId);
  if (appsError) throw new Error(appsError.message);
}

// ---------------------------------------------------------------------------
// Get pending count
// ---------------------------------------------------------------------------

export async function getPendingCount(): Promise<number> {
  return offlineQueueStore.count();
}
