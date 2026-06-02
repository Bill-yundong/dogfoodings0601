<script setup lang="ts">
import { computed } from 'vue'
import { useConflictStore } from '@/stores/conflict'

const conflictStore = useConflictStore()

const rooms = computed(() => {
  const data = conflictStore.heatmapData
  return Object.entries(data).map(([name, info]) => ({
    name,
    count: info.count,
    severity: info.maxSeverity,
    intensity: Math.min(info.count / 10, 1),
  }))
})

function getColor(intensity: number, severity: number) {
  if (severity >= 4) return `rgba(255, 23, 68, ${0.2 + intensity * 0.6})`
  if (severity >= 3) return `rgba(255, 145, 0, ${0.2 + intensity * 0.6})`
  if (severity >= 2) return `rgba(0, 229, 255, ${0.2 + intensity * 0.5})`
  return `rgba(100, 116, 139, ${0.1 + intensity * 0.3})`
}
</script>

<template>
  <div class="glass-card p-4 h-full">
    <h3 class="section-title text-sm text-cyan-glow mb-4">冲突热力图</h3>
    <div class="space-y-3">
      <div
        v-for="room in rooms"
        :key="room.name"
        class="relative rounded-lg overflow-hidden border border-[var(--border-subtle)]"
        :style="{ background: getColor(room.intensity, room.severity) }"
      >
        <div class="p-3 flex items-center justify-between">
          <span class="text-xs font-medium">{{ room.name }}</span>
          <div class="flex items-center gap-2">
            <span class="data-value text-xs">{{ room.count }}</span>
            <span class="text-[0.6rem] text-[var(--text-muted)]">次冲突</span>
          </div>
        </div>
        <div
          v-if="room.count > 0"
          class="h-1"
          :style="{
            background: room.severity >= 4 ? 'var(--rose-danger)' : room.severity >= 3 ? 'var(--amber-alert)' : 'var(--cyan-glow)',
            width: `${room.intensity * 100}%`,
          }"
        />
      </div>
    </div>
    <div class="mt-4 flex items-center gap-3 text-[0.6rem]">
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[var(--rose-danger)]" /> 紧急</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[var(--amber-alert)]" /> 高</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[var(--cyan-glow)]" /> 中</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[var(--text-muted)]" /> 低</span>
    </div>
  </div>
</template>
