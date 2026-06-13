import type { IDBPDatabase, DBSchema } from 'idb'
import { openDB } from 'idb'
import type {
  SleepSnapshot,
  EnvironmentData,
  SleepStageData,
  AnalysisResult,
  DeviceStatus,
  StorageStats,
} from '@/types'

interface SleepMatrixDB extends DBSchema {
  sleep_snapshots: {
    key: string
    value: SleepSnapshot
    indexes: {
      'by-startTime': number
      'by-scene': string
      'by-createdAt': number
    }
  }
  env_data_points: {
    key: string
    value: EnvironmentData & { snapshotId: string; id: string }
    indexes: {
      'by-snapshotId': string
      'by-timestamp': number
    }
  }
  sleep_stages: {
    key: string
    value: SleepStageData & { snapshotId: string; id: string }
    indexes: {
      'by-snapshotId': string
      'by-timestamp': number
    }
  }
  analysis_results: {
    key: string
    value: AnalysisResult
    indexes: {
      'by-snapshotId': string
      'by-timestamp': number
    }
  }
  device_status: {
    key: string
    value: DeviceStatus
    indexes: {
      'by-type': string
      'by-lastUpdate': number
    }
  }
}

const DB_NAME = 'sleepmatrix-db'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<SleepMatrixDB> | null = null

export async function initDB(): Promise<IDBPDatabase<SleepMatrixDB>> {
  if (dbInstance) return dbInstance

  const db = await openDB<SleepMatrixDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sleep_snapshots')) {
        const store = db.createObjectStore('sleep_snapshots', { keyPath: 'id' })
        store.createIndex('by-startTime', 'startTime')
        store.createIndex('by-scene', 'scene')
        store.createIndex('by-createdAt', 'createdAt')
      }

      if (!db.objectStoreNames.contains('env_data_points')) {
        const store = db.createObjectStore('env_data_points', { keyPath: 'id' })
        store.createIndex('by-snapshotId', 'snapshotId')
        store.createIndex('by-timestamp', 'timestamp')
      }

      if (!db.objectStoreNames.contains('sleep_stages')) {
        const store = db.createObjectStore('sleep_stages', { keyPath: 'id' })
        store.createIndex('by-snapshotId', 'snapshotId')
        store.createIndex('by-timestamp', 'timestamp')
      }

      if (!db.objectStoreNames.contains('analysis_results')) {
        const store = db.createObjectStore('analysis_results', { keyPath: 'id' })
        store.createIndex('by-snapshotId', 'snapshotId')
        store.createIndex('by-timestamp', 'timestamp')
      }

      if (!db.objectStoreNames.contains('device_status')) {
        const store = db.createObjectStore('device_status', { keyPath: 'id' })
        store.createIndex('by-type', 'type')
        store.createIndex('by-lastUpdate', 'lastUpdate')
      }
    },
  })

  dbInstance = db
  return db
}

export function getDB(): IDBPDatabase<SleepMatrixDB> | null {
  return dbInstance
}

export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

export async function getStorageStats(): Promise<StorageStats> {
  const db = await initDB()

  const snapshotCount = await db.count('sleep_snapshots')
  const envDataCount = await db.count('env_data_points')
  const sleepStageCount = await db.count('sleep_stages')
  const analysisCount = await db.count('analysis_results')

  let totalSize = 0
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      totalSize = estimate.usage || 0
    }
  } catch {
    totalSize = (snapshotCount + envDataCount + sleepStageCount + analysisCount) * 1024
  }

  return {
    totalSize,
    snapshotCount,
    envDataCount,
    sleepStageCount,
    analysisCount,
  }
}

export async function clearAllData(): Promise<void> {
  const db = await initDB()
  const tx = db.transaction(
    ['sleep_snapshots', 'env_data_points', 'sleep_stages', 'analysis_results', 'device_status'],
    'readwrite'
  )

  const stores = [
    'sleep_snapshots',
    'env_data_points',
    'sleep_stages',
    'analysis_results',
    'device_status',
  ] as const

  await Promise.all(stores.map((store) => tx.objectStore(store).clear()))

  await tx.done
}
