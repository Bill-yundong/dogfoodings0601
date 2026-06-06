import { openDB, IDBPDatabase } from 'idb';
import type { DeviceSnapshot, SnapshotQuery, SyncResult, SnapshotStats } from '@/types/snapshot';
import type { Conflict } from '@/types/conflict';
import type { SemanticMapping, Scene } from '@/types/semantic';

const DB_NAME = 'home_automation_db';
const DB_VERSION = 1;

const STORES = {
  SNAPSHOTS: 'device_snapshots',
  CONFLICTS: 'conflicts',
  MAPPINGS: 'semantic_mappings',
  SCENES: 'scenes',
  TASKS: 'async_tasks',
} as const;

class IndexedDBService {
  private db: IDBPDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    await this.initPromise;
  }

  private async _init(): Promise<void> {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade: (db) => {
        if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
          const snapshotStore = db.createObjectStore(STORES.SNAPSHOTS, { keyPath: 'id' });
          snapshotStore.createIndex('deviceId', 'deviceId');
          snapshotStore.createIndex('timestamp', 'timestamp');
          snapshotStore.createIndex('syncStatus', 'syncStatus');
          snapshotStore.createIndex('isOffline', 'isOffline');
          snapshotStore.createIndex('deviceId_timestamp', ['deviceId', 'timestamp']);
        }

        if (!db.objectStoreNames.contains(STORES.CONFLICTS)) {
          const conflictStore = db.createObjectStore(STORES.CONFLICTS, { keyPath: 'id' });
          conflictStore.createIndex('status', 'status');
          conflictStore.createIndex('severity', 'severity');
          conflictStore.createIndex('detectedAt', 'detectedAt');
          conflictStore.createIndex('type', 'type');
        }

        if (!db.objectStoreNames.contains(STORES.MAPPINGS)) {
          db.createObjectStore(STORES.MAPPINGS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.SCENES)) {
          db.createObjectStore(STORES.SCENES, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          const taskStore = db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
          taskStore.createIndex('status', 'status');
          taskStore.createIndex('priority', 'priority');
          taskStore.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }

  private async getDB(): Promise<IDBPDatabase> {
    await this.init();
    if (!this.db) throw new Error('IndexedDB not initialized');
    return this.db;
  }

  async saveSnapshot(snapshot: DeviceSnapshot): Promise<void> {
    const db = await this.getDB();
    await db.put(STORES.SNAPSHOTS, snapshot);
  }

  async saveSnapshotsBatch(snapshots: DeviceSnapshot[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.SNAPSHOTS, 'readwrite');
    await Promise.all(snapshots.map(s => tx.store.put(s)));
    await tx.done;
  }

  async getSnapshot(id: string): Promise<DeviceSnapshot | undefined> {
    const db = await this.getDB();
    return db.get(STORES.SNAPSHOTS, id);
  }

  async getSnapshots(query: SnapshotQuery = {}): Promise<DeviceSnapshot[]> {
    const db = await this.getDB();
    let results: DeviceSnapshot[] = await db.getAll(STORES.SNAPSHOTS);

    if (query.deviceId) {
      results = results.filter(s => s.deviceId === query.deviceId);
    }
    if (query.startTime) {
      results = results.filter(s => s.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter(s => s.timestamp <= query.endTime!);
    }
    if (query.isOffline !== undefined) {
      results = results.filter(s => s.isOffline === query.isOffline);
    }
    if (query.syncStatus) {
      results = results.filter(s => s.syncStatus === query.syncStatus);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async getSnapshotStats(): Promise<SnapshotStats> {
    const db = await this.getDB();
    const allSnapshots = await db.getAll(STORES.SNAPSHOTS);

    const stats: SnapshotStats = {
      totalSnapshots: allSnapshots.length,
      offlineSnapshots: allSnapshots.filter(s => s.isOffline).length,
      pendingSync: allSnapshots.filter(s => s.syncStatus === 'pending').length,
      synced: allSnapshots.filter(s => s.syncStatus === 'synced').length,
      failedSync: allSnapshots.filter(s => s.syncStatus === 'failed').length,
      storageUsed: new Blob([JSON.stringify(allSnapshots)]).size,
    };

    return stats;
  }

  async getPendingSyncCount(): Promise<number> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.SNAPSHOTS, 'readonly');
    const index = tx.store.index('syncStatus');
    const count = await index.count('pending');
    await tx.done;
    return count;
  }

  async updateSyncStatus(ids: string[], status: 'synced' | 'failed'): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.SNAPSHOTS, 'readwrite');
    const now = Date.now();

    for (const id of ids) {
      const snapshot = await tx.store.get(id);
      if (snapshot) {
        snapshot.syncStatus = status;
        snapshot.syncedAt = now;
        await tx.store.put(snapshot);
      }
    }

    await tx.done;
  }

  async syncToCloud(): Promise<SyncResult> {
    const pendingSnapshots = await this.getSnapshots({ syncStatus: 'pending' });
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const snapshot of pendingSnapshots) {
      try {
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        success++;
        await this.updateSyncStatus([snapshot.id], 'synced');
      } catch (error) {
        failed++;
        errors.push(`Snapshot ${snapshot.id}: ${error}`);
        await this.updateSyncStatus([snapshot.id], 'failed');
      }
    }

    return {
      total: pendingSnapshots.length,
      success,
      failed,
      errors,
    };
  }

  async cleanupOldData(retentionDays: number = 30): Promise<number> {
    const db = await this.getDB();
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const allSnapshots = await db.getAll(STORES.SNAPSHOTS);
    const toDelete = allSnapshots.filter(s => s.timestamp < cutoffTime && s.syncStatus === 'synced');

    const tx = db.transaction(STORES.SNAPSHOTS, 'readwrite');
    for (const snapshot of toDelete) {
      await tx.store.delete(snapshot.id);
    }
    await tx.done;

    return toDelete.length;
  }

  async saveConflict(conflict: Conflict): Promise<void> {
    const db = await this.getDB();
    await db.put(STORES.CONFLICTS, conflict);
  }

  async getConflicts(limit: number = 100): Promise<Conflict[]> {
    const db = await this.getDB();
    const results = await db.getAll(STORES.CONFLICTS);
    return results.sort((a, b) => b.detectedAt - a.detectedAt).slice(0, limit);
  }

  async saveSemanticMapping(mapping: SemanticMapping): Promise<void> {
    const db = await this.getDB();
    await db.put(STORES.MAPPINGS, mapping);
  }

  async getSemanticMappings(): Promise<SemanticMapping[]> {
    const db = await this.getDB();
    return db.getAll(STORES.MAPPINGS);
  }

  async saveScene(scene: Scene): Promise<void> {
    const db = await this.getDB();
    await db.put(STORES.SCENES, scene);
  }

  async getScenes(): Promise<Scene[]> {
    const db = await this.getDB();
    return db.getAll(STORES.SCENES);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  async clearAll(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(Object.values(STORES), 'readwrite');
    for (const store of Object.values(STORES)) {
      await tx.objectStore(store).clear();
    }
    await tx.done;
  }
}

export const indexedDBService = new IndexedDBService();
export default indexedDBService;
