import { createSignal, createEffect } from 'solid-js'
import type { SleepSnapshot } from '@/types'
import {
  listSleepSnapshots,
  getSleepSnapshot,
  saveSleepSnapshot,
  deleteSleepSnapshot,
  batchImportSnapshots,
  exportAllSnapshots,
} from '@/db/snapshotStore'
import { getStorageStats, clearAllData } from '@/db/index'
import { generateHistoricalSnapshots } from '@/mock/dataGenerator'
import type { StorageStats } from '@/types'

const [snapshots, setSnapshots] = createSignal<SleepSnapshot[]>([])
const [selectedSnapshot, setSelectedSnapshot] = createSignal<SleepSnapshot | null>(null)
const [isLoading, setIsLoading] = createSignal(false)
const [storageStats, setStorageStats] = createSignal<StorageStats | null>(null)

async function loadSnapshots(options?: {
  startTime?: number
  endTime?: number
  scene?: string
  limit?: number
}): Promise<void> {
  setIsLoading(true)
  try {
    const result = await listSleepSnapshots(options)
    setSnapshots(result)
  } finally {
    setIsLoading(false)
  }
}

async function loadSnapshotDetail(id: string): Promise<void> {
  setIsLoading(true)
  try {
    const snapshot = await getSleepSnapshot(id)
    setSelectedSnapshot(snapshot || null)
  } finally {
    setIsLoading(false)
  }
}

async function createSnapshot(snapshot: Omit<SleepSnapshot, 'id' | 'createdAt'>): Promise<SleepSnapshot> {
  const result = await saveSleepSnapshot(snapshot)
  await loadSnapshots()
  return result
}

async function removeSnapshot(id: string): Promise<void> {
  await deleteSleepSnapshot(id)
  if (selectedSnapshot()?.id === id) {
    setSelectedSnapshot(null)
  }
  await loadSnapshots()
}

async function importSnapshots(data: SleepSnapshot[]): Promise<void> {
  await batchImportSnapshots(data)
  await loadSnapshots()
  await updateStorageStats()
}

async function exportSnapshots(): Promise<SleepSnapshot[]> {
  return exportAllSnapshots()
}

async function updateStorageStats(): Promise<void> {
  const stats = await getStorageStats()
  setStorageStats(stats)
}

async function clearAllSnapshots(): Promise<void> {
  await clearAllData()
  setSnapshots([])
  setSelectedSnapshot(null)
  await updateStorageStats()
}

async function initMockData(): Promise<void> {
  const mockSnapshots = generateHistoricalSnapshots(14)
  await batchImportSnapshots(mockSnapshots)
  await loadSnapshots()
  await updateStorageStats()
}

export function useSnapshots() {
  createEffect(() => {
    loadSnapshots()
    updateStorageStats()
  })

  return {
    snapshots,
    selectedSnapshot,
    isLoading,
    storageStats,
    loadSnapshots,
    loadSnapshotDetail,
    createSnapshot,
    removeSnapshot,
    importSnapshots,
    exportSnapshots,
    updateStorageStats,
    clearAllSnapshots,
    initMockData,
    setSelectedSnapshot,
  }
}

export {
  snapshots,
  selectedSnapshot,
  isLoading,
  storageStats,
  loadSnapshots,
  loadSnapshotDetail,
  createSnapshot,
  removeSnapshot,
  importSnapshots,
  exportSnapshots,
  updateStorageStats,
  clearAllSnapshots,
  initMockData,
  setSelectedSnapshot,
}
