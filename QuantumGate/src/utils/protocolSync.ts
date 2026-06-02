import type { ProtocolSyncRecord, RabiParams, GateParams, QuantumGateType } from '@/types';
import { saveProtocolSync } from './db';

type SyncDirection = 'to-hardware' | 'from-hardware' | 'bidirectional';

interface SyncPayload {
  type: 'rabi-config' | 'gate-params' | 'qubit-control' | 'status-request' | 'data-batch';
  data: unknown;
  timestamp: number;
}

interface SyncResult {
  success: boolean;
  syncId: string;
  timestamp: number;
  data?: unknown;
  error?: string;
}

class ProtocolSyncService {
  private listeners: Map<string, (data: unknown) => void> = new Map();
  private syncQueue: { id: string; payload: SyncPayload; direction: SyncDirection }[] = [];
  private isProcessing = false;
  private mockLatency = 150;
  private mockErrorRate = 0.05;

  generateSyncId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async connect(_endpoint: string): Promise<boolean> {
    await this.delay(500);
    return true;
  }

  disconnect(): void {
    this.listeners.clear();
    this.syncQueue = [];
  }

  async syncRabiConfig(params: RabiParams): Promise<SyncResult> {
    const syncId = this.generateSyncId();
    const payload: SyncPayload = {
      type: 'rabi-config',
      data: params,
      timestamp: Date.now(),
    };

    const record: Omit<ProtocolSyncRecord, 'id'> = {
      syncId,
      status: 'pending',
      syncTime: 0,
      payload: params as unknown as Record<string, unknown>,
      direction: 'to-hardware',
      timestamp: Date.now(),
    };
    await saveProtocolSync(record);

    return this.enqueueSync(syncId, payload, 'to-hardware');
  }

  async syncGateParams(gateType: QuantumGateType, params: GateParams): Promise<SyncResult> {
    const syncId = this.generateSyncId();
    const payload: SyncPayload = {
      type: 'gate-params',
      data: { gateType, params },
      timestamp: Date.now(),
    };

    const record: Omit<ProtocolSyncRecord, 'id'> = {
      syncId,
      status: 'pending',
      syncTime: 0,
      payload: { gateType, params } as Record<string, unknown>,
      direction: 'to-hardware',
      timestamp: Date.now(),
    };
    await saveProtocolSync(record);

    return this.enqueueSync(syncId, payload, 'to-hardware');
  }

  async requestStatus(): Promise<SyncResult> {
    const syncId = this.generateSyncId();
    const payload: SyncPayload = {
      type: 'status-request',
      data: {},
      timestamp: Date.now(),
    };

    return this.enqueueSync(syncId, payload, 'bidirectional');
  }

  private async enqueueSync(
    syncId: string,
    payload: SyncPayload,
    direction: SyncDirection
  ): Promise<SyncResult> {
    this.syncQueue.push({ id: syncId, payload, direction });
    
    if (!this.isProcessing) {
      this.processQueue();
    }

    return new Promise((resolve) => {
      this.listeners.set(syncId, (result) => {
        resolve(result as SyncResult);
        this.listeners.delete(syncId);
      });
    });
  }

  private async processQueue(): Promise<void> {
    if (this.syncQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const task = this.syncQueue.shift()!;

    await saveProtocolSync({
      syncId: task.id,
      status: 'syncing',
      syncTime: 0,
      payload: task.payload.data as Record<string, unknown>,
      direction: task.direction,
      timestamp: Date.now(),
    });

    const startTime = Date.now();
    await this.delay(this.mockLatency + Math.random() * 100);

    const isError = Math.random() < this.mockErrorRate;
    const syncTime = Date.now() - startTime;

    if (isError) {
      await saveProtocolSync({
        syncId: task.id,
        status: 'failed',
        syncTime,
        payload: task.payload.data as Record<string, unknown>,
        direction: task.direction,
        timestamp: Date.now(),
      });

      const callback = this.listeners.get(task.id);
      if (callback) {
        callback({
          success: false,
          syncId: task.id,
          timestamp: Date.now(),
          error: 'Simulation error - retry recommended',
        });
      }
    } else {
      await saveProtocolSync({
        syncId: task.id,
        status: 'completed',
        syncTime,
        payload: task.payload.data as Record<string, unknown>,
        direction: task.direction,
        timestamp: Date.now(),
      });

      const result: SyncResult = {
        success: true,
        syncId: task.id,
        timestamp: Date.now(),
        data: this.generateMockResponse(task.payload),
      };

      const callback = this.listeners.get(task.id);
      if (callback) {
        callback(result);
      }
    }

    this.processQueue();
  }

  private generateMockResponse(payload: SyncPayload): unknown {
    switch (payload.type) {
      case 'rabi-config':
        return {
          ack: true,
          appliedParams: payload.data,
          hardwareLatency: Math.random() * 50,
        };
      case 'gate-params':
        return {
          ack: true,
          gateApplied: true,
          estimatedFidelity: 0.95 + Math.random() * 0.04,
        };
      case 'status-request':
        return {
          laserPower: 80 + Math.random() * 20,
          temperature: 0.01 + Math.random() * 0.01,
          qubitStates: Array(8).fill(0).map(() => Math.random() > 0.5 ? 1 : 0),
        };
      default:
        return { ack: true };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  onSync(callback: (data: SyncResult) => void): () => void {
    const listenerId = `global-${Date.now()}`;
    this.listeners.set(listenerId, callback as (data: unknown) => void);
    return () => this.listeners.delete(listenerId);
  }

  getStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.syncQueue.length,
      isProcessing: this.isProcessing,
    };
  }

  setMockLatency(latency: number): void {
    this.mockLatency = latency;
  }

  setMockErrorRate(rate: number): void {
    this.mockErrorRate = Math.max(0, Math.min(1, rate));
  }
}

export const protocolSync = new ProtocolSyncService();
