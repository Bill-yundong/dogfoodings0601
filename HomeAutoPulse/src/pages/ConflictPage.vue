<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConflictStore } from '@/stores/conflict'
import { useRuleStore } from '@/stores/rule'
import ConflictQueue from '@/components/conflict/ConflictQueue.vue'
import SemanticMapping from '@/components/conflict/SemanticMapping.vue'
import LoopTracker from '@/components/conflict/LoopTracker.vue'

const conflictStore = useConflictStore()
const ruleStore = useRuleStore()
const activeTab = ref<'queue' | 'mapping' | 'loop'>('queue')

const tabs = [
  { key: 'queue' as const, label: '异步冲突队列' },
  { key: 'mapping' as const, label: '语义对齐映射' },
  { key: 'loop' as const, label: '联动闭环追踪' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="section-title text-xl text-cyan-glow glow-text">冲突解析中心</h2>
      <span class="data-label">CONFLICT RESOLUTION</span>
    </div>

    <div class="grid grid-cols-4 gap-4">
      <div class="glass-card p-4 cyber-border">
        <span class="data-label">待处理</span>
        <div class="data-value text-2xl text-amber-alert mt-1">{{ conflictStore.pendingCount }}</div>
      </div>
      <div class="glass-card p-4 cyber-border">
        <span class="data-label">处理中</span>
        <div class="data-value text-2xl text-cyan-glow mt-1">{{ conflictStore.resolvingConflicts.length }}</div>
      </div>
      <div class="glass-card p-4 cyber-border">
        <span class="data-label">已解析</span>
        <div class="data-value text-2xl text-emerald-ok mt-1">{{ conflictStore.resolvedCount }}</div>
      </div>
      <div class="glass-card p-4 cyber-border">
        <span class="data-label">解析率</span>
        <div class="data-value text-2xl mt-1" :class="conflictStore.totalConflicts > 0 ? 'text-cyan-glow' : 'text-[var(--text-muted)]'">
          {{ conflictStore.totalConflicts > 0 ? Math.round(conflictStore.resolvedCount / conflictStore.totalConflicts * 100) : 0 }}%
        </div>
      </div>
    </div>

    <div class="flex gap-2 border-b border-[var(--border-subtle)] pb-0">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="activeTab = tab.key"
        class="px-4 py-2 text-sm transition-all border-b-2 -mb-px"
        :class="activeTab === tab.key
          ? 'text-cyan-glow border-cyan-glow'
          : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'"
      >
        {{ tab.label }}
      </button>
    </div>

    <ConflictQueue v-if="activeTab === 'queue'" />
    <SemanticMapping v-else-if="activeTab === 'mapping'" />
    <LoopTracker v-else-if="activeTab === 'loop'" />
  </div>
</template>
