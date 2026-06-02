<script setup lang="ts">
import { useConflictStore } from '@/stores/conflict'
import { useSensorStore } from '@/stores/sensor'
import { AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-vue-next'

const conflictStore = useConflictStore()
const sensorStore = useSensorStore()

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function getSeverityColor(severity: string) {
  const map: Record<string, string> = { critical: 'text-rose-danger', high: 'text-amber-alert', medium: 'text-cyan-glow', low: 'text-[var(--text-secondary)]' }
  return map[severity] ?? 'text-[var(--text-secondary)]'
}

function getStatusIcon(status: string) {
  if (status === 'resolved') return CheckCircle
  if (status === 'resolving') return Clock
  return AlertTriangle
}

function getStatusColor(status: string) {
  if (status === 'resolved') return 'text-emerald-ok'
  if (status === 'resolving') return 'text-amber-alert'
  return 'text-rose-danger'
}

const typeLabels: Record<string, string> = { priority: '优先级冲突', semantic: '语义冲突', timing: '时序冲突', resource: '资源冲突' }
</script>

<template>
  <div class="glass-card p-4 h-full overflow-hidden flex flex-col">
    <h3 class="section-title text-sm text-cyan-glow mb-3">告警时间线</h3>
    <div class="flex-1 overflow-auto space-y-2">
      <div
        v-for="conflict in conflictStore.recentConflicts.slice(0, 10)"
        :key="conflict.id"
        class="p-2.5 rounded-lg border border-[var(--border-subtle)] bg-dark-800/50 animate-fade-in"
      >
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-1.5">
            <component :is="getStatusIcon(conflict.status)" class="w-3 h-3" :class="getStatusColor(conflict.status)" />
            <span class="text-xs font-medium" :class="getSeverityColor(conflict.severity)">
              {{ typeLabels[conflict.type] || conflict.type }}
            </span>
          </div>
          <span class="text-[0.6rem] font-mono text-[var(--text-muted)]">{{ formatTime(conflict.createdAt) }}</span>
        </div>
        <div class="text-[0.65rem] text-[var(--text-secondary)] truncate">
          {{ conflict.events.map(e => e.label).join(' ⇌ ') }}
        </div>
        <div v-if="conflict.resolution" class="text-[0.6rem] text-emerald-ok mt-1 truncate">
          ✓ {{ conflict.resolution.reasoning }}
        </div>
      </div>
      <div v-if="conflictStore.recentConflicts.length === 0" class="text-center text-xs text-[var(--text-muted)] py-8">
        暂无冲突告警
      </div>
    </div>
  </div>
</template>
