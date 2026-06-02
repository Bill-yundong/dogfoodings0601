<script setup lang="ts">
import { useRuleStore } from '@/stores/rule'
import { ArrowRight } from 'lucide-vue-next'

const ruleStore = useRuleStore()

function getWeightColor(w: number) {
  if (w >= 0.9) return 'text-rose-danger'
  if (w >= 0.7) return 'text-amber-alert'
  if (w >= 0.5) return 'text-cyan-glow'
  return 'text-[var(--text-secondary)]'
}
</script>

<template>
  <div class="glass-card p-4">
    <h4 class="section-title text-sm text-cyan-glow mb-4">语义对齐映射表</h4>
    <p class="text-xs text-[var(--text-muted)] mb-4">安防系统与家居控制系统间的语义对齐关系，统一语义用于跨系统冲突检测</p>
    <div class="space-y-2">
      <div
        v-for="mapping in ruleStore.semanticMappings"
        :key="mapping.id"
        class="p-3 rounded-lg border border-[var(--border-subtle)] bg-dark-800/30 hover:border-[var(--border-active)] transition-all"
      >
        <div class="flex items-center gap-3">
          <div class="flex-1 text-right">
            <span class="text-xs font-medium text-amber-alert">{{ mapping.securityTerm }}</span>
            <div class="text-[0.6rem] text-[var(--text-muted)]">安防语义</div>
          </div>
          <div class="flex flex-col items-center">
            <ArrowRight class="w-4 h-4 text-[var(--text-muted)]" />
            <span class="text-[0.55rem] font-mono mt-0.5" :class="getWeightColor(mapping.priorityWeight)">
              {{ mapping.priorityWeight.toFixed(2) }}
            </span>
          </div>
          <div class="flex-1">
            <span class="text-xs font-medium text-cyan-glow">{{ mapping.homeControlTerm }}</span>
            <div class="text-[0.6rem] text-[var(--text-muted)]">家居语义</div>
          </div>
        </div>
        <div class="mt-2 pt-2 border-t border-[var(--border-subtle)]">
          <span class="data-label">统一语义</span>
          <span class="text-xs text-emerald-ok ml-2">{{ mapping.unifiedSemantics }}</span>
          <span class="text-[0.55rem] text-[var(--text-muted)] ml-2">[{{ mapping.category }}]</span>
        </div>
      </div>
    </div>
  </div>
</template>
