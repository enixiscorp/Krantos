// ============================================================
// Krantos Platform — Offline IndexedDB Layer
// Fournit un accès typé à la base de données locale (IndexedDB)
// via la librairie `idb` pour le mode hors-ligne.
// ============================================================

import { openDB, type IDBPDatabase } from 'idb';
import type { Vendor, Product } from './supabase';

// ---------------------------------------------------------------------------
// Schema & DB version
// ---------------------------------------------------------------------------

const DB_NAME = 'krantos-offline';
const DB_VERSION = 1;

export interface QueuedAction {
  id: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
  label?: string; // Description lisible pour l'UI
}

interface KrantosDB {
  offline_queue: {
    key: string;
    value: QueuedAction;
    indexes: { by_table: string };
  };
  vendors_cache: {
    key: string;
    value: Vendor;
  };
  products_cache: {
    key: string;
    value: Product;
  };
  admin_session: {
    key: string;
    value: { userId: string; email: string; role: string; cachedAt: string };
  };
}

// ---------------------------------------------------------------------------
// DB singleton
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase<KrantosDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<KrantosDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KrantosDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Offline action queue
        if (!db.objectStoreNames.contains('offline_queue')) {
          const qs = db.createObjectStore('offline_queue', { keyPath: 'id' });
          qs.createIndex('by_table', 'table');
        }

        // Vendors cache
        if (!db.objectStoreNames.contains('vendors_cache')) {
          db.createObjectStore('vendors_cache', { keyPath: 'id' });
        }

        // Products cache
        if (!db.objectStoreNames.contains('products_cache')) {
          db.createObjectStore('products_cache', { keyPath: 'id' });
        }

        // Admin session cache
        if (!db.objectStoreNames.contains('admin_session')) {
          db.createObjectStore('admin_session');
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Offline Queue helpers
// ---------------------------------------------------------------------------

export const offlineQueueStore = {
  async add(action: QueuedAction): Promise<void> {
    const db = await getDB();
    await db.put('offline_queue', action);
  },

  async getAll(): Promise<QueuedAction[]> {
    const db = await getDB();
    return db.getAll('offline_queue');
  },

  async remove(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('offline_queue', id);
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('offline_queue');
  },

  async count(): Promise<number> {
    const db = await getDB();
    return db.count('offline_queue');
  },
};

// ---------------------------------------------------------------------------
// Vendors Cache helpers
// ---------------------------------------------------------------------------

export const vendorsCacheStore = {
  async setAll(vendors: Vendor[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('vendors_cache', 'readwrite');
    await tx.store.clear();
    await Promise.all(vendors.map((v) => tx.store.put(v)));
    await tx.done;
  },

  async getAll(): Promise<Vendor[]> {
    const db = await getDB();
    return db.getAll('vendors_cache');
  },

  async count(): Promise<number> {
    const db = await getDB();
    return db.count('vendors_cache');
  },
};

// ---------------------------------------------------------------------------
// Products Cache helpers
// ---------------------------------------------------------------------------

export const productsCacheStore = {
  async setAll(products: Product[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('products_cache', 'readwrite');
    await tx.store.clear();
    await Promise.all(products.map((p) => tx.store.put(p)));
    await tx.done;
  },

  async getAll(): Promise<Product[]> {
    const db = await getDB();
    return db.getAll('products_cache');
  },

  async count(): Promise<number> {
    const db = await getDB();
    return db.count('products_cache');
  },
};

// ---------------------------------------------------------------------------
// Admin Session Cache helpers
// ---------------------------------------------------------------------------

export const adminSessionStore = {
  async set(session: { userId: string; email: string; role: string }): Promise<void> {
    const db = await getDB();
    await db.put('admin_session', { ...session, cachedAt: new Date().toISOString() }, 'current');
  },

  async get(): Promise<{ userId: string; email: string; role: string; cachedAt: string } | undefined> {
    const db = await getDB();
    return db.get('admin_session', 'current');
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.delete('admin_session', 'current');
  },
};
