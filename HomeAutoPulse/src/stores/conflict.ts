import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ConflictRecord, LoopTrace } from '@/types'

export const useConflictStore = defineStore('conflict', () => {
  const conflicts = ref<ConflictRecord[]>([])
  const traces = ref<LoopTrace[]>([])

  const pendingConflicts = computed(() => conflicts.value.filter((c) => c.status === 'pending'))
  const resolvingConflicts = computed(() => conflicts.value.filter((c) => c.status === 'resolving'))
  const resolvedConflicts = computed(() => conflicts.value.filter((c) => c.status === 'resolved'))
  const criticalConflicts = computed(() => conflicts.value.filter((c) => c.severity === 'critical'))

  const totalConflicts = computed(() => conflicts.value.length)
  const pendingCount = computed(() => pendingConflicts.value.length)
  const resolvedCount = computed(() => resolvedConflicts.value.length)
  const criticalCount = computed(() => criticalConflicts.value.length)

  const recentConflicts = computed(() =>
    [...conflicts.value].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)
  )

  const conflictStats = computed(() => {
    const byType: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    conflicts.value.forEach((c) => {
      byType[c.type] = (byType[c.type] || 0) + 1
      bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1
    })
    return { byType, bySeverity, total: conflicts.value.length }
  })

  const heatmapData = computed(() => {
    const roomMap: Record<string, { count: number; maxSeverity: number }> = {}
    const roomNames = ['客厅', '卧室', '厨房', '门厅', '全屋']
    roomNames.forEach((r) => { roomMap[r] = { count: 0, maxSeverity: 0 } })
    const sevWeight: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
    conflicts.value.forEach((c) => {
      c.events.forEach((e) => {
        const dev = e.sensorId
        if (dev.includes('living') || dev.includes('door-lock') || dev.includes('door-sensor') || dev.includes('motion') || dev.includes('camera') || dev.includes('alarm') || dev.includes('light-living') || dev.includes('ac') || dev.includes('curtain')) {
          roomMap['客厅'].count++
          roomMap['客厅'].maxSeverity = Math.max(roomMap['客厅'].maxSeverity, sevWeight[c.severity] || 0)
        }
        if (dev.includes('bedroom') || dev.includes('emergency') || dev.includes('window')) {
          roomMap['卧室'].count++
          roomMap['卧室'].maxSeverity = Math.max(roomMap['卧室'].maxSeverity, sevWeight[c.severity] || 0)
        }
        if (dev.includes('smoke') || dev.includes('shutoff') || dev.includes('vent')) {
          roomMap['厨房'].count++
          roomMap['厨房'].maxSeverity = Math.max(roomMap['厨房'].maxSeverity, sevWeight[c.severity] || 0)
        }
        if (dev.includes('camera-door') || dev.includes('light-door')) {
          roomMap['门厅'].count++
          roomMap['门厅'].maxSeverity = Math.max(roomMap['门厅'].maxSeverity, sevWeight[c.severity] || 0)
        }
      })
    })
    return roomMap
  })

  function addConflict(conflict: ConflictRecord) {
    conflicts.value.push(conflict)
  }

  function updateConflict(id: string, updates: Partial<ConflictRecord>) {
    const idx = conflicts.value.findIndex((c) => c.id === id)
    if (idx !== -1) {
      conflicts.value[idx] = { ...conflicts.value[idx], ...updates }
    }
  }

  function addTrace(trace: LoopTrace) {
    traces.value.push(trace)
  }

  return {
    conflicts, traces, pendingConflicts, resolvingConflicts, resolvedConflicts,
    criticalConflicts, totalConflicts, pendingCount, resolvedCount, criticalCount,
    recentConflicts, conflictStats, heatmapData,
    addConflict, updateConflict, addTrace,
  }
})
