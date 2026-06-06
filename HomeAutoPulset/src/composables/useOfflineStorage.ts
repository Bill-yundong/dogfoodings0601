import { ref, computed } from 'vue';
import { indexedDBService } from '@/utils/indexedDB';
import type { DeviceSnapshot, SnapshotQuery, SnapshotStats, SyncResult } from '@/types/snapshot';
import type { Device } from '@/types/device';

export function useOfflineStorage() {
  const snapshots = ref<DeviceSnapshot[]>([]);
  const stats = ref<SnapshotStats | null>(null);
  const isLoading = ref(false);
  const isSyncing = ref(false);
  const error = ref<string | null>(null);

  const pendingSyncCount = computed(() => stats.value?.pendingSync ?? 0);
  const offlineSnapshotCount = computed(() => stats.value?.offlineSnapshots ?? 0);

  const loadSnapshots = async (query: SnapshotQuery = {}) => {
    isLoading.value = true;
    error.value = null;
    try {
      await indexedDBService.init();
      snapshots.value = await indexedDBService.getSnapshots(query);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载快照失败';
    } finally {
      isLoading.value = false;
    }
  };

  const loadStats = async () => {
    try {
      await indexedDBService.init();
      stats.value = await indexedDBService.getSnapshotStats();
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载统计失败';
    }
  };

  const createSnapshot = async (device: Device, triggerCondition: string, isOffline: boolean = false) => {
    try {
      await indexedDBService.init();
      const snapshot: DeviceSnapshot = {
        id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        deviceId: device.id,
        timestamp: Date.now(),
        state: { ...device.currentState },
        triggerCondition,
        isOffline,
        syncStatus: isOffline ? 'pending' : 'synced',
        dataHash: Math.random().toString(36).substr(2, 16),
        metadata: {
          location: device.location,
          deviceType: device.type,
          deviceName: device.name,
        },
      };
      await indexedDBService.saveSnapshot(snapshot);
      await loadStats();
      return snapshot;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '创建快照失败';
      return null;
    }
  };

  const createBatchSnapshots = async (devices: Device[], triggerCondition: string) => {
    try {
      await indexedDBService.init();
      const now = Date.now();
      const newSnapshots: DeviceSnapshot[] = devices.map(device => ({
        id: `snapshot_${now}_${Math.random().toString(36).substr(2, 9)}`,
        deviceId: device.id,
        timestamp: now,
        state: { ...device.currentState },
        triggerCondition,
        isOffline: false,
        syncStatus: 'synced',
        dataHash: Math.random().toString(36).substr(2, 16),
        metadata: {
          location: device.location,
          deviceType: device.type,
          deviceName: device.name,
        },
      }));
      await indexedDBService.saveSnapshotsBatch(newSnapshots);
      await loadStats();
      return newSnapshots;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '批量创建快照失败';
      return [];
    }
  };

  const syncPendingSnapshots = async (): Promise<SyncResult | null> => {
    isSyncing.value = true;
    error.value = null;
    try {
      await indexedDBService.init();
      const result = await indexedDBService.syncToCloud();
      await loadStats();
      await loadSnapshots();
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '同步快照失败';
      return null;
    } finally {
      isSyncing.value = false;
    }
  };

  const cleanupOldData = async (retentionDays: number = 30): Promise<number> => {
    try {
      await indexedDBService.init();
      const deletedCount = await indexedDBService.cleanupOldData(retentionDays);
      await loadStats();
      await loadSnapshots();
      return deletedCount;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '清理数据失败';
      return 0;
    }
  };

  const getSnapshotById = async (id: string): Promise<DeviceSnapshot | undefined> => {
    try {
      await indexedDBService.init();
      return indexedDBService.getSnapshot(id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取快照失败';
      return undefined;
    }
  };

  const initStorage = async () => {
    try {
      await indexedDBService.init();
    } catch (e) {
      error.value = e instanceof Error ? e.message : '初始化存储失败';
    }
  };

  const clearError = () => {
    error.value = null;
  };

  return {
    snapshots,
    stats,
    isLoading,
    isSyncing,
    error,
    pendingSyncCount,
    offlineSnapshotCount,
    loadSnapshots,
    loadStats,
    createSnapshot,
    createBatchSnapshots,
    syncPendingSnapshots,
    cleanupOldData,
    getSnapshotById,
    initStorage,
    clearError,
  };
}
