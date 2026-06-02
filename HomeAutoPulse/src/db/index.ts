import { openDB, type IDBPDatabase } from 'idb'
import type {
  SensorEvent,
  ConflictRecord,
  DeviceSnapshot,
  SemanticMapping,
  ArbitrationRule,
  LinkageAction,
} from '@/types'

const DB_NAME = 'HomeAutoPulseDB'
const DB_VERSION = 1

let dbInstance: IDBPDatabase | null = null

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('snapshots')) {
        const snapStore = db.createObjectStore('snapshots', { keyPath: 'id' })
        snapStore.createIndex('deviceId', 'deviceId')
        snapStore.createIndex('timestamp', 'timestamp')
        snapStore.createIndex('room', 'room')
      }
      if (!db.objectStoreNames.contains('conflicts')) {
        const confStore = db.createObjectStore('conflicts', { keyPath: 'id' })
        confStore.createIndex('status', 'status')
        confStore.createIndex('severity', 'severity')
        confStore.createIndex('createdAt', 'createdAt')
      }
      if (!db.objectStoreNames.contains('rules')) {
        const ruleStore = db.createObjectStore('rules', { keyPath: 'id' })
        ruleStore.createIndex('enabled', 'enabled')
        ruleStore.createIndex('priority', 'priority')
      }
      if (!db.objectStoreNames.contains('semanticMappings')) {
        const mapStore = db.createObjectStore('semanticMappings', { keyPath: 'id' })
        mapStore.createIndex('category', 'category')
      }
      if (!db.objectStoreNames.contains('sensorEvents')) {
        const evtStore = db.createObjectStore('sensorEvents', { keyPath: 'id' })
        evtStore.createIndex('sensorId', 'sensorId')
        evtStore.createIndex('type', 'type')
        evtStore.createIndex('timestamp', 'timestamp')
        evtStore.createIndex('source', 'source')
      }
      if (!db.objectStoreNames.contains('linkageActions')) {
        const actStore = db.createObjectStore('linkageActions', { keyPath: 'id' })
        actStore.createIndex('deviceId', 'deviceId')
        actStore.createIndex('status', 'status')
        actStore.createIndex('timestamp', 'timestamp')
      }
    },
  })
  return dbInstance
}

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await getDB()
  return db.getAll(storeName)
}

export async function getFromStore<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await getDB()
  return db.get(storeName, key)
}

export async function putToStore<T>(storeName: string, value: T): Promise<string> {
  const db = await getDB()
  return db.put(storeName, value) as Promise<string>
}

export async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const db = await getDB()
  await db.delete(storeName, key)
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await getDB()
  await db.clear(storeName)
}

export async function getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
  const db = await getDB()
  const tx = db.transaction(storeName, 'readonly')
  const index = tx.store.index(indexName)
  const results: T[] = []
  for await (const cursor of index.iterate(value)) {
    results.push(cursor.value)
  }
  return results
}

export async function saveSensorEvent(event: SensorEvent): Promise<void> {
  await putToStore('sensorEvents', event)
}

export async function saveConflict(conflict: ConflictRecord): Promise<void> {
  await putToStore('conflicts', conflict)
}

export async function saveSnapshot(snapshot: DeviceSnapshot): Promise<void> {
  await putToStore('snapshots', snapshot)
}

export async function saveRule(rule: ArbitrationRule): Promise<void> {
  await putToStore('rules', rule)
}

export async function saveSemanticMapping(mapping: SemanticMapping): Promise<void> {
  await putToStore('semanticMappings', mapping)
}

export async function saveLinkageAction(action: LinkageAction): Promise<void> {
  await putToStore('linkageActions', action)
}

export async function getRecentSensorEvents(count: number = 100): Promise<SensorEvent[]> {
  const all = await getAllFromStore<SensorEvent>('sensorEvents')
  return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, count)
}

export async function getConflictsByStatus(status: string): Promise<ConflictRecord[]> {
  return getByIndex<ConflictRecord>('conflicts', 'status', status)
}

export async function getSnapshotsByDevice(deviceId: string): Promise<DeviceSnapshot[]> {
  return getByIndex<DeviceSnapshot>('snapshots', 'deviceId', deviceId)
}

export async function getEnabledRules(): Promise<ArbitrationRule[]> {
  return getByIndex<ArbitrationRule>('rules', 'enabled', true as unknown as IDBValidKey)
}
