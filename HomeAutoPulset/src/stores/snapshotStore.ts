import { defineStore } from 'pinia';
import { useOfflineStorage } from '@/composables/useOfflineStorage';

export const useSnapshotStore = defineStore('snapshot', () => {
  const storage = useOfflineStorage();

  const snapshots = storage.snapshots;
  const stats = storage.stats;
  const isLoading = storage.isLoading;
  const isSyncing = storage.isSyncing;
  const error = storage.error;
  const pendingSyncCount = storage.pendingSyncCount;
  const offlineSnapshotCount = storage.offlineSnapshotCount;

  const init = async () => {
    await storage.initStorage();
    await storage.loadStats();
  };

  const loadSnapshots = storage.loadSnapshots;
  const loadStats = storage.loadStats;
  const createSnapshot = storage.createSnapshot;
  const createBatchSnapshots = storage.createBatchSnapshots;
  const syncPendingSnapshots = storage.syncPendingSnapshots;
  const cleanupOldData = storage.cleanupOldData;
  const getSnapshotById = storage.getSnapshotById;
  const clearError = storage.clearError;

  return {
    snapshots,
    stats,
    isLoading,
    isSyncing,
    error,
    pendingSyncCount,
    offlineSnapshotCount,
    init,
    loadSnapshots,
    loadStats,
    createSnapshot,
    createBatchSnapshots,
    syncPendingSnapshots,
    cleanupOldData,
    getSnapshotById,
    clearError,
  };
});
