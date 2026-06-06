export type ConflictType = 'security_vs_comfort' | 'energy_vs_comfort' | 'scene_conflict' | 'rule_contradiction';

export type ConflictSeverity = 'critical' | 'high' | 'medium' | 'low';

export type ConflictStatus = 'detected' | 'pending' | 'resolving' | 'resolved' | 'ignored';

export type StrategyType = 'security_first' | 'comfort_first' | 'energy_first' | 'balanced' | 'user_override';

export type ActionType = 'set_state' | 'delay' | 'notify' | 'pause_rule';

export type ActionStatus = 'pending' | 'executing' | 'completed' | 'failed';

export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ResolutionAction {
  id: string;
  deviceId: string;
  actionType: ActionType;
  parameters: Record<string, any>;
  status: ActionStatus;
  executedAt?: number;
}

export interface ResolutionStep {
  id: string;
  timestamp: number;
  action: string;
  result: string;
  operator: string;
}

export interface ResolutionStrategy {
  id: string;
  name: string;
  priority: number;
  type: StrategyType;
  actions: ResolutionAction[];
  timeout: number;
  description: string;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  status: ConflictStatus;
  detectedAt: number;
  resolvedAt?: number;
  sourceDevices: string[];
  targetDevices: string[];
  triggerEvent: string;
  description: string;
  resolutionStrategy?: ResolutionStrategy;
  resolutionHistory: ResolutionStep[];
  affectedScenes: string[];
  potentialRisk: string;
}

export interface AsyncTask {
  id: string;
  conflictId: string;
  priority: number;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  progress: number;
  retryCount: number;
  error?: string;
  currentStep?: string;
}

export interface ConflictStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  pending: number;
  resolving: number;
  avgResolutionTime: number;
}
