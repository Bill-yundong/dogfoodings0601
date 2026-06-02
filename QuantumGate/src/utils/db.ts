import { openDB, IDBPDatabase } from 'idb';
import type {
  LaserCoherenceRecord,
  RabiOscillationRecord,
  FidelityResult,
  SyndromeSnapshot,
  ProtocolSyncRecord,
} from '@/types';

interface QuantumDB {
  laserCoherence: {
    key: number;
    value: LaserCoherenceRecord;
    indexes: { 'by-timestamp': number; 'by-qubit': number };
  };
  rabiOscillation: {
    key: number;
    value: RabiOscillationRecord;
    indexes: { 'by-timestamp': number; 'by-qubit': number };
  };
  fidelityResults: {
    key: number;
    value: FidelityResult;
    indexes: { 'by-gate-type': string; 'by-timestamp': number };
  };
  syndromeSnapshots: {
    key: number;
    value: SyndromeSnapshot;
    indexes: { 'by-cycle': number; 'by-timestamp': number };
  };
  protocolSync: {
    key: number;
    value: ProtocolSyncRecord;
    indexes: { 'by-sync-id': string; 'by-timestamp': number };
  };
}

let db: IDBPDatabase<QuantumDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<QuantumDB>> {
  if (db) return db;

  db = await openDB<QuantumDB>('quantum-gate-db', 1, {
    upgrade(database) {
      const laserStore = database.createObjectStore('laserCoherence', {
        keyPath: 'id',
        autoIncrement: true,
      });
      laserStore.createIndex('by-timestamp', 'timestamp');
      laserStore.createIndex('by-qubit', 'qubitId');

      const rabiStore = database.createObjectStore('rabiOscillation', {
        keyPath: 'id',
        autoIncrement: true,
      });
      rabiStore.createIndex('by-timestamp', 'timestamp');
      rabiStore.createIndex('by-qubit', 'qubitId');

      const fidelityStore = database.createObjectStore('fidelityResults', {
        keyPath: 'id',
        autoIncrement: true,
      });
      fidelityStore.createIndex('by-gate-type', 'gateType');
      fidelityStore.createIndex('by-timestamp', 'timestamp');

      const syndromeStore = database.createObjectStore('syndromeSnapshots', {
        keyPath: 'id',
        autoIncrement: true,
      });
      syndromeStore.createIndex('by-cycle', 'cycleNumber');
      syndromeStore.createIndex('by-timestamp', 'timestamp');

      const syncStore = database.createObjectStore('protocolSync', {
        keyPath: 'id',
        autoIncrement: true,
      });
      syncStore.createIndex('by-sync-id', 'syncId');
      syncStore.createIndex('by-timestamp', 'timestamp');
    },
  });

  return db;
}

export async function saveLaserCoherence(record: Omit<LaserCoherenceRecord, 'id'>): Promise<IDBValidKey> {
  const database = await initDB();
  return database.add('laserCoherence', record as LaserCoherenceRecord);
}

export async function getLaserCoherenceByTimeRange(
  startTime: number,
  endTime: number
): Promise<LaserCoherenceRecord[]> {
  const database = await initDB();
  const index = database.transaction('laserCoherence').store.index('by-timestamp');
  return index.getAll(IDBKeyRange.bound(startTime, endTime));
}

export async function saveRabiOscillation(record: Omit<RabiOscillationRecord, 'id'>): Promise<IDBValidKey> {
  const database = await initDB();
  return database.add('rabiOscillation', record as RabiOscillationRecord);
}

export async function getRabiOscillationByQubit(qubitId: number): Promise<RabiOscillationRecord[]> {
  const database = await initDB();
  const index = database.transaction('rabiOscillation').store.index('by-qubit');
  return index.getAll(qubitId);
}

export async function saveFidelityResult(record: Omit<FidelityResult, 'id'>): Promise<IDBValidKey> {
  const database = await initDB();
  return database.add('fidelityResults', record as FidelityResult);
}

export async function getFidelityResultsByGate(gateType: string): Promise<FidelityResult[]> {
  const database = await initDB();
  const index = database.transaction('fidelityResults').store.index('by-gate-type');
  return index.getAll(gateType);
}

export async function saveSyndromeSnapshot(record: Omit<SyndromeSnapshot, 'id'>): Promise<IDBValidKey> {
  const database = await initDB();
  return database.add('syndromeSnapshots', record as SyndromeSnapshot);
}

export async function getSyndromeSnapshotsByCycle(cycleNumber: number): Promise<SyndromeSnapshot[]> {
  const database = await initDB();
  const index = database.transaction('syndromeSnapshots').store.index('by-cycle');
  return index.getAll(cycleNumber);
}

export async function getRecentSyndromeSnapshots(limit: number = 100): Promise<SyndromeSnapshot[]> {
  const database = await initDB();
  const index = database.transaction('syndromeSnapshots').store.index('by-timestamp');
  let cursor = await index.openCursor(null, 'prev');
  const results: SyndromeSnapshot[] = [];
  
  while (cursor && results.length < limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  return results;
}

export async function countSyndromeSnapshots(): Promise<number> {
  const database = await initDB();
  return database.count('syndromeSnapshots');
}

export async function saveProtocolSync(record: Omit<ProtocolSyncRecord, 'id'>): Promise<IDBValidKey> {
  const database = await initDB();
  return database.add('protocolSync', record as ProtocolSyncRecord);
}

export async function getProtocolSyncBySyncId(syncId: string): Promise<ProtocolSyncRecord | undefined> {
  const database = await initDB();
  const index = database.transaction('protocolSync').store.index('by-sync-id');
  return index.get(syncId);
}

export async function clearOldData(beforeTimestamp: number): Promise<void> {
  const database = await initDB();
  const storeNames = ['laserCoherence', 'rabiOscillation', 'fidelityResults', 'syndromeSnapshots', 'protocolSync'] as const;
  const tx = database.transaction(storeNames, 'readwrite');

  for (const name of storeNames) {
    const store = tx.objectStore(name);
    const index = store.index('by-timestamp');
    let cursor = await index.openCursor(IDBKeyRange.upperBound(beforeTimestamp));
    
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }

  await tx.done;
}

export async function getDBStats(): Promise<{
  laserCoherence: number;
  rabiOscillation: number;
  fidelityResults: number;
  syndromeSnapshots: number;
  protocolSync: number;
}> {
  const database = await initDB();
  return {
    laserCoherence: await database.count('laserCoherence'),
    rabiOscillation: await database.count('rabiOscillation'),
    fidelityResults: await database.count('fidelityResults'),
    syndromeSnapshots: await database.count('syndromeSnapshots'),
    protocolSync: await database.count('protocolSync'),
  };
}
