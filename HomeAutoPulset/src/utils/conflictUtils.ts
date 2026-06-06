import type { Conflict, ConflictSeverity, ConflictType, ConflictStatus, StrategyType, ActionType } from '@/types/conflict';
import type { Device, SensorData } from '@/types/device';

export const getSeverityColor = (severity: ConflictSeverity): string => {
  const colors: Record<ConflictSeverity, string> = {
    critical: 'text-danger-red',
    high: 'text-alert-orange',
    medium: 'text-warning-amber',
    low: 'text-info-blue',
  };
  return colors[severity];
};

export const getSeverityBgColor = (severity: ConflictSeverity): string => {
  const colors: Record<ConflictSeverity, string> = {
    critical: 'bg-danger-red/20',
    high: 'bg-alert-orange/20',
    medium: 'bg-warning-amber/20',
    low: 'bg-info-blue/20',
  };
  return colors[severity];
};

export const getSeverityTagClass = (severity: ConflictSeverity): string => {
  const classes: Record<ConflictSeverity, string> = {
    critical: 'tag-critical',
    high: 'tag-high',
    medium: 'tag-medium',
    low: 'tag-low',
  };
  return classes[severity];
};

export const getStatusColor = (status: ConflictStatus): string => {
  const colors: Record<ConflictStatus, string> = {
    detected: 'text-danger-red',
    pending: 'text-warning-amber',
    resolving: 'text-neon-purple',
    resolved: 'text-success-green',
    ignored: 'text-slate-light',
  };
  return colors[status];
};

export const getStatusText = (status: ConflictStatus): string => {
  const texts: Record<ConflictStatus, string> = {
    detected: '已检测',
    pending: '待处理',
    resolving: '解析中',
    resolved: '已解决',
    ignored: '已忽略',
  };
  return texts[status];
};

export const getStatusTagClass = (status: ConflictStatus): string => {
  const classes: Record<ConflictStatus, string> = {
    detected: 'tag-critical',
    pending: 'tag-medium',
    resolving: 'tag-pending',
    resolved: 'tag-success',
    ignored: 'tag-low',
  };
  return classes[status];
};

export const getConflictTypeText = (type: ConflictType): string => {
  const texts: Record<ConflictType, string> = {
    security_vs_comfort: '安防 vs 舒适',
    energy_vs_comfort: '节能 vs 舒适',
    scene_conflict: '场景冲突',
    rule_contradiction: '规则矛盾',
  };
  return texts[type];
};

export const getConflictTypeIcon = (type: ConflictType): string => {
  const icons: Record<ConflictType, string> = {
    security_vs_comfort: 'ShieldAlert',
    energy_vs_comfort: 'Zap',
    scene_conflict: 'Layers',
    rule_contradiction: 'GitBranch',
  };
  return icons[type];
};

export const getSeverityText = (severity: ConflictSeverity): string => {
  const texts: Record<ConflictSeverity, string> = {
    critical: '严重',
    high: '高危',
    medium: '中等',
    low: '轻微',
  };
  return texts[severity];
};

export const getSeverityPriority = (severity: ConflictSeverity): number => {
  const priorities: Record<ConflictSeverity, number> = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25,
  };
  return priorities[severity];
};

export const detectConflict = (
  sensorData: SensorData,
  securityState: Record<string, any>,
  homeControlState: Record<string, any>,
  devices: Device[]
): Conflict | null => {
  const { sensorType, value, location, deviceId } = sensorData;

  if (sensorType === 'door' && value === true) {
    const securityArmed = securityState.armed;
    const acRunning = homeControlState.airConditioning?.running;

    if (securityArmed && acRunning) {
      return createConflict({
        type: 'security_vs_comfort',
        severity: 'high',
        sourceDevices: [deviceId],
        targetDevices: devices.filter(d => d.systemAffiliation === 'both').map(d => d.id),
        triggerEvent: 'door_opened_while_armed',
        description: '安防系统已布防但检测到门被打开，同时空调正在运行，存在安全隐患',
        affectedScenes: ['away', 'security'],
        potentialRisk: '非法入侵可能导致财产损失，同时造成能源浪费',
      });
    }
  }

  if (sensorType === 'temperature' && typeof value === 'number') {
    const targetTemp = homeControlState.airConditioning?.targetTemperature || 24;
    const ecoMode = homeControlState.energySaving?.enabled;

    if (ecoMode && Math.abs(value - targetTemp) > 3 && targetTemp < 20) {
      return createConflict({
        type: 'energy_vs_comfort',
        severity: 'low',
        sourceDevices: [deviceId],
        targetDevices: devices.filter(d => d.type === 'energy' || d.type === 'comfort').map(d => d.id),
        triggerEvent: 'temperature_deviation_in_eco_mode',
        description: '节能模式下温度偏差过大，舒适度与节能目标存在冲突',
        affectedScenes: ['home', 'dinner'],
        potentialRisk: '用户体验下降，设备频繁启停导致能耗增加',
      });
    }
  }

  if (sensorType === 'motion' && value === true) {
    const sleepMode = homeControlState.scene === 'sleep';
    const securityMode = securityState.scene === 'security';

    if (sleepMode && securityMode) {
      return createConflict({
        type: 'scene_conflict',
        severity: 'critical',
        sourceDevices: [deviceId],
        targetDevices: devices.filter(d => d.systemAffiliation !== 'homeControl').map(d => d.id),
        triggerEvent: 'motion_detected_in_sleep_security_mode',
        description: '睡眠模式和安防模式同时激活时检测到移动，场景设定存在矛盾',
        affectedScenes: ['sleep', 'security'],
        potentialRisk: '错误的场景配置可能导致安全警报误触发或安防失效',
      });
    }
  }

  return null;
};

const createConflict = (data: Partial<Conflict> & {
  type: ConflictType;
  severity: ConflictSeverity;
  sourceDevices: string[];
  targetDevices: string[];
  triggerEvent: string;
  description: string;
  affectedScenes: string[];
  potentialRisk: string;
}): Conflict => {
  const now = Date.now();
  return {
    id: `conflict_${now}_${Math.random().toString(36).substr(2, 9)}`,
    type: data.type,
    severity: data.severity,
    status: 'detected',
    detectedAt: now,
    sourceDevices: data.sourceDevices,
    targetDevices: data.targetDevices,
    triggerEvent: data.triggerEvent,
    description: data.description,
    resolutionHistory: [],
    affectedScenes: data.affectedScenes,
    potentialRisk: data.potentialRisk,
  };
};

export const calculateResolutionTime = (conflict: Conflict): number | null => {
  if (!conflict.resolvedAt) return null;
  return conflict.resolvedAt - conflict.detectedAt;
};

export const calculateHealthScore = (
  conflictCount: number,
  avgResolutionTime: number,
  pendingConflicts: number,
  criticalCount: number
): number => {
  let score = 100;

  score -= Math.min(criticalCount * 10, 30);
  score -= Math.min(pendingConflicts * 3, 20);
  score -= Math.min(conflictCount * 0.5, 25);
  score -= Math.min(avgResolutionTime / 60000, 25);

  return Math.max(0, Math.min(100, score));
};

export const getHealthScoreColor = (score: number): string => {
  if (score >= 90) return 'text-success-green';
  if (score >= 70) return 'text-warning-amber';
  if (score >= 50) return 'text-alert-orange';
  return 'text-danger-red';
};

export const getHealthScoreBgColor = (score: number): string => {
  if (score >= 90) return 'from-success-green/20 to-success-green/5';
  if (score >= 70) return 'from-warning-amber/20 to-warning-amber/5';
  if (score >= 50) return 'from-alert-orange/20 to-alert-orange/5';
  return 'from-danger-red/20 to-danger-red/5';
};

export const getStrategyTypeText = (type: StrategyType): string => {
  const texts: Record<StrategyType, string> = {
    security_first: '安防优先',
    comfort_first: '舒适优先',
    energy_first: '节能优先',
    balanced: '平衡策略',
    user_override: '用户手动',
  };
  return texts[type];
};

export const getStrategyTypeIcon = (type: StrategyType): string => {
  const icons: Record<StrategyType, string> = {
    security_first: 'ShieldCheck',
    comfort_first: 'Home',
    energy_first: 'Leaf',
    balanced: 'Scale',
    user_override: 'User',
  };
  return icons[type];
};

export const getStrategyTypeColor = (type: StrategyType): string => {
  const colors: Record<StrategyType, string> = {
    security_first: 'text-cyber-teal',
    comfort_first: 'text-success-green',
    energy_first: 'text-neon-purple',
    balanced: 'text-warning-amber',
    user_override: 'text-alert-orange',
  };
  return colors[type];
};

export const getActionTypeText = (type: ActionType): string => {
  const texts: Record<ActionType, string> = {
    set_state: '设置状态',
    delay: '延迟执行',
    notify: '发送通知',
    pause_rule: '暂停规则',
  };
  return texts[type];
};

export const getActionTypeIcon = (type: ActionType): string => {
  const icons: Record<ActionType, string> = {
    set_state: 'ToggleRight',
    delay: 'Clock',
    notify: 'Bell',
    pause_rule: 'PauseCircle',
  };
  return icons[type];
};
