import { ref, computed } from 'vue';
import type { Conflict, ConflictStats, ResolutionStrategy, ResolutionStep, AsyncTask } from '@/types/conflict';
import type { SensorData, Device } from '@/types/device';
import { detectConflict, getSeverityPriority, calculateHealthScore, getSeverityText } from '@/utils/conflictUtils';
import { generateMockConflict, mockResolutionStrategies } from '@/utils/mockData';
import { useAsyncQueue } from './useAsyncQueue';
import { indexedDBService } from '@/utils/indexedDB';

export function useConflictEngine() {
  const conflicts = ref<Conflict[]>([]);
  const strategies = ref<ResolutionStrategy[]>([...mockResolutionStrategies]);
  const selectedConflict = ref<Conflict | null>(null);
  const securityState = ref({
    armed: true,
    scene: 'home',
    alertLevel: 'low',
    doorsLocked: true,
    camerasActive: true,
    alarmTriggered: false,
  });
  const homeControlState = ref({
    scene: 'home',
    activeScene: '在家模式',
    temperature: 24,
    acOn: true,
    lightsOn: true,
    curtainsOpen: false,
    musicPlaying: false,
    airConditioning: {
      running: true,
      targetTemperature: 24,
    },
    energySaving: {
      enabled: false,
    },
  });
  const devices = ref<Device[]>([]);

  const {
    queue: taskQueue,
    processing: processingTasks,
    completed: completedTasks,
    failed: failedTasks,
    enqueue,
    retryTask,
    pause,
    resume,
    isPaused,
    pendingCount,
    processingCount,
  } = useAsyncQueue(3);

  const activeConflicts = computed(() =>
    conflicts.value.filter(c => c.status !== 'resolved' && c.status !== 'ignored')
  );

  const resolvedConflicts = computed(() =>
    conflicts.value.filter(c => c.status === 'resolved')
  );

  const criticalConflicts = computed(() =>
    activeConflicts.value.filter(c => c.severity === 'critical')
  );

  const highConflicts = computed(() =>
    activeConflicts.value.filter(c => c.severity === 'high')
  );

  const stats = computed<ConflictStats>(() => {
    const total = conflicts.value.length;
    const resolved = resolvedConflicts.value.length;
    const pending = conflicts.value.filter(c => c.status === 'pending' || c.status === 'detected').length;
    const resolving = conflicts.value.filter(c => c.status === 'resolving').length;

    const resolutionTimes = conflicts.value
      .filter(c => c.resolvedAt)
      .map(c => c.resolvedAt! - c.detectedAt);

    const avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

    return {
      total,
      critical: conflicts.value.filter(c => c.severity === 'critical').length,
      high: conflicts.value.filter(c => c.severity === 'high').length,
      medium: conflicts.value.filter(c => c.severity === 'medium').length,
      low: conflicts.value.filter(c => c.severity === 'low').length,
      resolved,
      pending,
      resolving,
      avgResolutionTime,
    };
  });

  const healthScore = computed(() => {
    return calculateHealthScore(
      stats.value.total,
      stats.value.avgResolutionTime,
      stats.value.pending,
      stats.value.critical
    );
  });

  const loadConflicts = async (limit: number = 100) => {
    try {
      await indexedDBService.init();
      const savedConflicts = await indexedDBService.getConflicts(limit);
      if (savedConflicts.length > 0) {
        conflicts.value = savedConflicts;
      }
    } catch (e) {
      console.error('加载冲突历史失败:', e);
    }
  };

  const saveConflict = async (conflict: Conflict) => {
    try {
      await indexedDBService.init();
      const plainConflict = JSON.parse(JSON.stringify(conflict));
      await indexedDBService.saveConflict(plainConflict);
    } catch (e) {
      console.error('保存冲突失败:', e);
    }
  };

  const detectAndProcess = (sensorData: SensorData): Conflict | null => {
    const conflict = detectConflict(sensorData, securityState.value, homeControlState.value, devices.value);

    if (conflict) {
      addConflict(conflict);
      return conflict;
    }

    return null;
  };

  const addConflict = (conflict: Conflict) => {
    conflicts.value = [conflict, ...conflicts.value];
    saveConflict(conflict);

    const strategy = selectStrategy(conflict);
    if (strategy) {
      conflict.resolutionStrategy = strategy;
      enqueueConflict(conflict);
    }
  };

  const selectStrategy = (conflict: Conflict): ResolutionStrategy | undefined => {
    const applicableStrategies = strategies.value.filter(s => {
      if (s.type === 'security_first' && conflict.type === 'security_vs_comfort') return true;
      if (s.type === 'energy_first' && conflict.type === 'energy_vs_comfort') return true;
      if (s.type === 'user_override') return true;
      return false;
    });

    if (applicableStrategies.length === 0) {
      return strategies.value.find(s => s.type === 'security_first');
    }

    return applicableStrategies.sort((a, b) => b.priority - a.priority)[0];
  };

  const enqueueConflict = (conflict: Conflict): AsyncTask => {
    const priority = getSeverityPriority(conflict.severity);
    return enqueue({
      conflictId: conflict.id,
      priority,
    });
  };

  const resolveConflict = async (conflictId: string, strategyType?: string) => {
    const conflict = conflicts.value.find(c => c.id === conflictId);
    if (!conflict) return;

    conflict.status = 'resolving';

    const strategy = strategyType
      ? strategies.value.find(s => s.type === strategyType)
      : conflict.resolutionStrategy;

    if (strategy) {
      conflict.resolutionStrategy = strategy;
      conflict.resolutionHistory.push({
        id: `step_${Date.now()}`,
        timestamp: Date.now(),
        action: `应用策略: ${strategy.name}`,
        result: '正在执行解析动作...',
        operator: 'system',
      });

      try {
        await executeStrategy(strategy, conflict);

        conflict.status = 'resolved';
        conflict.resolvedAt = Date.now();
        conflict.resolutionHistory.push({
          id: `step_${Date.now()}`,
          timestamp: Date.now(),
          action: '冲突解析完成',
          result: '已成功解决冲突',
          operator: 'system',
        });
      } catch (e) {
        conflict.status = 'pending';
        conflict.resolutionHistory.push({
          id: `step_${Date.now()}`,
          timestamp: Date.now(),
          action: '解析失败',
          result: e instanceof Error ? e.message : '未知错误',
          operator: 'system',
        });
      }
    } else {
      conflict.status = 'pending';
    }

    saveConflict(conflict);
  };

  const executeStrategy = async (strategy: ResolutionStrategy, conflict: Conflict): Promise<void> => {
    for (const action of strategy.actions) {
      action.status = 'executing';

      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      if (action.actionType === 'notify') {
        console.log('通知:', action.parameters.message);
      } else if (action.actionType === 'set_state') {
        if (action.parameters.target === 'security') {
          securityState.value = {
            ...securityState.value,
            ...action.parameters.state,
          };
        } else if (action.parameters.target === 'homeControl') {
          homeControlState.value = {
            ...homeControlState.value,
            ...action.parameters.state,
          };
        }
      }

      action.status = 'completed';
      action.executedAt = Date.now();

      conflict.resolutionHistory.push({
        id: `step_${Date.now()}`,
        timestamp: Date.now(),
        action: `执行动作: ${action.actionType}`,
        result: `设备 ${action.deviceId} 状态已更新`,
        operator: 'system',
      });
    }
  };

  const ignoreConflict = (conflictId: string) => {
    const conflict = conflicts.value.find(c => c.id === conflictId);
    if (conflict) {
      conflict.status = 'ignored';
      conflict.resolutionHistory.push({
        id: `step_${Date.now()}`,
        timestamp: Date.now(),
        action: '用户忽略冲突',
        result: '冲突已被标记为忽略',
        operator: 'user',
      });
      saveConflict(conflict);
    }
  };

  const generateTestConflict = (severity?: 'critical' | 'high' | 'medium' | 'low') => {
    const conflict = generateMockConflict(severity);
    addConflict(conflict);
    return conflict;
  };

  const setSelectedConflict = (conflict: Conflict | null) => {
    selectedConflict.value = conflict;
  };

  const updateSecurityState = (updates: Partial<typeof securityState.value>) => {
    securityState.value = { ...securityState.value, ...updates };
  };

  const updateHomeControlState = (updates: Partial<typeof homeControlState.value>) => {
    homeControlState.value = { ...homeControlState.value, ...updates };
  };

  const setDevices = (deviceList: Device[]) => {
    devices.value = deviceList;
  };

  const addResolutionStep = (conflictId: string, step: Omit<ResolutionStep, 'id' | 'timestamp'>) => {
    const conflict = conflicts.value.find(c => c.id === conflictId);
    if (conflict) {
      conflict.resolutionHistory.push({
        ...step,
        id: `step_${Date.now()}`,
        timestamp: Date.now(),
      });
      saveConflict(conflict);
    }
  };

  const getConflictsByType = (type: string) => {
    return conflicts.value.filter(c => c.type === type);
  };

  const getConflictsBySeverity = (severity: string) => {
    return conflicts.value.filter(c => c.severity === severity);
  };

  const getConflictsByStatus = (status: string) => {
    return conflicts.value.filter(c => c.status === status);
  };

  const addStrategy = (strategy: Omit<ResolutionStrategy, 'id'>): ResolutionStrategy => {
    const newStrategy: ResolutionStrategy = {
      ...strategy,
      id: `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    strategies.value.push(newStrategy);
    return newStrategy;
  };

  const updateStrategy = (id: string, updates: Partial<ResolutionStrategy>) => {
    const index = strategies.value.findIndex(s => s.id === id);
    if (index !== -1) {
      strategies.value[index] = { ...strategies.value[index], ...updates };
    }
  };

  return {
    conflicts,
    strategies,
    selectedConflict,
    securityState,
    homeControlState,
    taskQueue,
    processingTasks,
    completedTasks,
    failedTasks,
    activeConflicts,
    resolvedConflicts,
    criticalConflicts,
    highConflicts,
    stats,
    healthScore,
    isPaused,
    pendingCount,
    processingCount,
    loadConflicts,
    detectAndProcess,
    addConflict,
    resolveConflict,
    ignoreConflict,
    generateTestConflict,
    setSelectedConflict,
    updateSecurityState,
    updateHomeControlState,
    setDevices,
    addResolutionStep,
    getConflictsByType,
    getConflictsBySeverity,
    getConflictsByStatus,
    enqueueConflict,
    retryTask,
    pauseResolution: pause,
    resumeResolution: resume,
    addStrategy,
    updateStrategy,
    getSeverityText,
  };
}
