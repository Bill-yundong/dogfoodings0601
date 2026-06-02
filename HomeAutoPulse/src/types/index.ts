export interface SensorEvent {
  id: string
  sensorId: string
  type: 'security' | 'comfort' | 'energy' | 'safety'
  value: number
  unit: string
  timestamp: number
  source: 'security_system' | 'home_control'
  label: string
}

export interface ConflictRecord {
  id: string
  events: SensorEvent[]
  type: 'priority' | 'semantic' | 'timing' | 'resource'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'resolving' | 'resolved' | 'escalated'
  resolution?: ConflictResolution
  createdAt: number
  resolvedAt?: number
}

export interface ConflictResolution {
  strategy: 'priority_override' | 'merge' | 'defer' | 'conditional'
  winner: string
  actions: LinkageAction[]
  reasoning: string
}

export interface LinkageAction {
  id: string
  deviceId: string
  action: string
  params: Record<string, unknown>
  status: 'pending' | 'executing' | 'completed' | 'failed'
  timestamp: number
}

export interface DeviceSnapshot {
  id: string
  deviceId: string
  deviceName: string
  room: string
  type: string
  state: Record<string, unknown>
  timestamp: number
  triggerEvent?: string
}

export interface SmartDevice {
  id: string
  name: string
  room: string
  type: 'light' | 'lock' | 'camera' | 'thermostat' | 'sensor' | 'curtain' | 'alarm' | 'switch'
  source: 'security_system' | 'home_control'
  status: 'online' | 'offline' | 'warning' | 'error'
  state: Record<string, unknown>
  lastUpdate: number
}

export interface SemanticMapping {
  id: string
  securityTerm: string
  homeControlTerm: string
  unifiedSemantics: string
  category: string
  priorityWeight: number
}

export interface ArbitrationRule {
  id: string
  name: string
  conditions: RuleCondition[]
  strategy: ConflictResolution['strategy']
  priority: number
  enabled: boolean
}

export interface RuleCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'in'
  value: unknown
}

export interface LoopTrace {
  id: string
  conflictId: string
  steps: LoopStep[]
  startedAt: number
  completedAt?: number
  status: 'running' | 'completed' | 'failed'
}

export interface LoopStep {
  phase: 'sense' | 'align' | 'detect' | 'arbitrate' | 'execute' | 'verify'
  description: string
  timestamp: number
  data?: Record<string, unknown>
}

export type ConflictSeverity = ConflictRecord['severity']
export type ConflictStatus = ConflictRecord['status']
export type DeviceStatus = SmartDevice['status']
