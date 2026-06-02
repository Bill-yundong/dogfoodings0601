import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DeviceSnapshot } from '@/types'
import { saveSnapshot, getAllFromStore, deleteFromStore as dbDelete } from '@/db'

export const useSnapshotStore = defineStore('snapshot', () => {
  const snapshots = ref<DeviceSnapshot[]>([])
  const selectedSnapshotIds = ref<string[]>([])

  const snapshotsByDevice = computed(() => {
    const map: Record<string, DeviceSnapshot[]> = {}
    snapshots.value.forEach((s) => {
      if (!map[s.deviceId]) map[s.deviceId] = []
      map[s.deviceId].push(s)
    })
    return map
  })

  const latestSnapshots = computed(() =>
    [...snapshots.value].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20)
  )

  const compareSnapshots = computed(() => {
    if (selectedSnapshotIds.value.length !== 2) return null
    const a = snapshots.value.find((s) => s.id === selectedSnapshotIds.value[0])
    const b = snapshots.value.find((s) => s.id === selectedSnapshotIds.value[1])
    if (!a || !b) return null
    const diffs: { key: string; valueA: unknown; valueB: unknown; changed: boolean }[] = []
    const allKeys = new Set([...Object.keys(a.state), ...Object.keys(b.state)])
    allKeys.forEach((key) => {
      const va = a.state[key]
      const vb = b.state[key]
      diffs.push({ key, valueA: va, valueB: vb, changed: JSON.stringify(va) !== JSON.stringify(vb) })
    })
    return { snapshotA: a, snapshotB: b, diffs }
  })

  async function loadSnapshots() {
    try {
      const all = await getAllFromStore<DeviceSnapshot>('snapshots')
      snapshots.value = all.sort((a, b) => b.timestamp - a.timestamp)
    } catch {
      snapshots.value = []
    }
  }

  async function addSnapshot(snapshot: DeviceSnapshot) {
    snapshots.value.push(snapshot)
    await saveSnapshot(snapshot)
  }

  async function removeSnapshot(id: string) {
    snapshots.value = snapshots.value.filter((s) => s.id !== id)
    await dbDelete('snapshots', id)
  }

  function toggleSnapshotSelection(id: string) {
    const idx = selectedSnapshotIds.value.indexOf(id)
    if (idx !== -1) {
      selectedSnapshotIds.value.splice(idx, 1)
    } else {
      if (selectedSnapshotIds.value.length >= 2) selectedSnapshotIds.value.shift()
      selectedSnapshotIds.value.push(id)
    }
  }

  return { snapshots, selectedSnapshotIds, snapshotsByDevice, latestSnapshots, compareSnapshots, loadSnapshots, addSnapshot, removeSnapshot, toggleSnapshotSelection }
})
