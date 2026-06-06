import { openDB, type IDBPDatabase, type IDBPTransaction, type IDBPObjectStore } from 'idb';
import { DB_NAME, DB_VERSION, type SleepMatrixDB, type StoreName } from './schema';
import type { SleepSession, EnvDataPoint, SleepStagePoint } from '@/types/data';
import type { Device, DeviceConfig } from '@/types/device';
import type { AnalysisResult, AnalysisTask } from '@/types/analysis';
import { v4 as uuidv4 } from 'uuid';

let dbInstance: IDBPDatabase<SleepMatrixDB> | null = null;
let initPromise: Promise<IDBPDatabase<SleepMatrixDB>> | null = null;

export async function initDB(): Promise<IDBPDatabase<SleepMatrixDB>> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = openDB<SleepMatrixDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        const sleepSessionsStore = db.createObjectStore('sleep_sessions', { keyPath: 'id' });
        sleepSessionsStore.createIndex('by-userId', 'userId');
        sleepSessionsStore.createIndex('by-startTime', 'startTime');
        sleepSessionsStore.createIndex('by-scenario', 'scenario');
        sleepSessionsStore.createIndex('by-userId-startTime', ['userId', 'startTime']);

        const envDataStore = db.createObjectStore('env_data_points', { keyPath: 'id' });
        envDataStore.createIndex('by-sessionId', 'sessionId');
        envDataStore.createIndex('by-timestamp', 'timestamp');
        envDataStore.createIndex('by-sessionId-timestamp', ['sessionId', 'timestamp']);

        const sleepStageStore = db.createObjectStore('sleep_stage_points', { keyPath: 'id' });
        sleepStageStore.createIndex('by-sessionId', 'sessionId');
        sleepStageStore.createIndex('by-timestamp', 'timestamp');
        sleepStageStore.createIndex('by-sessionId-timestamp', ['sessionId', 'timestamp']);

        const analysisResultsStore = db.createObjectStore('analysis_results', { keyPath: 'id' });
        analysisResultsStore.createIndex('by-sessionId', 'sessionId');
        analysisResultsStore.createIndex('by-analyzedAt', 'analyzedAt');
        analysisResultsStore.createIndex('by-sessionId-analyzedAt', ['sessionId', 'analyzedAt']);

        const analysisTasksStore = db.createObjectStore('analysis_tasks', { keyPath: 'id' });
        analysisTasksStore.createIndex('by-sessionId', 'sessionId');
        analysisTasksStore.createIndex('by-status', 'status');
        analysisTasksStore.createIndex('by-createdAt', 'createdAt');

        const devicesStore = db.createObjectStore('devices', { keyPath: 'id' });
        devicesStore.createIndex('by-userId', 'userId');
        devicesStore.createIndex('by-status', 'status');
        devicesStore.createIndex('by-userId-status', ['userId', 'status']);

        const deviceConfigsStore = db.createObjectStore('device_configs', { keyPath: 'id' });
        deviceConfigsStore.createIndex('by-deviceId', 'deviceId');

        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
    blocked() {
      console.warn('IndexedDB is blocked. Please close other tabs.');
    },
    blocking() {
      console.warn('IndexedDB version change blocked. Closing connection.');
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
      }
    },
    terminated() {
      console.warn('IndexedDB connection terminated.');
      dbInstance = null;
    },
  });

  try {
    dbInstance = await initPromise;
    return dbInstance;
  } catch (error) {
    initPromise = null;
    console.error('Failed to initialize IndexedDB:', error);
    throw error;
  }
}

export function getDB(): IDBPDatabase<SleepMatrixDB> {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return dbInstance;
}

export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    initPromise = null;
  }
}

async function withTransaction<T>(
  storeNames: StoreName | StoreName[],
  mode: 'readonly' | 'readwrite',
  callback: (tx: IDBPTransaction<SleepMatrixDB, StoreName[], typeof mode>) => Promise<T>
): Promise<T> {
  const db = await initDB();
  const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
  const tx = db.transaction(stores, mode);
  try {
    const result = await callback(tx as IDBPTransaction<SleepMatrixDB, StoreName[], typeof mode>);
    await tx.done;
    return result;
  } catch (error) {
    tx.abort();
    throw error;
  }
}

function getStore(
  tx: IDBPTransaction<SleepMatrixDB, StoreName[], 'readonly' | 'readwrite'>,
  storeName: StoreName
): any {
  return tx.objectStore(storeName);
}

export async function addSleepSession(session: Omit<SleepSession, 'id' | 'createdAt'>): Promise<string> {
  const id = uuidv4();
  const now = Date.now();
  await withTransaction('sleep_sessions', 'readwrite', async (tx) => {
    const store = getStore(tx, 'sleep_sessions');
    await store.add({ ...session, id, createdAt: now } as any);
  });
  return id;
}

export async function getSleepSession(id: string): Promise<SleepSession | undefined> {
  return withTransaction('sleep_sessions', 'readonly', async (tx) => {
    const store = getStore(tx, 'sleep_sessions');
    return store.get(id) as Promise<SleepSession | undefined>;
  });
}

export async function getSleepSessionsByUserId(
  userId: string,
  limit?: number,
  offset?: number
): Promise<SleepSession[]> {
  return withTransaction('sleep_sessions', 'readonly', async (tx) => {
    const store = getStore(tx, 'sleep_sessions');
    const index = store.index('by-userId-startTime' as any);
    const range = IDBKeyRange.bound([userId, 0], [userId, Date.now()]);
    const results: SleepSession[] = [];
    let count = 0;
    let skip = offset || 0;

    let cursor = await index.openCursor(range, 'prev');
    while (cursor) {
      if (skip > 0) {
        skip--;
        cursor = await cursor.continue();
        continue;
      }
      if (limit && count >= limit) break;
      results.push(cursor.value as SleepSession);
      count++;
      cursor = await cursor.continue();
    }
    return results;
  });
}

export async function getSleepSessionsByDateRange(
  userId: string,
  startTime: number,
  endTime: number
): Promise<SleepSession[]> {
  return withTransaction('sleep_sessions', 'readonly', async (tx) => {
    const store = getStore(tx, 'sleep_sessions');
    const index = store.index('by-userId-startTime' as any);
    const range = IDBKeyRange.bound([userId, startTime], [userId, endTime]);
    return index.getAll(range) as Promise<SleepSession[]>;
  });
}

export async function addEnvDataPoints(points: Array<Omit<EnvDataPoint, 'id'>>): Promise<string[]> {
  return withTransaction('env_data_points', 'readwrite', async (tx) => {
    const store = getStore(tx, 'env_data_points');
    const ids: string[] = [];
    for (const point of points) {
      const id = uuidv4();
      await store.add({ ...point, id } as any);
      ids.push(id);
    }
    return ids;
  });
}

export async function getEnvDataBySessionId(sessionId: string): Promise<EnvDataPoint[]> {
  return withTransaction('env_data_points', 'readonly', async (tx) => {
    const store = getStore(tx, 'env_data_points');
    const index = store.index('by-sessionId-timestamp' as any);
    const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Date.now()]);
    return index.getAll(range) as Promise<EnvDataPoint[]>;
  });
}

export async function addSleepStagePoints(points: Array<Omit<SleepStagePoint, 'id'>>): Promise<string[]> {
  return withTransaction('sleep_stage_points', 'readwrite', async (tx) => {
    const store = getStore(tx, 'sleep_stage_points');
    const ids: string[] = [];
    for (const point of points) {
      const id = uuidv4();
      await store.add({ ...point, id } as any);
      ids.push(id);
    }
    return ids;
  });
}

export async function getSleepStageDataBySessionId(sessionId: string): Promise<SleepStagePoint[]> {
  return withTransaction('sleep_stage_points', 'readonly', async (tx) => {
    const store = getStore(tx, 'sleep_stage_points');
    const index = store.index('by-sessionId-timestamp' as any);
    const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Date.now()]);
    return index.getAll(range) as Promise<SleepStagePoint[]>;
  });
}

export async function addAnalysisResult(result: Omit<AnalysisResult, 'id'>): Promise<string> {
  const id = uuidv4();
  await withTransaction('analysis_results', 'readwrite', async (tx) => {
    const store = getStore(tx, 'analysis_results');
    await store.add({ ...result, id } as any);
  });
  return id;
}

export async function getAnalysisResultBySessionId(sessionId: string): Promise<AnalysisResult | undefined> {
  return withTransaction('analysis_results', 'readonly', async (tx) => {
    const store = getStore(tx, 'analysis_results');
    const index = store.index('by-sessionId-analyzedAt' as any);
    const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Date.now()]);
    const results = await index.getAll(range);
    return results[results.length - 1] as AnalysisResult | undefined;
  });
}

export async function addAnalysisTask(task: Omit<AnalysisTask, 'id' | 'createdAt'>): Promise<string> {
  const id = uuidv4();
  const now = Date.now();
  await withTransaction('analysis_tasks', 'readwrite', async (tx) => {
    const store = getStore(tx, 'analysis_tasks');
    await store.add({ ...task, id, createdAt: now } as any);
  });
  return id;
}

export async function updateAnalysisTask(id: string, updates: Partial<AnalysisTask>): Promise<void> {
  await withTransaction('analysis_tasks', 'readwrite', async (tx) => {
    const store = getStore(tx, 'analysis_tasks');
    const existing = await store.get(id);
    if (existing) {
      await store.put({ ...existing, ...updates } as any);
    }
  });
}

export async function getPendingAnalysisTasks(): Promise<AnalysisTask[]> {
  return withTransaction('analysis_tasks', 'readonly', async (tx) => {
    const store = getStore(tx, 'analysis_tasks');
    const index = store.index('by-status' as any);
    return index.getAll(IDBKeyRange.only('pending')) as Promise<AnalysisTask[]>;
  });
}

export async function addDevice(device: Omit<Device, 'id'>): Promise<string> {
  const id = uuidv4();
  await withTransaction('devices', 'readwrite', async (tx) => {
    const store = getStore(tx, 'devices');
    await store.add({ ...device, id } as any);
  });
  return id;
}

export async function getDevicesByUserId(userId: string): Promise<Device[]> {
  return withTransaction('devices', 'readonly', async (tx) => {
    const store = getStore(tx, 'devices');
    const index = store.index('by-userId' as any);
    return index.getAll(IDBKeyRange.only(userId)) as Promise<Device[]>;
  });
}

export async function updateDevice(id: string, updates: Partial<Device>): Promise<void> {
  await withTransaction('devices', 'readwrite', async (tx) => {
    const store = getStore(tx, 'devices');
    const existing = await store.get(id);
    if (existing) {
      await store.put({ ...existing, ...updates } as any);
    }
  });
}

export async function getDeviceConfig(deviceId: string): Promise<DeviceConfig | undefined> {
  return withTransaction('device_configs', 'readonly', async (tx) => {
    const store = getStore(tx, 'device_configs');
    const index = store.index('by-deviceId' as any);
    const results = await index.getAll(IDBKeyRange.only(deviceId));
    return results[0] as DeviceConfig | undefined;
  });
}

export async function updateDeviceConfig(
  deviceId: string,
  updates: Partial<DeviceConfig>
): Promise<string> {
  return withTransaction('device_configs', 'readwrite', async (tx) => {
    const store = getStore(tx, 'device_configs');
    const index = store.index('by-deviceId' as any);
    const existing = await index.get(IDBKeyRange.only(deviceId));
    const now = Date.now();

    if (existing) {
      const updated = { ...existing, ...updates, updatedAt: now };
      await store.put(updated as any);
      return (existing as any).id;
    } else {
      const id = uuidv4();
      const config: DeviceConfig = {
        id,
        deviceId,
        sampleRate: 1,
        reportInterval: 1000,
        thresholdAlerts: [],
        autoControlRules: [],
        createdAt: now,
        updatedAt: now,
        ...updates,
      };
      await store.add(config as any);
      return id;
    }
  });
}

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  return withTransaction('settings', 'readonly', async (tx) => {
    const store = getStore(tx, 'settings');
    const result = await store.get(key);
    return (result as any)?.value as T;
  });
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await withTransaction('settings', 'readwrite', async (tx) => {
    const store = getStore(tx, 'settings');
    await store.put({ key, value, updatedAt: Date.now() } as any);
  });
}

export async function getSessionWithFullData(sessionId: string): Promise<{
  session: SleepSession | undefined;
  envData: EnvDataPoint[];
  sleepStageData: SleepStagePoint[];
  analysis: AnalysisResult | undefined;
}> {
  return withTransaction(
    ['sleep_sessions', 'env_data_points', 'sleep_stage_points', 'analysis_results'],
    'readonly',
    async (tx) => {
      const sessionStore = getStore(tx, 'sleep_sessions');
      const envStore = getStore(tx, 'env_data_points');
      const sleepStore = getStore(tx, 'sleep_stage_points');
      const analysisStore = getStore(tx, 'analysis_results');

      const [session, envData, sleepStageData, analysis] = await Promise.all([
        sessionStore.get(sessionId) as Promise<SleepSession | undefined>,
        envStore.index('by-sessionId-timestamp' as any).getAll(
          IDBKeyRange.bound([sessionId, 0], [sessionId, Date.now()])
        ) as Promise<EnvDataPoint[]>,
        sleepStore.index('by-sessionId-timestamp' as any).getAll(
          IDBKeyRange.bound([sessionId, 0], [sessionId, Date.now()])
        ) as Promise<SleepStagePoint[]>,
        (async () => {
          const results = await analysisStore
            .index('by-sessionId-analyzedAt' as any)
            .getAll(IDBKeyRange.bound([sessionId, 0], [sessionId, Date.now()]));
          return results[results.length - 1] as AnalysisResult | undefined;
        })(),
      ]);

      return { session, envData, sleepStageData, analysis };
    }
  );
}

export async function clearAllData(): Promise<void> {
  return withTransaction(
    ['sleep_sessions', 'env_data_points', 'sleep_stage_points', 'analysis_results', 'analysis_tasks'],
    'readwrite',
    async (tx) => {
      await Promise.all([
        getStore(tx, 'sleep_sessions').clear(),
        getStore(tx, 'env_data_points').clear(),
        getStore(tx, 'sleep_stage_points').clear(),
        getStore(tx, 'analysis_results').clear(),
        getStore(tx, 'analysis_tasks').clear(),
      ]);
    }
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  return withTransaction(
    ['sleep_sessions', 'env_data_points', 'sleep_stage_points', 'analysis_results', 'analysis_tasks'],
    'readwrite',
    async (tx) => {
      const stores = [
        'sleep_sessions',
        'env_data_points',
        'sleep_stage_points',
        'analysis_results',
        'analysis_tasks',
      ] as const;

      for (const storeName of stores) {
        const store = getStore(tx, storeName);
        if (storeName === 'sleep_sessions') {
          await store.delete(sessionId);
        } else {
          const index = store.index('by-sessionId' as any);
          let cursor = await index.openCursor(IDBKeyRange.only(sessionId));
          while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
          }
        }
      }
    }
  );
}

export async function exportAllData(): Promise<string> {
  const db = await initDB();
  const data: Record<string, unknown[]> = {};

  for (const storeName of ['sleep_sessions', 'env_data_points', 'sleep_stage_points', 'analysis_results', 'devices', 'device_configs'] as const) {
    data[storeName] = await db.getAll(storeName);
  }

  return JSON.stringify(data, null, 2);
}

export async function importData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString) as Record<string, unknown[]>;

  return withTransaction(
    ['sleep_sessions', 'env_data_points', 'sleep_stage_points', 'analysis_results', 'devices', 'device_configs'],
    'readwrite',
    async (tx) => {
      for (const [storeName, items] of Object.entries(data)) {
        const store = getStore(tx, storeName as StoreName);
        for (const item of items) {
          await store.put(item as any);
        }
      }
    }
  );
}
