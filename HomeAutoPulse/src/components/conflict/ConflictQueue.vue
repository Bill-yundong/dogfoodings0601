<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConflictStore } from '@/stores/conflict'
import { Clock, AlertTriangle, CheckCircle, ArrowRight, Zap } from 'lucide-vue-next'

const conflictStore = useConflictStore()
const statusFilter = ref<string>('all')
const selectedConflict = ref<string | null>(null)

const filteredConflicts = computed(() => {
  let list = conflictStore.recentConflicts
  if (statusFilter.value !== 'all') {
    list = list.filter(c => c.status === statusFilter.value)
  }
  return list
})

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function getSeverityClass(severity: string) {
  const map: Record<string, string> = { critical: 'severity-critical', high: 'severity-high', medium: 'severity-medium', low: 'severity-low' }
  return map[severity] ?? 'severity-low'
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = { pending: '待处理', resolving: '处理中', resolved: '已解析', escalated: '已升级' }
  return map[status] ?? status
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = { priority: '优先级', semantic: '语义', timing: '时序', resource: '资源' }
  return map[type] ?? type
}

function getStrategyLabel(strategy: string) {
  const map: Record<string, string> = { priority_override: '优先覆盖', merge: '合并', defer: '延迟', conditional: '条件执行' }
  return map[strategy] ?? strategy
}

const selected = computed(() => {
  if (!selectedConflict.value) return null
  return conflictStore.conflicts.find(c => c.id === selectedConflict.value)
})
</script>

<template>
  <div class="grid grid-cols-3 gap-4">
    <div class="col-span-2 space-y-3">
      <div class="flex gap-2 mb-2">
        <button
          v-for="s in ['all', 'pending', 'resolving', 'resolved']"
          :key="s"
          @click="statusFilter = s"
          class="px-3 py-1 rounded text-xs transition-all"
          :class="statusFilter === s
            ? 'bg-cyan-glow/20 text-cyan-glow border border-cyan-glow/30'
            : 'bg-dark-700 text-[var(--text-muted)] hover:text-[var(--text-secondary)]'"
        >
          {{ s === 'all' ? '全部' : getStatusLabel(s) }}
        </button>
      </div>

      <div
        v-for="conflict in filteredConflicts"
        :key="conflict.id"
        @click="selectedConflict = conflict.id"
        class="glass-card p-4 cursor-pointer transition-all"
        :class="[
          selectedConflict === conflict.id ? 'border-cyan-glow/40 shadow-[0_0_15px_rgba(0,229,255,0.1)]' : '',
          getSeverityClass(conflict.severity)
        ]"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[0.6rem] font-mono border" :class="getSeverityClass(conflict.severity)">
              {{ conflict.severity.toUpperCase() }}
            </span>
            <span class="text-xs font-medium">{{ getTypeLabel(conflict.type) }}冲突</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[0.6rem]" :class="[
              conflict.status === 'resolved' ? 'bg-emerald-ok/10 text-emerald-ok' :
              conflict.status === 'resolving' ? 'bg-amber-alert/10 text-amber-alert' :
              'bg-rose-danger/10 text-rose-danger'
            ]">
              {{ getStatusLabel(conflict.status) }}
            </span>
            <span class="text-[0.6rem] font-mono text-[var(--text-muted)]">{{ formatTime(conflict.createdAt) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span class="px-1.5 py-0.5 rounded bg-amber-alert/10 text-amber-alert text-[0.6rem]">
            {{ conflict.events[0]?.source === 'security_system' ? '安防' : '家居' }}
          </span>
          <span class="truncate">{{ conflict.events[0]?.label }}</span>
          <ArrowRight class="w-3 h-3 flex-shrink-0" />
          <span class="px-1.5 py-0.5 rounded bg-cyan-glow/10 text-cyan-glow text-[0.6rem]">
            {{ conflict.events[1]?.source === 'security_system' ? '安防' : '家居' }}
          </span>
          <span class="truncate">{{ conflict.events[1]?.label }}</span>
        </div>
      </div>

      <div v-if="filteredConflicts.length === 0" class="text-center text-sm text-[var(--text-muted)] py-12">
        暂无冲突记录
      </div>
    </div>

    <div class="glass-card p-4">
      <h4 class="section-title text-xs text-cyan-glow mb-4">冲突详情</h4>
      <div v-if="selected" class="space-y-4">
        <div>
          <span class="data-label">冲突ID</span>
          <div class="data-value text-xs mt-1">{{ selected.id }}</div>
        </div>
        <div>
          <span class="data-label">触发事件</span>
          <div class="space-y-1.5 mt-1">
            <div v-for="evt in selected.events" :key="evt.id" class="p-2 rounded bg-dark-800/50 text-xs">
              <div class="flex items-center justify-between">
                <span :class="evt.source === 'security_system' ? 'text-amber-alert' : 'text-cyan-glow'">
                  {{ evt.label }}
                </span>
                <span class="font-mono text-[var(--text-muted)]">{{ evt.value }}{{ evt.unit }}</span>
              </div>
              <div class="text-[0.6rem] text-[var(--text-muted)] mt-0.5">
                {{ evt.sensorId }} · {{ formatTime(evt.timestamp) }}
              </div>
            </div>
          </div>
        </div>
        <div v-if="selected.resolution">
          <span class="data-label">解析结果</span>
          <div class="mt-1 space-y-2">
            <div class="flex items-center gap-2">
              <Zap class="w-3 h-3 text-cyan-glow" />
              <span class="text-xs">策略: {{ getStrategyLabel(selected.resolution.strategy) }}</span>
            </div>
            <div class="text-xs text-[var(--text-secondary)] leading-relaxed p-2 rounded bg-dark-800/50">
              {{ selected.resolution.reasoning }}
            </div>
            <div>
              <span class="data-label">联动动作</span>
              <div class="space-y-1 mt-1">
                <div v-for="action in selected.resolution.actions" :key="action.id" class="flex items-center justify-between text-xs p-1.5 rounded bg-dark-800/30">
                  <span class="text-[var(--text-secondary)]">{{ action.deviceId }}</span>
                  <span :class="action.status === 'completed' ? 'text-emerald-ok' : 'text-amber-alert'" class="text-[0.6rem]">
                    {{ action.status }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-xs text-amber-alert animate-pulse flex items-center gap-1">
          <Clock class="w-3 h-3" />
          等待解析...
        </div>
      </div>
      <div v-else class="text-center text-sm text-[var(--text-muted)] py-12">
        选择左侧冲突查看详情
      </div>
    </div>
  </div>
</template>
