import { getDB } from '../schema';
import type { SyncMessage, SyncLog } from '../../types/algorithm';
import dayjs from 'dayjs';

export async function addSyncMessage(message: SyncMessage): Promise<string> {
  const db = await getDB();
  return db.add('syncMessages', message);
}

export async function updateSyncMessage(message: SyncMessage): Promise<string> {
  const db = await getDB();
  return db.put('syncMessages', message);
}

export async function getSyncMessages(
  type?: SyncMessage['type'],
  source?: SyncMessage['source'],
  status?: SyncMessage['status']
): Promise<SyncMessage[]> {
  const db = await getDB();
  let messages: SyncMessage[];
  
  if (type) {
    messages = await db.getAllFromIndex('syncMessages', 'by-type', type);
  } else if (source) {
    messages = await db.getAllFromIndex('syncMessages', 'by-source', source);
  } else {
    messages = await db.getAll('syncMessages');
  }
  
  if (status) {
    messages = messages.filter(m => m.status === status);
  }
  
  return messages.sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf());
}

export async function getPendingSyncMessages(): Promise<SyncMessage[]> {
  const db = await getDB();
  const pending = await db.getAllFromIndex('syncMessages', 'by-status', 'pending');
  const delivered = await db.getAllFromIndex('syncMessages', 'by-status', 'delivered');
  return [...pending, ...delivered].sort(
    (a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf()
  );
}

export async function markMessageProcessed(messageId: string): Promise<void> {
  const db = await getDB();
  const msg = await db.get('syncMessages', messageId);
  if (msg) {
    msg.status = 'processed';
    msg.processedAt = dayjs().toISOString();
    await db.put('syncMessages', msg);
  }
}

export async function addSyncLog(log: SyncLog): Promise<string> {
  const db = await getDB();
  return db.add('syncLogs', log);
}

export async function getSyncLogs(
  source?: SyncLog['source'],
  target?: SyncLog['target'],
  status?: SyncLog['status'],
  limit: number = 100
): Promise<SyncLog[]> {
  const db = await getDB();
  let logs: SyncLog[];
  
  if (source) {
    logs = await db.getAllFromIndex('syncLogs', 'by-source', source);
  } else if (target) {
    logs = await db.getAllFromIndex('syncLogs', 'by-target', target);
  } else {
    logs = await db.getAll('syncLogs');
  }
  
  if (status) {
    logs = logs.filter(l => l.status === status);
  }
  
  return logs
    .sort((a, b) => dayjs(b.syncTime).valueOf() - dayjs(a.syncTime).valueOf())
    .slice(0, limit);
}

export async function getSyncStats() {
  const db = await getDB();
  const logs = await db.getAll('syncLogs');
  
  const last24h = dayjs().subtract(24, 'hour').toISOString();
  const recentLogs = logs.filter(l => l.syncTime >= last24h);
  const todayStart = dayjs().startOf('day').toISOString();
  const todayLogs = logs.filter(l => l.syncTime >= todayStart);
  const pendingMessages = await getPendingSyncMessages();
  
  return {
    totalSyncs: logs.length,
    last24hSyncs: recentLogs.length,
    successRate: logs.length > 0 
      ? (logs.filter(l => l.status === 'success').length / logs.length) * 100 
      : 100,
    lastSyncTime: logs.length > 0 ? logs[0].syncTime : null,
    pendingMessages: pendingMessages.length,
    pendingCount: pendingMessages.length,
    todaySuccessCount: todayLogs.filter(l => l.status === 'success').length,
  };
}

export async function bulkAddSyncLogs(logs: SyncLog[]): Promise<string[]> {
  const db = await getDB();
  const tx = db.transaction('syncLogs', 'readwrite');
  const promises = logs.map(l => tx.store.add(l));
  const results = await Promise.all(promises);
  await tx.done;
  return results;
}
