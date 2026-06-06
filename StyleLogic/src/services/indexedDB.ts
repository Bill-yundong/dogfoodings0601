import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type {
  ClothingItem,
  OutfitPreset,
  WardrobeSnapshot,
  PersonalColorProfile,
  CartItem,
  SyncEvent,
} from '../types';

const DB_NAME = 'stylelogic_db';
const DB_VERSION = 1;

const STORES = {
  WARDROBE_ITEMS: 'wardrobe_items',
  OUTFIT_PRESETS: 'outfit_presets',
  SNAPSHOTS: 'snapshots',
  PERSONAL_PROFILES: 'personal_profiles',
  CART_ITEMS: 'cart_items',
  SYNC_EVENTS: 'sync_events',
} as const;

let dbInstance: IDBPDatabase | null = null;

export const initDB = async (): Promise<IDBPDatabase> => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.WARDROBE_ITEMS)) {
        const itemStore = db.createObjectStore(STORES.WARDROBE_ITEMS, {
          keyPath: 'id',
        });
        itemStore.createIndex('category', 'category');
        itemStore.createIndex('addedAt', 'addedToWardrobeAt');
        itemStore.createIndex('isOwned', 'isOwned');
      }

      if (!db.objectStoreNames.contains(STORES.OUTFIT_PRESETS)) {
        const presetStore = db.createObjectStore(STORES.OUTFIT_PRESETS, {
          keyPath: 'id',
        });
        presetStore.createIndex('savedAt', 'savedAt');
        presetStore.createIndex('isFavorite', 'isFavorite');
        presetStore.createIndex('syncStatus', 'syncStatus');
      }

      if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
        const snapshotStore = db.createObjectStore(STORES.SNAPSHOTS, {
          keyPath: 'id',
        });
        snapshotStore.createIndex('timestamp', 'timestamp');
        snapshotStore.createIndex('version', 'version');
      }

      if (!db.objectStoreNames.contains(STORES.PERSONAL_PROFILES)) {
        db.createObjectStore(STORES.PERSONAL_PROFILES, {
          keyPath: 'id',
        });
      }

      if (!db.objectStoreNames.contains(STORES.CART_ITEMS)) {
        const cartStore = db.createObjectStore(STORES.CART_ITEMS, {
          keyPath: 'productId',
        });
        cartStore.createIndex('addedAt', 'addedAt');
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_EVENTS)) {
        const syncStore = db.createObjectStore(STORES.SYNC_EVENTS, {
          keyPath: 'timestamp',
        });
        syncStore.createIndex('source', 'source');
        syncStore.createIndex('type', 'type');
      }
    },
  });

  return dbInstance;
};

export const closeDB = (): void => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};

export const wardrobeStore = {
  async getAll(): Promise<ClothingItem[]> {
    const db = await initDB();
    return db.getAll(STORES.WARDROBE_ITEMS);
  },

  async getById(id: string): Promise<ClothingItem | undefined> {
    const db = await initDB();
    return db.get(STORES.WARDROBE_ITEMS, id);
  },

  async add(item: ClothingItem): Promise<string> {
    const db = await initDB();
    const key = await db.add(STORES.WARDROBE_ITEMS, item);
    await addSyncEvent('item_added', item as unknown as Record<string, unknown>, 'fitting');
    return key as string;
  },

  async update(item: ClothingItem): Promise<void> {
    const db = await initDB();
    await db.put(STORES.WARDROBE_ITEMS, item);
    await addSyncEvent('item_updated', item as unknown as Record<string, unknown>, 'fitting');
  },

  async remove(id: string): Promise<void> {
    const db = await initDB();
    await db.delete(STORES.WARDROBE_ITEMS, id);
    await addSyncEvent('item_removed', { id } as Record<string, unknown>, 'fitting');
  },

  async clear(): Promise<void> {
    const db = await initDB();
    await db.clear(STORES.WARDROBE_ITEMS);
  },

  async bulkAdd(items: ClothingItem[]): Promise<void> {
    const db = await initDB();
    const tx = db.transaction(STORES.WARDROBE_ITEMS, 'readwrite');
    await Promise.all(items.map((item) => tx.store.add(item)));
    await tx.done;
  },
};

export const outfitPresetStore = {
  async getAll(): Promise<OutfitPreset[]> {
    const db = await initDB();
    return db.getAll(STORES.OUTFIT_PRESETS);
  },

  async getById(id: string): Promise<OutfitPreset | undefined> {
    const db = await initDB();
    return db.get(STORES.OUTFIT_PRESETS, id);
  },

  async getFavorites(): Promise<OutfitPreset[]> {
    const db = await initDB();
    return db.getAllFromIndex(STORES.OUTFIT_PRESETS, 'isFavorite', IDBKeyRange.only(true));
  },

  async getBySyncStatus(status: OutfitPreset['syncStatus']): Promise<OutfitPreset[]> {
    const db = await initDB();
    return db.getAllFromIndex(STORES.OUTFIT_PRESETS, 'syncStatus', IDBKeyRange.only(status));
  },

  async add(preset: OutfitPreset): Promise<string> {
    const db = await initDB();
    const key = await db.add(STORES.OUTFIT_PRESETS, preset);
    await addSyncEvent('preset_saved', preset as unknown as Record<string, unknown>, 'fitting');
    return key as string;
  },

  async update(preset: OutfitPreset): Promise<void> {
    const db = await initDB();
    await db.put(STORES.OUTFIT_PRESETS, preset);
  },

  async remove(id: string): Promise<void> {
    const db = await initDB();
    await db.delete(STORES.OUTFIT_PRESETS, id);
  },

  async updateSyncStatus(id: string, status: OutfitPreset['syncStatus']): Promise<void> {
    const db = await initDB();
    const preset = await db.get(STORES.OUTFIT_PRESETS, id);
    if (preset) {
      preset.syncStatus = status;
      await db.put(STORES.OUTFIT_PRESETS, preset);
    }
  },
};

export const snapshotStore = {
  async createSnapshot(items: ClothingItem[], presets: OutfitPreset[]): Promise<WardrobeSnapshot> {
    const db = await initDB();

    const lastSnapshot = await db.getFromIndex(
      STORES.SNAPSHOTS,
      'version',
      null as unknown as IDBValidKey,
    );

    const version = lastSnapshot ? (lastSnapshot.version || 0) + 1 : 1;

    const snapshot: WardrobeSnapshot = {
      id: `snapshot_${Date.now()}`,
      timestamp: Date.now(),
      items: [...items],
      presets: [...presets],
      version,
      checksum: generateChecksum(items, presets),
    };

    await db.add(STORES.SNAPSHOTS, snapshot);
    return snapshot;
  },

  async getAll(): Promise<WardrobeSnapshot[]> {
    const db = await initDB();
    const results = await db.getAllFromIndex(STORES.SNAPSHOTS, 'timestamp');
    return results.reverse();
  },

  async getLatest(): Promise<WardrobeSnapshot | undefined> {
    const db = await initDB();
    const snapshots = await db.getAllFromIndex(STORES.SNAPSHOTS, 'timestamp');
    return snapshots.reverse()[0];
  },

  async getById(id: string): Promise<WardrobeSnapshot | undefined> {
    const db = await initDB();
    return db.get(STORES.SNAPSHOTS, id);
  },

  async restore(snapshot: WardrobeSnapshot): Promise<void> {
    const db = await initDB();
    const tx = db.transaction(
      [STORES.WARDROBE_ITEMS, STORES.OUTFIT_PRESETS],
      'readwrite',
    );

    await tx.objectStore(STORES.WARDROBE_ITEMS).clear();
    await tx.objectStore(STORES.OUTFIT_PRESETS).clear();

    await Promise.all(
      snapshot.items.map((item) =>
        tx.objectStore(STORES.WARDROBE_ITEMS).add(item),
      ),
    );
    await Promise.all(
      snapshot.presets.map((preset) =>
        tx.objectStore(STORES.OUTFIT_PRESETS).add(preset),
      ),
    );

    await tx.done;
  },
};

export const personalProfileStore = {
  async get(): Promise<PersonalColorProfile | undefined> {
    const db = await initDB();
    const profiles = await db.getAll(STORES.PERSONAL_PROFILES);
    return profiles[0];
  },

  async save(profile: PersonalColorProfile): Promise<void> {
    const db = await initDB();
    const existing = await db.getAll(STORES.PERSONAL_PROFILES);
    const tx = db.transaction(STORES.PERSONAL_PROFILES, 'readwrite');
    await Promise.all(existing.map((p) => tx.store.delete(p.id)));
    await tx.store.add(profile);
    await tx.done;
  },

  async update(profile: PersonalColorProfile): Promise<void> {
    const db = await initDB();
    await db.put(STORES.PERSONAL_PROFILES, profile);
  },

  async clear(): Promise<void> {
    const db = await initDB();
    await db.clear(STORES.PERSONAL_PROFILES);
  },
};

export const cartStore = {
  async getAll(): Promise<CartItem[]> {
    const db = await initDB();
    const results = await db.getAllFromIndex(STORES.CART_ITEMS, 'addedAt');
    return results.reverse();
  },

  async add(item: CartItem): Promise<void> {
    const db = await initDB();
    const existing = await db.get(STORES.CART_ITEMS, item.productId);
    if (existing) {
      existing.quantity += item.quantity;
      await db.put(STORES.CART_ITEMS, existing);
    } else {
      await db.add(STORES.CART_ITEMS, item);
    }
    await addSyncEvent('cart_updated', item as unknown as Record<string, unknown>, 'ecommerce');
  },

  async update(productId: string, quantity: number): Promise<void> {
    const db = await initDB();
    const item = await db.get(STORES.CART_ITEMS, productId);
    if (item) {
      if (quantity <= 0) {
        await db.delete(STORES.CART_ITEMS, productId);
      } else {
        item.quantity = quantity;
        await db.put(STORES.CART_ITEMS, item);
      }
      await addSyncEvent('cart_updated', { productId, quantity } as Record<string, unknown>, 'ecommerce');
    }
  },

  async remove(productId: string): Promise<void> {
    const db = await initDB();
    await db.delete(STORES.CART_ITEMS, productId);
    await addSyncEvent('cart_updated', { productId, removed: true } as Record<string, unknown>, 'ecommerce');
  },

  async clear(): Promise<void> {
    const db = await initDB();
    await db.clear(STORES.CART_ITEMS);
  },
};

export const syncEventStore = {
  async getAll(): Promise<SyncEvent[]> {
    const db = await initDB();
    const results = await db.getAllFromIndex(STORES.SYNC_EVENTS, 'timestamp');
    return results.reverse();
  },

  async getBySource(source: SyncEvent['source']): Promise<SyncEvent[]> {
    const db = await initDB();
    return db.getAllFromIndex(STORES.SYNC_EVENTS, 'source', IDBKeyRange.only(source));
  },

  async getAfterTimestamp(timestamp: number): Promise<SyncEvent[]> {
    const db = await initDB();
    const results = await db.getAllFromIndex(
      STORES.SYNC_EVENTS,
      'timestamp',
      IDBKeyRange.lowerBound(timestamp, true),
    );
    return results.reverse();
  },

  async add(event: SyncEvent): Promise<void> {
    const db = await initDB();
    await db.add(STORES.SYNC_EVENTS, event);
  },

  async clearBefore(timestamp: number): Promise<void> {
    const db = await initDB();
    const events = await db.getAllFromIndex(
      STORES.SYNC_EVENTS,
      'timestamp',
      IDBKeyRange.upperBound(timestamp),
    );
    const tx = db.transaction(STORES.SYNC_EVENTS, 'readwrite');
    await Promise.all(events.map((e) => tx.store.delete(e.timestamp)));
    await tx.done;
  },
};

const addSyncEvent = async (
  type: SyncEvent['type'],
  payload: Record<string, unknown>,
  source: SyncEvent['source'],
): Promise<void> => {
  await syncEventStore.add({
    type,
    payload,
    timestamp: Date.now(),
    source,
  });
};

const generateChecksum = (
  items: ClothingItem[],
  presets: OutfitPreset[],
): string => {
  const data = JSON.stringify({
    items: items.map((i) => i.id + i.lastWornAt),
    presets: presets.map((p) => p.id + p.savedAt),
  });
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

export const isDBSupported = (): boolean => {
  return 'indexedDB' in window;
};

export const getStorageInfo = async (): Promise<{
  used: number;
  available: number;
  percentage: number;
}> => {
  if (!navigator.storage?.estimate) {
    return { used: 0, available: 0, percentage: 0 };
  }
  const estimate = await navigator.storage.estimate();
  const used = estimate.usage || 0;
  const available = estimate.quota || 0;
  return {
    used,
    available,
    percentage: available > 0 ? (used / available) * 100 : 0,
  };
};
