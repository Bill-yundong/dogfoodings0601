<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRuleStore } from '@/stores/rule'
import { Plus, ToggleLeft, ToggleRight, Trash2, Edit3, Save, X } from 'lucide-vue-next'

const ruleStore = useRuleStore()
const activeTab = ref<'rules' | 'templates' | 'mappings'>('rules')
const editingRuleId = ref<string | null>(null)
const showAddRule = ref(false)

const newRule = ref({
  name: '',
  strategy: 'priority_override' as const,
  priority: 50,
  field: 'type',
  operator: 'eq' as const,
  value: '',
})

const strategyLabels: Record<string, string> = {
  priority_override: '优先覆盖',
  merge: '合并',
  defer: '延迟',
  conditional: '条件执行',
}

const strategyColors: Record<string, string> = {
  priority_override: 'text-rose-danger bg-rose-danger/10',
  merge: 'text-emerald-ok bg-emerald-ok/10',
  defer: 'text-amber-alert bg-amber-alert/10',
  conditional: 'text-cyan-glow bg-cyan-glow/10',
}

const operatorLabels: Record<string, string> = {
  eq: '等于',
  neq: '不等于',
  gt: '大于',
  lt: '小于',
  contains: '包含',
  in: '属于',
}

const templates = [
  { name: '安防优先模式', desc: '安防系统事件始终优先于家居控制', strategy: 'priority_override', priority: 100 },
  { name: '安全合并模式', desc: '安全类事件与家居事件合并执行', strategy: 'merge', priority: 90 },
  { name: '舒适延迟模式', desc: '舒适类事件延迟执行，等待冲突消除', strategy: 'defer', priority: 50 },
  { name: '节能条件模式', desc: '节能类事件根据条件判断是否执行', strategy: 'conditional', priority: 60 },
]

function addRule() {
  if (!newRule.value.name) return
  ruleStore.addRule({
    id: `ar-custom-${Date.now()}`,
    name: newRule.value.name,
    conditions: [{ field: newRule.value.field, operator: newRule.value.operator, value: newRule.value.value }],
    strategy: newRule.value.strategy,
    priority: newRule.value.priority,
    enabled: true,
  })
  showAddRule.value = false
  newRule.value = { name: '', strategy: 'priority_override', priority: 50, field: 'type', operator: 'eq', value: '' }
}

function applyTemplate(template: typeof templates[0]) {
  ruleStore.addRule({
    id: `ar-tpl-${Date.now()}`,
    name: template.name,
    conditions: [{ field: 'type', operator: 'eq', value: 'security' }],
    strategy: template.strategy as any,
    priority: template.priority,
    enabled: true,
  })
}

function getWeightColor(w: number) {
  if (w >= 0.9) return 'text-rose-danger'
  if (w >= 0.7) return 'text-amber-alert'
  if (w >= 0.5) return 'text-cyan-glow'
  return 'text-[var(--text-secondary)]'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="section-title text-xl text-cyan-glow glow-text">规则引擎配置</h2>
      <span class="data-label">RULE ENGINE</span>
    </div>

    <div class="flex gap-2 border-b border-[var(--border-subtle)] pb-0">
      <button
        v-for="tab in [{ key: 'rules' as const, label: '仲裁规则' }, { key: 'templates' as const, label: '策略模板' }, { key: 'mappings' as const, label: '语义映射' }]"
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

    <div v-if="activeTab === 'rules'">
      <div class="flex justify-end mb-4">
        <button
          @click="showAddRule = !showAddRule"
          class="px-3 py-1.5 rounded text-xs bg-cyan-glow/20 text-cyan-glow hover:bg-cyan-glow/30 transition-all flex items-center gap-1.5"
        >
          <Plus class="w-3 h-3" />
          新增规则
        </button>
      </div>

      <div v-if="showAddRule" class="glass-card p-4 mb-4 space-y-3">
        <h4 class="section-title text-xs text-cyan-glow">新增仲裁规则</h4>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="data-label block mb-1">规则名称</label>
            <input v-model="newRule.name" class="w-full px-3 py-1.5 bg-dark-700 border border-[var(--border-subtle)] rounded text-xs text-[var(--text-primary)] focus:border-[var(--border-active)] outline-none" />
          </div>
          <div>
            <label class="data-label block mb-1">解析策略</label>
            <select v-model="newRule.strategy" class="w-full px-3 py-1.5 bg-dark-700 border border-[var(--border-subtle)] rounded text-xs text-[var(--text-secondary)] focus:border-[var(--border-active)] outline-none">
              <option v-for="(label, key) in strategyLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div>
            <label class="data-label block mb-1">优先级</label>
            <input v-model.number="newRule.priority" type="number" min="1" max="200" class="w-full px-3 py-1.5 bg-dark-700 border border-[var(--border-subtle)] rounded text-xs text-[var(--text-primary)] focus:border-[var(--border-active)] outline-none" />
          </div>
          <div>
            <label class="data-label block mb-1">条件字段</label>
            <select v-model="newRule.field" class="w-full px-3 py-1.5 bg-dark-700 border border-[var(--border-subtle)] rounded text-xs text-[var(--text-secondary)] focus:border-[var(--border-active)] outline-none">
              <option value="type">类型 (type)</option>
              <option value="severity">严重度 (severity)</option>
              <option value="source">来源 (source)</option>
            </select>
          </div>
          <div>
            <label class="data-label block mb-1">运算符</label>
            <select v-model="newRule.operator" class="w-full px-3 py-1.5 bg-dark-700 border border-[var(--border-subtle)] rounded text-xs text-[var(--text-secondary)] focus:border-[var(--border-active)] outline-none">
              <option v-for="(label, key) in operatorLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div>
            <label class="data-label block mb-1">匹配值</label>
            <input v-model="newRule.value" class="w-full px-3 py-1.5 bg-dark-700 border border-[var(--border-subtle)] rounded text-xs text-[var(--text-primary)] focus:border-[var(--border-active)] outline-none" />
          </div>
        </div>
        <div class="flex gap-2 justify-end">
          <button @click="showAddRule = false" class="px-3 py-1.5 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1">
            <X class="w-3 h-3" /> 取消
          </button>
          <button @click="addRule" class="px-3 py-1.5 rounded text-xs bg-cyan-glow/20 text-cyan-glow hover:bg-cyan-glow/30 flex items-center gap-1">
            <Save class="w-3 h-3" /> 保存
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <div
          v-for="rule in [...ruleStore.rules].sort((a, b) => b.priority - a.priority)"
          :key="rule.id"
          class="glass-card p-4"
          :class="!rule.enabled ? 'opacity-50' : ''"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
              <button @click="ruleStore.toggleRule(rule.id)" class="transition-all">
                <ToggleRight v-if="rule.enabled" class="w-5 h-5 text-emerald-ok" />
                <ToggleLeft v-else class="w-5 h-5 text-[var(--text-muted)]" />
              </button>
              <span class="text-sm font-medium">{{ rule.name }}</span>
              <span class="px-2 py-0.5 rounded text-[0.6rem]" :class="strategyColors[rule.strategy]">
                {{ strategyLabels[rule.strategy] }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span class="data-label">优先级</span>
              <span class="data-value text-sm" :class="rule.priority >= 90 ? 'text-amber-alert' : rule.priority >= 60 ? 'text-cyan-glow' : 'text-[var(--text-secondary)]'">{{ rule.priority }}</span>
              <button @click="ruleStore.removeRule(rule.id)" class="p-1 rounded hover:bg-rose-danger/10 text-[var(--text-muted)] hover:text-rose-danger transition-all">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span class="data-label">条件:</span>
            <span v-for="(cond, idx) in rule.conditions" :key="idx" class="flex items-center gap-1">
              <span class="font-mono">{{ cond.field }}</span>
              <span class="text-[var(--text-muted)]">{{ operatorLabels[cond.operator as string] ?? cond.operator }}</span>
              <span class="font-mono text-cyan-glow">{{ cond.value }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'templates'">
      <div class="grid grid-cols-2 gap-4">
        <div
          v-for="template in templates"
          :key="template.name"
          class="glass-card p-4 hover:border-[var(--border-active)] transition-all cursor-pointer"
          @click="applyTemplate(template)"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">{{ template.name }}</span>
            <span class="px-2 py-0.5 rounded text-[0.6rem]" :class="strategyColors[template.strategy]">
              {{ strategyLabels[template.strategy] }}
            </span>
          </div>
          <p class="text-xs text-[var(--text-secondary)]">{{ template.desc }}</p>
          <div class="mt-3 flex items-center justify-between">
            <span class="data-label">优先级: {{ template.priority }}</span>
            <span class="text-[0.6rem] text-cyan-glow">点击应用 →</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'mappings'">
      <div class="space-y-2">
        <div
          v-for="mapping in ruleStore.semanticMappings"
          :key="mapping.id"
          class="glass-card p-3"
        >
          <div class="flex items-center gap-4">
            <div class="flex-1 text-right">
              <span class="text-xs text-amber-alert font-medium">{{ mapping.securityTerm }}</span>
              <div class="text-[0.55rem] text-[var(--text-muted)]">安防术语</div>
            </div>
            <div class="w-px h-8 bg-[var(--border-subtle)]" />
            <div class="text-center min-w-24">
              <div class="text-xs text-emerald-ok font-medium">{{ mapping.unifiedSemantics }}</div>
              <div class="text-[0.55rem] text-[var(--text-muted)]">统一语义</div>
              <div class="mt-1">
                <span class="data-value text-[0.6rem]" :class="getWeightColor(mapping.priorityWeight)">{{ mapping.priorityWeight.toFixed(2) }}</span>
              </div>
            </div>
            <div class="w-px h-8 bg-[var(--border-subtle)]" />
            <div class="flex-1">
              <span class="text-xs text-cyan-glow font-medium">{{ mapping.homeControlTerm }}</span>
              <div class="text-[0.55rem] text-[var(--text-muted)]">家居术语</div>
            </div>
            <span class="px-2 py-0.5 rounded text-[0.55rem] bg-dark-600 text-[var(--text-muted)]">{{ mapping.category }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
