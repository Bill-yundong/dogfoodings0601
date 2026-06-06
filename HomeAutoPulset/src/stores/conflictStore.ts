import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useConflictEngine } from '@/composables/useConflictEngine';

export const useConflictStore = defineStore('conflict', () => {
  const engine = useConflictEngine();

  const conflicts = engine.conflicts;
  const selectedConflict = engine.selectedConflict;
  const stats = engine.stats;
  const healthScore = engine.healthScore;
  const activeConflicts = engine.activeConflicts;
  const resolvedConflicts = engine.resolvedConflicts;
  const criticalConflicts = engine.criticalConflicts;
  const highConflicts = engine.highConflicts;
  const taskQueue = engine.taskQueue;
  const processingTasks = engine.processingTasks;
  const completedTasks = engine.completedTasks;
  const failedTasks = engine.failedTasks;
  const isPaused = engine.isPaused;
  const pendingCount = engine.pendingCount;
  const processingCount = engine.processingCount;
  const securityState = engine.securityState;
  const homeControlState = engine.homeControlState;
  const strategies = engine.strategies;

  const criticalCount = computed(() => criticalConflicts.value.length);
  const activeCount = computed(() => activeConflicts.value.length);
  const resolvedCount = computed(() => resolvedConflicts.value.length);

  const init = async () => {
    await engine.loadConflicts();
  };

  const resolveConflict = async (conflictId: string, strategyType?: string) => {
    await engine.resolveConflict(conflictId, strategyType);
  };

  const ignoreConflict = (conflictId: string) => {
    engine.ignoreConflict(conflictId);
  };

  const generateTestConflict = (severity?: 'critical' | 'high' | 'medium' | 'low') => {
    return engine.generateTestConflict(severity);
  };

  const setSelectedConflict = engine.setSelectedConflict;

  const updateSecurityState = engine.updateSecurityState;
  const updateHomeControlState = engine.updateHomeControlState;

  const setDevices = engine.setDevices;

  const pauseResolution = engine.pauseResolution;
  const resumeResolution = engine.resumeResolution;

  const retryTask = engine.retryTask;

  return {
    conflicts,
    selectedConflict,
    stats,
    healthScore,
    activeConflicts,
    resolvedConflicts,
    criticalConflicts,
    highConflicts,
    taskQueue,
    processingTasks,
    completedTasks,
    failedTasks,
    isPaused,
    pendingCount,
    processingCount,
    securityState,
    homeControlState,
    strategies,
    criticalCount,
    activeCount,
    resolvedCount,
    init,
    resolveConflict,
    ignoreConflict,
    generateTestConflict,
    setSelectedConflict,
    updateSecurityState,
    updateHomeControlState,
    setDevices,
    pauseResolution,
    resumeResolution,
    retryTask,
    detectAndProcess: engine.detectAndProcess,
    getSeverityText: engine.getSeverityText,
    addStrategy: engine.addStrategy,
    updateStrategy: engine.updateStrategy,
  };
});
