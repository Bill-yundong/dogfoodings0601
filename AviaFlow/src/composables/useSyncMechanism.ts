import { ref, onMounted, onUnmounted } from 'vue';
import { useSyncStore } from '../stores/sync';
import { useMedicalStore } from '../stores/medical';
import { useAocStore } from '../stores/aoc';
import type { SyncMessage } from '../types/algorithm';

export function useSyncMechanism() {
  const syncStore = useSyncStore();
  const medicalStore = useMedicalStore();
  const aocStore = useAocStore();
  
  const syncInProgress = ref(false);
  const lastSyncResult = ref<'success' | 'failed' | null>(null);
  const messageQueue = ref<SyncMessage[]>([]);

  async function handleMedicalUpdate(message: SyncMessage) {
    console.log('处理航医数据更新:', message);
    
    if (message.payload?.crewId) {
      await aocStore.checkCrewFatigueRisk(message.payload.crewId);
    }
    
    if (message.payload?.type === 'physiological') {
      await aocStore.loadCrewList();
    }
  }

  async function handleScheduleUpdate(message: SyncMessage) {
    console.log('处理排班更新:', message);
    
    if (message.payload?.crewId) {
      const crew = medicalStore.crewList.find(c => c.id === message.payload.crewId);
      if (crew) {
        await medicalStore.selectCrew(message.payload.crewId);
      }
    }
    
    if (message.payload?.scheduleId) {
      await aocStore.selectSchedule(message.payload.scheduleId);
    }
  }

  async function handleFatigueAlert(message: SyncMessage) {
    console.log('处理疲劳预警:', message);
    
    await medicalStore.loadAlerts();
    await aocStore.loadSchedulePlans();
  }

  async function handleConflictDetected(message: SyncMessage) {
    console.log('处理排班冲突:', message);
    
    if (message.payload?.scheduleId) {
      await aocStore.selectSchedule(message.payload.scheduleId);
    }
  }

  async function processMessage(message: SyncMessage) {
    switch (message.type) {
      case 'medical_update':
        await handleMedicalUpdate(message);
        break;
      case 'schedule_update':
        await handleScheduleUpdate(message);
        break;
      case 'fatigue_alert':
        await handleFatigueAlert(message);
        break;
      case 'conflict_detected':
        await handleConflictDetected(message);
        break;
      case 'sync_request':
        await syncStore.forceSync();
        break;
    }
  }

  async function syncMedicalData(crewId: string, dataType: string, data: any) {
    syncInProgress.value = true;
    try {
      const message = await syncStore.syncMedicalToAOC({
        crewId,
        type: dataType,
        data,
        timestamp: new Date().toISOString(),
      });
      
      messageQueue.value.push(message);
      await syncStore.processPendingMessages();
      await processMessage(message);
      
      lastSyncResult.value = 'success';
      return message;
    } catch (e) {
      lastSyncResult.value = 'failed';
      console.error('同步航医数据失败:', e);
      throw e;
    } finally {
      syncInProgress.value = false;
      setTimeout(() => { lastSyncResult.value = null; }, 3000);
    }
  }

  async function syncScheduleData(scheduleId: string, crewId: string, changes: any) {
    syncInProgress.value = true;
    try {
      const message = await syncStore.syncAOCToMedical({
        scheduleId,
        crewId,
        changes,
        timestamp: new Date().toISOString(),
      });
      
      messageQueue.value.push(message);
      await syncStore.processPendingMessages();
      await processMessage(message);
      
      lastSyncResult.value = 'success';
      return message;
    } catch (e) {
      lastSyncResult.value = 'failed';
      console.error('同步排班数据失败:', e);
      throw e;
    } finally {
      syncInProgress.value = false;
      setTimeout(() => { lastSyncResult.value = null; }, 3000);
    }
  }

  async function triggerFatigueAlert(crewId: string, riskLevel: string, details: any) {
    syncInProgress.value = true;
    try {
      const message = await syncStore.sendFatigueAlert({
        crewId,
        riskLevel,
        details,
        timestamp: new Date().toISOString(),
      });
      
      messageQueue.value.push(message);
      await syncStore.processPendingMessages();
      await processMessage(message);
      
      lastSyncResult.value = 'success';
      return message;
    } catch (e) {
      lastSyncResult.value = 'failed';
      console.error('发送疲劳预警失败:', e);
      throw e;
    } finally {
      syncInProgress.value = false;
      setTimeout(() => { lastSyncResult.value = null; }, 3000);
    }
  }

  async function triggerConflictAlert(scheduleId: string, conflict: any) {
    syncInProgress.value = true;
    try {
      const message = await syncStore.sendConflictDetected({
        scheduleId,
        conflict,
        timestamp: new Date().toISOString(),
      });
      
      messageQueue.value.push(message);
      await syncStore.processPendingMessages();
      await processMessage(message);
      
      lastSyncResult.value = 'success';
      return message;
    } catch (e) {
      lastSyncResult.value = 'failed';
      console.error('发送冲突预警失败:', e);
      throw e;
    } finally {
      syncInProgress.value = false;
      setTimeout(() => { lastSyncResult.value = null; }, 3000);
    }
  }

  async function fullSync() {
    syncInProgress.value = true;
    try {
      await syncStore.forceSync();
      
      await Promise.all([
        medicalStore.loadCrewList(),
        medicalStore.loadAlerts(),
        aocStore.loadSchedulePlans(),
        aocStore.loadCrewList(),
      ]);
      
      lastSyncResult.value = 'success';
    } catch (e) {
      lastSyncResult.value = 'failed';
      console.error('全量同步失败:', e);
      throw e;
    } finally {
      syncInProgress.value = false;
      setTimeout(() => { lastSyncResult.value = null; }, 3000);
    }
  }

  function initializeAutoSync() {
    syncStore.startAutoSync(15000);
  }

  function stopAutoSync() {
    syncStore.stopAutoSync();
  }

  onMounted(() => {
    syncStore.loadAllData();
    initializeAutoSync();
  });

  onUnmounted(() => {
    stopAutoSync();
  });

  async function syncMedicalDataSimple(crewId: string) {
    return await syncMedicalData(crewId, 'all', { syncAll: true });
  }

  async function syncScheduleDataSimple() {
    return await syncScheduleData('all', 'all', { syncAll: true });
  }

  return {
    syncInProgress,
    lastSyncResult,
    messageQueue,
    syncMedicalData,
    syncMedicalDataSimple,
    syncScheduleData,
    syncScheduleDataSimple,
    triggerFatigueAlert,
    triggerConflictAlert,
    fullSync,
    initializeAutoSync,
    stopAutoSync,
    processMessage,
  };
}
