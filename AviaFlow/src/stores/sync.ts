import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import dayjs from 'dayjs';
import type { SyncMessage, SyncLog } from '../types/algorithm';
import { 
  getSyncMessages, 
  addSyncMessage, 
  markMessageProcessed,
  getSyncLogs,
  addSyncLog,
  getSyncStats,
  getPendingSyncMessages,
} from '../database/stores/syncStore';

export const useSyncStore = defineStore('sync', () => {
  const messages = ref<SyncMessage[]>([]);
  const logs = ref<SyncLog[]>([]);
  const stats = ref<Awaited<ReturnType<typeof getSyncStats>> | null>(null);
  const pendingMessages = ref<SyncMessage[]>([]);
  const loading = ref(false);
  const lastSyncTime = ref<string | null>(null);
  const autoSyncEnabled = ref(true);
  const syncInterval = ref<number | null>(null);

  const pendingCount = computed(() => pendingMessages.value.length);
  const successRate = computed(() => stats.value?.successRate ?? 100);
  const isSynced = computed(() => pendingCount.value === 0);

  async function loadAllData() {
    loading.value = true;
    try {
      const [msgs, syncLogs, syncStats, pending] = await Promise.all([
        getSyncMessages(),
        getSyncLogs(),
        getSyncStats(),
        getPendingSyncMessages(),
      ]);
      messages.value = msgs;
      logs.value = syncLogs;
      stats.value = syncStats;
      pendingMessages.value = pending;
    } catch (e) {
      console.error('加载同步数据失败:', e);
    } finally {
      loading.value = false;
    }
  }

  async function sendMessage(
    type: SyncMessage['type'],
    payload: any,
    source: SyncMessage['source'],
    target?: SyncMessage['target']
  ): Promise<SyncMessage> {
    const message: SyncMessage = {
      id: `syncmsg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      source,
      target: target || 'all',
      status: 'pending',
    };

    try {
      await addSyncMessage(message);
      pendingMessages.value.push(message);
      messages.value.unshift(message);
      await logSync(source, target || 'all', message.id, type);
      return message;
    } catch (e) {
      console.error('发送同步消息失败:', e);
      throw e;
    }
  }

  async function processPendingMessages() {
    if (pendingMessages.value.length === 0) return;

    for (const message of [...pendingMessages.value]) {
      try {
        message.status = 'delivered';
        await addSyncMessage(message);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await markMessageProcessed(message.id);
        message.status = 'processed';
        message.processedAt = new Date().toISOString();
        
        pendingMessages.value = pendingMessages.value.filter(m => m.id !== message.id);
        
        await logSync(message.source, message.target || 'all', message.id, message.type, 'success');
      } catch (e) {
        console.error('处理同步消息失败:', message.id, e);
        await logSync(message.source, message.target || 'all', message.id, message.type, 'failed', 
          e instanceof Error ? e.message : '未知错误');
      }
    }
    
    lastSyncTime.value = new Date().toISOString();
    stats.value = await getSyncStats();
  }

  async function logSync(
    source: SyncLog['source'],
    target: SyncLog['target'],
    recordId: string,
    recordType: string,
    status: SyncLog['status'] = 'success',
    errorMessage?: string
  ): Promise<string> {
    const log: SyncLog = {
      id: `synclog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source,
      target,
      recordId,
      recordType,
      syncTime: new Date().toISOString(),
      status,
      errorMessage,
    };
    
    const id = await addSyncLog(log);
    logs.value.unshift(log);
    return id;
  }

  async function syncMedicalToAOC(payload: any, sourceModule: 'medical' | 'algorithm' = 'medical') {
    return sendMessage('medical_update', payload, sourceModule, 'aoc');
  }

  async function syncAOCToMedical(payload: any) {
    return sendMessage('schedule_update', payload, 'aoc', 'medical');
  }

  async function sendFatigueAlert(payload: any) {
    return sendMessage('fatigue_alert', payload, 'algorithm', 'all');
  }

  async function sendConflictDetected(payload: any) {
    return sendMessage('conflict_detected', payload, 'aoc', 'all');
  }

  async function requestSync(target: SyncMessage['target']) {
    return sendMessage('sync_request', {}, 'system', target);
  }

  function startAutoSync(intervalMs: number = 30000) {
    if (syncInterval.value) {
      clearInterval(syncInterval.value);
    }
    
    autoSyncEnabled.value = true;
    syncInterval.value = window.setInterval(async () => {
      if (autoSyncEnabled.value) {
        await processPendingMessages();
      }
    }, intervalMs);
  }

  function stopAutoSync() {
    autoSyncEnabled.value = false;
    if (syncInterval.value) {
      clearInterval(syncInterval.value);
      syncInterval.value = null;
    }
  }

  async function forceSync() {
    await processPendingMessages();
    await loadAllData();
  }

  async function syncAll() {
    await processPendingMessages();
    await loadAllData();
  }

  async function loadStats(limit: number = 50) {
    stats.value = await getSyncStats();
    logs.value = await getSyncLogs(undefined, undefined, undefined, limit);
  }

  async function loadMessages() {
    messages.value = await getSyncMessages();
    pendingMessages.value = await getPendingSyncMessages();
  }

  return {
    messages,
    logs,
    stats,
    pendingMessages,
    loading,
    lastSyncTime,
    autoSyncEnabled,
    pendingCount,
    successRate,
    isSynced,
    loadAllData,
    sendMessage,
    processPendingMessages,
    logSync,
    syncMedicalToAOC,
    syncAOCToMedical,
    sendFatigueAlert,
    sendConflictDetected,
    requestSync,
    startAutoSync,
    stopAutoSync,
    forceSync,
    syncAll,
    loadStats,
    loadMessages,
  };
});
