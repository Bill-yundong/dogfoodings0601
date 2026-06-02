import type { SensorEvent, ConflictRecord, ArbitrationRule, ConflictResolution, LinkageAction, LoopTrace, LoopStep } from '@/types'
import { SemanticAligner } from './SemanticAligner'
import { saveConflict, saveLinkageAction } from '@/db'

const DEFAULT_RULES: ArbitrationRule[] = [
  { id: 'ar-1', name: '安防优先策略', conditions: [{ field: 'type', operator: 'eq', value: 'security' }], strategy: 'priority_override', priority: 100, enabled: true },
  { id: 'ar-2', name: '安全类合并策略', conditions: [{ field: 'type', operator: 'eq', value: 'safety' }], strategy: 'merge', priority: 90, enabled: true },
  { id: 'ar-3', name: '舒适类延迟策略', conditions: [{ field: 'type', operator: 'eq', value: 'comfort' }], strategy: 'defer', priority: 50, enabled: true },
  { id: 'ar-4', name: '节能条件策略', conditions: [{ field: 'type', operator: 'eq', value: 'energy' }], strategy: 'conditional', priority: 60, enabled: true },
  { id: 'ar-5', name: '紧急事件优先', conditions: [{ field: 'severity', operator: 'eq', value: 'critical' }], strategy: 'priority_override', priority: 200, enabled: true },
]

let conflictCounter = 0
let actionCounter = 0
let traceCounter = 0

function genConflictId(): string {
  return `conflict-${Date.now()}-${++conflictCounter}`
}

function genActionId(): string {
  return `action-${Date.now()}-${++actionCounter}`
}

function genTraceId(): string {
  return `trace-${Date.now()}-${++traceCounter}`
}

export class ConflictDetector {
  private aligner: SemanticAligner
  private recentEvents: SensorEvent[] = []
  private maxRecent = 50

  constructor(aligner: SemanticAligner) {
    this.aligner = aligner
  }

  ingest(event: SensorEvent): ConflictRecord | null {
    this.recentEvents.push(event)
    if (this.recentEvents.length > this.maxRecent) {
      this.recentEvents = this.recentEvents.slice(-this.maxRecent)
    }
    for (const prev of this.recentEvents.slice(0, -1)) {
      if (prev.source !== event.source && this.aligner.checkConflict(prev, event)) {
        const timeDiff = Math.abs(event.timestamp - prev.timestamp)
        if (timeDiff < 30000) {
          return this.createConflict(prev, event)
        }
      }
    }
    return null
  }

  private createConflict(eventA: SensorEvent, eventB: SensorEvent): ConflictRecord {
    const severity = this.determineSeverity(eventA, eventB)
    const type = this.determineType(eventA, eventB)
    const conflict: ConflictRecord = {
      id: genConflictId(),
      events: [eventA, eventB],
      type,
      severity,
      status: 'pending',
      createdAt: Date.now(),
    }
    saveConflict(conflict)
    return conflict
  }

  private determineSeverity(a: SensorEvent, b: SensorEvent): ConflictRecord['severity'] {
    if (a.type === 'safety' || b.type === 'safety') return 'critical'
    if (a.type === 'security' || b.type === 'security') return 'high'
    if (a.type === 'energy' && b.type === 'energy') return 'medium'
    return 'low'
  }

  private determineType(a: SensorEvent, b: SensorEvent): ConflictRecord['type'] {
    const alignA = this.aligner.align(a)
    const alignB = this.aligner.align(b)
    if (alignA.category === alignB.category) return 'semantic'
    const timeDiff = Math.abs(a.timestamp - b.timestamp)
    if (timeDiff < 5000) return 'timing'
    return 'priority'
  }
}

export class AsyncConflictQueue {
  private queue: ConflictRecord[] = []
  private processing = false
  private rules: ArbitrationRule[] = [...DEFAULT_RULES]
  private onResolved: ((conflict: ConflictRecord, trace: LoopTrace) => void) | null = null

  setRules(rules: ArbitrationRule[]): void {
    this.rules = rules.sort((a, b) => b.priority - a.priority)
  }

  setOnResolved(cb: (conflict: ConflictRecord, trace: LoopTrace) => void): void {
    this.onResolved = cb
  }

  enqueue(conflict: ConflictRecord): void {
    this.queue.push(conflict)
    this.queue.sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
      return (sevOrder[b.severity] ?? 0) - (sevOrder[a.severity] ?? 0)
    })
    if (!this.processing) {
      this.processNext()
    }
  }

  getQueue(): ConflictRecord[] {
    return [...this.queue]
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false
      return
    }
    this.processing = true
    const conflict = this.queue.shift()!
    conflict.status = 'resolving'
    saveConflict(conflict)

    await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000))

    const trace = this.buildTrace(conflict)
    const resolution = this.resolve(conflict, trace)
    conflict.resolution = resolution
    conflict.status = 'resolved'
    conflict.resolvedAt = Date.now()
    trace.completedAt = Date.now()
    trace.status = 'completed'

    saveConflict(conflict)
    resolution.actions.forEach((a) => saveLinkageAction(a))

    if (this.onResolved) {
      this.onResolved(conflict, trace)
    }

    this.processNext()
  }

  private buildTrace(conflict: ConflictRecord): LoopTrace {
    const now = Date.now()
    const steps: LoopStep[] = [
      { phase: 'sense', description: `传感器事件感知: ${conflict.events.map((e) => e.label).join(', ')}`, timestamp: now - 3000, data: { eventIds: conflict.events.map((e) => e.id) } },
      { phase: 'align', description: `语义对齐: ${conflict.events.map((e) => e.label).join(' → ')}`, timestamp: now - 2000 },
      { phase: 'detect', description: `冲突检测: 类型=${conflict.type}, 严重度=${conflict.severity}`, timestamp: now - 1500 },
      { phase: 'arbitrate', description: `规则匹配与仲裁中...`, timestamp: now - 1000 },
      { phase: 'execute', description: `联动动作执行中...`, timestamp: now - 500 },
      { phase: 'verify', description: `闭环验证...`, timestamp: now },
    ]
    return { id: genTraceId(), conflictId: conflict.id, steps, startedAt: now - 3000, status: 'running' }
  }

  private resolve(conflict: ConflictRecord, trace: LoopTrace): ConflictResolution {
    const sortedRules = this.rules.filter((r) => r.enabled).sort((a, b) => b.priority - a.priority)
    let matchedRule = sortedRules[0]
    for (const rule of sortedRules) {
      for (const cond of rule.conditions) {
        for (const evt of conflict.events) {
          const fieldValue = (evt as unknown as Record<string, unknown>)[cond.field]
          if (this.matchCondition(fieldValue, cond)) {
            matchedRule = rule
            break
          }
        }
      }
    }

    const winner = conflict.events.reduce((prev, curr) => {
      const prevType = prev.type === 'security' || prev.type === 'safety' ? 1 : 0
      const currType = curr.type === 'security' || curr.type === 'safety' ? 1 : 0
      return currType > prevType ? curr : prev
    })

    const actions: LinkageAction[] = conflict.events.map((evt) => ({
      id: genActionId(),
      deviceId: evt.sensorId,
      action: matchedRule.strategy === 'priority_override' ? 'override' : matchedRule.strategy === 'defer' ? 'delay' : 'execute',
      params: { originalValue: evt.value, resolvedValue: winner.value },
      status: 'completed' as const,
      timestamp: Date.now(),
    }))

    const arbitrateStep = trace.steps.find((s) => s.phase === 'arbitrate')!
    arbitrateStep.description = `仲裁完成: 匹配规则「${matchedRule.name}」, 策略=${matchedRule.strategy}`
    const executeStep = trace.steps.find((s) => s.phase === 'execute')!
    executeStep.description = `执行${actions.length}个联动动作`
    const verifyStep = trace.steps.find((s) => s.phase === 'verify')!
    verifyStep.description = `闭环验证通过, 胜出方: ${winner.label}`

    return {
      strategy: matchedRule.strategy,
      winner: winner.id,
      actions,
      reasoning: `根据规则「${matchedRule.name}」(优先级=${matchedRule.priority}), 采用${matchedRule.strategy}策略. ${winner.label}优先执行.`,
    }
  }

  private matchCondition(fieldValue: unknown, cond: ArbitrationRule['conditions'][0]): boolean {
    switch (cond.operator) {
      case 'eq': return fieldValue === cond.value
      case 'neq': return fieldValue !== cond.value
      case 'gt': return Number(fieldValue) > Number(cond.value)
      case 'lt': return Number(fieldValue) < Number(cond.value)
      case 'contains': return String(fieldValue).includes(String(cond.value))
      case 'in': return Array.isArray(cond.value) && cond.value.includes(fieldValue)
      default: return false
    }
  }
}

export class SensorSimulator {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private onEvent: ((event: SensorEvent) => void) | null = null
  private eventCounter = 0

  private readonly templates: Array<Omit<SensorEvent, 'id' | 'timestamp' | 'value'>> = [
    { sensorId: 'sec-door-01', type: 'security', unit: 'bool', source: 'security_system', label: '入侵警报' },
    { sensorId: 'sec-motion-01', type: 'security', unit: 'bool', source: 'security_system', label: '移动侦测' },
    { sensorId: 'sec-door-02', type: 'security', unit: 'bool', source: 'security_system', label: '门窗传感器' },
    { sensorId: 'sec-smoke-01', type: 'safety', unit: 'ppm', source: 'security_system', label: '烟感报警' },
    { sensorId: 'sec-button-01', type: 'safety', unit: 'bool', source: 'security_system', label: '紧急按钮' },
    { sensorId: 'home-light-01', type: 'comfort', unit: '%', source: 'home_control', label: '迎宾模式' },
    { sensorId: 'home-scene-01', type: 'comfort', unit: 'bool', source: 'home_control', label: '回家场景' },
    { sensorId: 'home-scene-02', type: 'comfort', unit: 'bool', source: 'home_control', label: '离家场景' },
    { sensorId: 'home-ac-01', type: 'energy', unit: '°C', source: 'home_control', label: '空调联动' },
    { sensorId: 'home-curtain-01', type: 'comfort', unit: '%', source: 'home_control', label: '自动化场景' },
    { sensorId: 'home-shutoff-01', type: 'safety', unit: 'bool', source: 'home_control', label: '全屋关断' },
    { sensorId: 'home-vent-01', type: 'energy', unit: 'rpm', source: 'home_control', label: '通风系统' },
  ]

  start(onEvent: (event: SensorEvent) => void, intervalMs: number = 3000): void {
    this.onEvent = onEvent
    this.intervalId = setInterval(() => {
      const event = this.generate()
      if (event && this.onEvent) this.onEvent(event)
    }, intervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private generate(): SensorEvent | null {
    const template = this.templates[Math.floor(Math.random() * this.templates.length)]
    const value = template.unit === 'bool' ? (Math.random() > 0.5 ? 1 : 0) : Math.round(Math.random() * 100 * 10) / 10
    return {
      id: `evt-${Date.now()}-${++this.eventCounter}`,
      sensorId: template.sensorId,
      type: template.type,
      value,
      unit: template.unit,
      timestamp: Date.now(),
      source: template.source,
      label: template.label,
    }
  }
}
