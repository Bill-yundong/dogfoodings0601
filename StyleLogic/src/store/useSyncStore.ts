import { create } from 'zustand';
import type { SyncEvent } from '../types';
import { syncEventStore } from '../services/indexedDB';

interface SyncState {
  lastSyncTimestamp: number;
  pendingSyncs: SyncEvent[];
  isOnline: boolean;
  isSyncing: boolean;
  syncError: string | null;
  listeners: Map<string, (events: SyncEvent[]) => void>;
  init: () => void;
  addSyncListener: (id: string, callback: (events: SyncEvent[]) => void) => void;
  removeSyncListener: (id: string) => void;
  processSyncEvents: (source: 'fitting' | 'ecommerce') => Promise<void>;
  syncFromFittingToEcommerce: (event: SyncEvent) => void;
  syncFromEcommerceToFitting: (event: SyncEvent) => void;
  setOnlineStatus: (online: boolean) => void;
  triggerFullSync: () => Promise<void>;
  getPendingSyncs: () => Promise<SyncEvent[]>;
  clearOldEvents: (days?: number) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  lastSyncTimestamp: 0,
  pendingSyncs: [],
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  syncError: null,
  listeners: new Map(),

  init: () => {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        set({ isOnline: true });
        get().triggerFullSync();
      });
      window.addEventListener('offline', () => {
        set({ isOnline: false });
      });
    }
    get().getPendingSyncs();
  },

  addSyncListener: (id, callback) => {
    set((state) => {
      const newListeners = new Map(state.listeners);
      newListeners.set(id, callback);
      return { listeners: newListeners };
    });
  },

  removeSyncListener: (id) => {
    set((state) => {
      const newListeners = new Map(state.listeners);
      newListeners.delete(id);
      return { listeners: newListeners };
    });
  },

  processSyncEvents: async (source) => {
    const { lastSyncTimestamp, listeners } = get();
    try {
      const events = await syncEventStore.getAfterTimestamp(lastSyncTimestamp);
      const filteredEvents = events.filter((e) => e.source === source);

      if (filteredEvents.length > 0) {
        listeners.forEach((callback) => {
          callback(filteredEvents);
        });
        const latestTimestamp = Math.max(...events.map((e) => e.timestamp));
        set({ lastSyncTimestamp: latestTimestamp });
      }
    } catch (error) {
      set({ syncError: (error as Error).message });
    }
  },

  syncFromFittingToEcommerce: (event) => {
    const { listeners, isOnline } = get();

    if (!isOnline) {
      set((state) => ({
        pendingSyncs: [...state.pendingSyncs, event],
      }));
      return;
    }

    listeners.forEach((callback) => {
      if (event.source === 'fitting') {
        callback([event]);
      }
    });

    set((state) => ({
      lastSyncTimestamp: Math.max(state.lastSyncTimestamp, event.timestamp),
    }));
  },

  syncFromEcommerceToFitting: (event) => {
    const { listeners, isOnline } = get();

    if (!isOnline) {
      set((state) => ({
        pendingSyncs: [...state.pendingSyncs, event],
      }));
      return;
    }

    listeners.forEach((callback) => {
      if (event.source === 'ecommerce') {
        callback([event]);
      }
    });

    set((state) => ({
      lastSyncTimestamp: Math.max(state.lastSyncTimestamp, event.timestamp),
    }));
  },

  setOnlineStatus: (online) => {
    set({ isOnline: online });
    if (online) {
      get().triggerFullSync();
    }
  },

  triggerFullSync: async () => {
    const { pendingSyncs, listeners } = get();
    set({ isSyncing: true, syncError: null });

    try {
      if (pendingSyncs.length > 0) {
        const fittingEvents = pendingSyncs.filter((e) => e.source === 'fitting');
        const ecommerceEvents = pendingSyncs.filter(
          (e) => e.source === 'ecommerce',
        );

        listeners.forEach((callback) => {
          if (fittingEvents.length > 0) callback(fittingEvents);
          if (ecommerceEvents.length > 0) callback(ecommerceEvents);
        });

        const latestTimestamp = Math.max(...pendingSyncs.map((e) => e.timestamp));
        set({
          pendingSyncs: [],
          lastSyncTimestamp: latestTimestamp,
        });
      }

      await get().processSyncEvents('fitting');
      await get().processSyncEvents('ecommerce');

      set({ isSyncing: false });
    } catch (error) {
      set({ syncError: (error as Error).message, isSyncing: false });
    }
  },

  getPendingSyncs: async () => {
    try {
      const events = await syncEventStore.getAfterTimestamp(
        get().lastSyncTimestamp,
      );
      set({ pendingSyncs: events });
      return events;
    } catch (error) {
      set({ syncError: (error as Error).message });
      return [];
    }
  },

  clearOldEvents: async (days = 30) => {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    try {
      await syncEventStore.clearBefore(cutoffTime);
    } catch (error) {
      set({ syncError: (error as Error).message });
    }
  },
}));

export const createSyncEvent = (
  type: SyncEvent['type'],
  payload: Record<string, unknown>,
  source: SyncEvent['source'],
): SyncEvent => ({
  type,
  payload,
  timestamp: Date.now(),
  source,
});
