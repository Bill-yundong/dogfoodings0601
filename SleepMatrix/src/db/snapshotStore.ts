import { initDB } from './index'
import type { SleepSnapshot, EnvironmentData, SleepStageData, AnalysisResult } from '@/types'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export async function saveSleepSnapshot(
  snapshot: Omit<SleepSnapshot, 'id' | 'createdAt'>
): Promise<SleepSnapshot> {
  const db = await initDB()
  const tx = db.transaction(['sleep_snapshots', 'env_data_points', 'sleep_stages'], 'readwrite')

  const snapshotId = generateId()
  const newSnapshot: SleepSnapshot = {
    ...snapshot,
    id: snapshotId,
    createdAt: Date.now(),
  }

  await tx.objectStore('sleep_snapshots').add(newSnapshot)

  const envStore = tx.objectStore('env_data_points')
  for (const env of snapshot.envData) {
    await envStore.add({
      ...env,
      id: generateId(),
      snapshotId,
    })
  }

  const stageStore = tx.objectStore('sleep_stages')
  for (const stage of snapshot.sleepStages) {
    await stageStore.add({
      ...stage,
      id: generateId(),
      snapshotId,
    })
  }

  await tx.done
  return newSnapshot
}

export async function getSleepSnapshot(id: string): Promise<SleepSnapshot | undefined> {
  const db = await initDB()
  const snapshot = await db.get('sleep_snapshots', id)

  if (!snapshot) return undefined

  const [envData, sleepStages, analysis] = await Promise.all([
    db.getAllFromIndex('env_data_points', 'by-snapshotId', id),
    db.getAllFromIndex('sleep_stages', 'by-snapshotId', id),
    db.getAllFromIndex('analysis_results', 'by-snapshotId', id),
  ])

  return {
    ...snapshot,
    envData: envData.sort((a, b) => a.timestamp - b.timestamp),
    sleepStages: sleepStages.sort((a, b) => a.timestamp - b.timestamp),
    analysis: analysis[0],
  }
}

export async function listSleepSnapshots(
  options: {
    startTime?: number
    endTime?: number
    scene?: string
    limit?: number
    offset?: number
  } = {}
): Promise<SleepSnapshot[]> {
  const db = await initDB()
  const index = db.transaction('sleep_snapshots', 'readonly').store.index('by-startTime')

  let snapshots: SleepSnapshot[] = []

  if (options.startTime !== undefined || options.endTime !== undefined) {
    const range = IDBKeyRange.bound(
      options.startTime || 0,
      options.endTime || Date.now()
    )
    snapshots = await index.getAll(range)
  } else {
    snapshots = await index.getAll()
  }

  if (options.scene) {
    snapshots = snapshots.filter((s) => s.scene === options.scene)
  }

  snapshots.sort((a, b) => b.startTime - a.startTime)

  if (options.offset) {
    snapshots = snapshots.slice(options.offset)
  }
  if (options.limit) {
    snapshots = snapshots.slice(0, options.limit)
  }

  return snapshots
}

export async function deleteSleepSnapshot(id: string): Promise<void> {
  const db = await initDB()
  const tx = db.transaction(
    ['sleep_snapshots', 'env_data_points', 'sleep_stages', 'analysis_results'],
    'readwrite'
  )

  await tx.objectStore('sleep_snapshots').delete(id)

  const envStore = tx.objectStore('env_data_points')
  const stageStore = tx.objectStore('sleep_stages')
  const analysisStore = tx.objectStore('analysis_results')

  const [envData, sleepStages, analysis] = await Promise.all([
    envStore.index('by-snapshotId').getAll(id),
    stageStore.index('by-snapshotId').getAll(id),
    analysisStore.index('by-snapshotId').getAll(id),
  ])

  await Promise.all([
    ...envData.map((d) => envStore.delete(d.id)),
    ...sleepStages.map((d) => stageStore.delete(d.id)),
    ...analysis.map((d) => analysisStore.delete(d.id)),
  ])

  await tx.done
}

export async function saveAnalysisResult(result: Omit<AnalysisResult, 'id'>): Promise<AnalysisResult> {
  const db = await initDB()
  const newResult: AnalysisResult = {
    ...result,
    id: generateId(),
  }
  await db.put('analysis_results', newResult)
  return newResult
}

export async function getAnalysisBySnapshotId(snapshotId: string): Promise<AnalysisResult | undefined> {
  const db = await initDB()
  const results = await db.getAllFromIndex('analysis_results', 'by-snapshotId', snapshotId)
  return results[0]
}

export async function batchImportSnapshots(snapshots: SleepSnapshot[]): Promise<void> {
  const db = await initDB()
  const tx = db.transaction(
    ['sleep_snapshots', 'env_data_points', 'sleep_stages', 'analysis_results'],
    'readwrite'
  )

  for (const snapshot of snapshots) {
    await tx.objectStore('sleep_snapshots').put(snapshot)

    const envStore = tx.objectStore('env_data_points')
    for (const env of snapshot.envData) {
      await envStore.put({
        ...env,
        id: `${snapshot.id}-env-${env.timestamp}`,
        snapshotId: snapshot.id,
      })
    }

    const stageStore = tx.objectStore('sleep_stages')
    for (const stage of snapshot.sleepStages) {
      await stageStore.put({
        ...stage,
        id: `${snapshot.id}-stage-${stage.timestamp}`,
        snapshotId: snapshot.id,
      })
    }

    if (snapshot.analysis) {
      await tx.objectStore('analysis_results').put(snapshot.analysis)
    }
  }

  await tx.done
}

export async function exportAllSnapshots(): Promise<SleepSnapshot[]> {
  const snapshots = await listSleepSnapshots()
  const result: SleepSnapshot[] = []

  for (const snapshot of snapshots) {
    const full = await getSleepSnapshot(snapshot.id)
    if (full) result.push(full)
  }

  return result
}

export type { EnvironmentData, SleepStageData }
