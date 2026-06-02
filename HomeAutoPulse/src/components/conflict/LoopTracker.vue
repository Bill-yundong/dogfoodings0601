<script setup lang="ts">
import { useConflictStore } from '@/stores/conflict'
import { Eye, GitMerge, Scale, Play, CheckCircle } from 'lucide-vue-next'

const conflictStore = useConflictStore()

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const phaseConfig: Record<string, { icon: any; color: string; label: string }> = {
  sense: { icon: Eye, color: 'text-cyan-glow', label: '感知' },
  align: { icon: GitMerge, color: 'text-amber-alert', label: '对齐' },
  detect: { icon: Scale, color: 'text-rose-danger', label: '检测' },
  arbitrate: { icon: Scale, color: 'text-amber-alert', label: '仲裁' },
  execute: { icon: Play, color: 'text-cyan-glow', label: '执行' },
  verify: { icon: CheckCircle, color: 'text-emerald-ok', label: '验证' },
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="conflictStore.traces.length === 0" class="text-center text-sm text-[var(--text-muted)] py-12">
      暂无闭环追踪记录，冲突解析后将自动生成
    </div>
    <div
      v-for="trace in [...conflictStore.traces].reverse().slice(0, 5)"
      :key="trace.id"
      class="glass-card p-4"
    >
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="section-title text-xs text-cyan-glow">闭环追踪</span>
          <span class="font-mono text-[0.6rem] text-[var(--text-muted)]">{{ trace.id }}</span>
        </div>
        <span class="px-2 py-0.5 rounded text-[0.6rem]" :class="[
          trace.status === 'completed' ? 'bg-emerald-ok/10 text-emerald-ok' :
          trace.status === 'running' ? 'bg-cyan-glow/10 text-cyan-glow' :
          'bg-rose-danger/10 text-rose-danger'
        ]">
          {{ trace.status === 'completed' ? '已完成' : trace.status === 'running' ? '进行中' : '失败' }}
        </span>
      </div>

      <div class="flex items-start gap-1">
        <div
          v-for="(step, idx) in trace.steps"
          :key="idx"
          class="flex-1 relative"
        >
          <div class="flex flex-col items-center">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all"
              :class="[
                (phaseConfig[step.phase]?.color ?? 'text-[var(--text-secondary)]'),
                `border-current/30`
              ]"
            >
              <component :is="phaseConfig[step.phase]?.icon ?? Eye" class="w-3.5 h-3.5" :class="phaseConfig[step.phase]?.color" />
            </div>
            <span class="text-[0.55rem] mt-1.5 font-medium" :class="phaseConfig[step.phase]?.color">
              {{ phaseConfig[step.phase]?.label ?? step.phase }}
            </span>
            <span class="text-[0.5rem] font-mono text-[var(--text-muted)]">{{ formatTime(step.timestamp) }}</span>
          </div>
          <div
            v-if="idx < trace.steps.length - 1"
            class="absolute top-4 left-[calc(50%+16px)] right-[calc(-50%+16px)] h-px bg-[var(--border-subtle)]"
          />
        </div>
      </div>

      <div class="mt-4 space-y-1">
        <div
          v-for="(step, idx) in trace.steps"
          :key="idx"
          class="flex items-start gap-2 text-xs"
        >
          <span class="font-mono text-[0.6rem] text-[var(--text-muted)] w-8 flex-shrink-0">{{ (idx + 1).toString().padStart(2, '0') }}</span>
          <span class="text-[var(--text-secondary)]">{{ step.description }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
