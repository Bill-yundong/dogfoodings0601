export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface DeviceSnapshot {
  id: string;
  deviceId: string;
  timestamp: number;
  state: Record<string, any>;
  triggerCondition: string;
  isOffline: boolean;
  syncStatus: SyncStatus;
  syncedAt?: number;
  dataHash: string;
  metadata: {
    location: string;
    deviceType: string;
    deviceName: string;
  };
}

export interface SnapshotQuery {
  deviceId?: string;
  startTime?: number;
  endTime?: number;
  isOffline?: boolean;
  syncStatus?: SyncStatus;
  limit?: number;
  offset?: number;
}

export interface SyncResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

export interface SnapshotStats {
  totalSnapshots: number;
  offlineSnapshots: number;
  pendingSync: number;
  synced: number;
  failedSync: number;
  storageUsed: number;
}
