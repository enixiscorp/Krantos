// ============================================================
// Krantos Platform — useOnlineSync Hook
// Gère l'état de connexion et déclenche la synchronisation
// automatique au retour en ligne.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { processQueue, getPendingCount } from '../lib/offlineQueue';
import { vendorsCacheStore, productsCacheStore } from '../lib/offlineDB';
import { supabase } from '../lib/supabase';
import type { Vendor, Product } from '../lib/supabase';
import { useConnection } from '../context/ConnectionContext';

export interface OnlineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

export function useOnlineSync(): OnlineSyncState {
  const { isOnline } = useConnection();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  // Refresh cache in background when online
  const refreshCaches = useCallback(async () => {
    try {
      // Cache active vendors
      const { data: vendors } = await supabase
        .from('vendors')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true });
      if (vendors && vendors.length > 0) {
        await vendorsCacheStore.setAll(vendors as Vendor[]);
      }

      // Cache active products (with basic fields for offline recommendation)
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (products && products.length > 0) {
        await productsCacheStore.setAll(products as Product[]);
      }
    } catch (err) {
      // Silent fail — cache refresh is best-effort
      console.warn('[OnlineSync] Cache refresh failed:', err);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline) {
      toast.error('Vous êtes hors-ligne. Synchronisation impossible.');
      return;
    }
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await processQueue();
      await refreshPendingCount();

      if (result.success > 0) {
        toast.success(
          `✅ ${result.success} action${result.success > 1 ? 's' : ''} synchronisée${result.success > 1 ? 's' : ''} avec succès.`
        );
      }
      if (result.failed > 0) {
        toast.error(`⚠️ ${result.failed} action${result.failed > 1 ? 's' : ''} n'ont pas pu être synchronisée${result.failed > 1 ? 's' : ''}.`);
      }
      if (result.success === 0 && result.failed === 0) {
        toast.info('Aucune action en attente.');
      }
    } catch (err) {
      toast.error('Erreur lors de la synchronisation.');
      console.error('[OnlineSync] Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refreshPendingCount]);

  useEffect(() => {
    const handleSync = async () => {
      if (isOnline) {
        // toast.success('🌐 En ligne. Synchronisation en cours...', { duration: 3000 });
        setIsSyncing(true);
        try {
          const result = await processQueue();
          await refreshPendingCount();
          if (result.success > 0) {
            toast.success(`✅ ${result.success} action${result.success > 1 ? 's' : ''} synchronisée${result.success > 1 ? 's' : ''}.`);
          }
        } catch (err) {
          console.error('[OnlineSync] Auto-sync failed:', err);
        } finally {
          setIsSyncing(false);
        }
        refreshCaches();
      } else {
        // toast.warning('📵 Hors-ligne. Vos actions seront sauvegardées localement.', { duration: 4000 });
      }
    };

    handleSync();
  }, [isOnline, refreshPendingCount, refreshCaches]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  return { isOnline, pendingCount, isSyncing, syncNow, refreshPendingCount };
}
