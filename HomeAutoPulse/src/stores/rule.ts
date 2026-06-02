import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ArbitrationRule, SemanticMapping } from '@/types'
import { semanticAligner } from '@/engine/SemanticAligner'

export const useRuleStore = defineStore('rule', () => {
  const rules = ref<ArbitrationRule[]>([
    { id: 'ar-1', name: '安防优先策略', conditions: [{ field: 'type', operator: 'eq', value: 'security' }], strategy: 'priority_override', priority: 100, enabled: true },
    { id: 'ar-2', name: '安全类合并策略', conditions: [{ field: 'type', operator: 'eq', value: 'safety' }], strategy: 'merge', priority: 90, enabled: true },
    { id: 'ar-3', name: '舒适类延迟策略', conditions: [{ field: 'type', operator: 'eq', value: 'comfort' }], strategy: 'defer', priority: 50, enabled: true },
    { id: 'ar-4', name: '节能条件策略', conditions: [{ field: 'type', operator: 'eq', value: 'energy' }], strategy: 'conditional', priority: 60, enabled: true },
    { id: 'ar-5', name: '紧急事件优先', conditions: [{ field: 'severity', operator: 'eq', value: 'critical' }], strategy: 'priority_override', priority: 200, enabled: true },
  ])

  const semanticMappings = ref<SemanticMapping[]>(semanticAligner.getMappings())

  function addRule(rule: ArbitrationRule) {
    rules.value.push(rule)
  }

  function updateRule(id: string, updates: Partial<ArbitrationRule>) {
    const idx = rules.value.findIndex((r) => r.id === id)
    if (idx !== -1) rules.value[idx] = { ...rules.value[idx], ...updates }
  }

  function removeRule(id: string) {
    rules.value = rules.value.filter((r) => r.id !== id)
  }

  function toggleRule(id: string) {
    const rule = rules.value.find((r) => r.id === id)
    if (rule) rule.enabled = !rule.enabled
  }

  function addMapping(mapping: SemanticMapping) {
    semanticMappings.value.push(mapping)
    semanticAligner.addMapping(mapping)
  }

  function updateMapping(id: string, updates: Partial<SemanticMapping>) {
    const idx = semanticMappings.value.findIndex((m) => m.id === id)
    if (idx !== -1) semanticMappings.value[idx] = { ...semanticMappings.value[idx], ...updates }
  }

  return { rules, semanticMappings, addRule, updateRule, removeRule, toggleRule, addMapping, updateMapping }
})
