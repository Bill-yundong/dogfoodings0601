import { ref, computed } from 'vue';
import type { SensorData, AlignedData, FusedData } from '@/types/device';
import type { SemanticMapping, Scene, SemanticAlignmentResult, ResolvedSemantics, ContextTransition } from '@/types/semantic';
import {
  alignSensorData,
  fuseMultiSourceData,
  resolveSemanticAmbiguity,
  detectContextSwitch,
  alignToSemanticResult,
} from '@/utils/semanticUtils';
import { mockSemanticMappings, mockScenes } from '@/utils/mockData';

export function useSemanticAlignment() {
  const mappings = ref<SemanticMapping[]>([...mockSemanticMappings]);
  const scenes = ref<Scene[]>([...mockScenes]);
  const activeScene = ref<Scene | undefined>(scenes.value.find(s => s.type === 'home'));
  const alignmentResults = ref<SemanticAlignmentResult[]>([]);
  const isProcessing = ref(false);
  const error = ref<string | null>(null);

  const enabledMappings = computed(() => mappings.value.filter(m => m.enabled));
  const enabledScenes = computed(() => scenes.value.filter(s => s.enabled));

  const alignSensor = (data: SensorData): AlignedData => {
    return alignSensorData(data, enabledMappings.value);
  };

  const fuseData = (dataPoints: SensorData[]): FusedData => {
    return fuseMultiSourceData(dataPoints);
  };

  const resolveAmbiguity = (data: SensorData): ResolvedSemantics => {
    return resolveSemanticAmbiguity(data, activeScene.value?.type || 'home');
  };

  const processSensorData = (data: SensorData): SemanticAlignmentResult => {
    isProcessing.value = true;
    try {
      const result = alignToSemanticResult(data, activeScene.value, enabledMappings.value);
      alignmentResults.value = [result, ...alignmentResults.value.slice(0, 49)];
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '语义对齐处理失败';
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  const processBatchData = (dataPoints: SensorData[]): SemanticAlignmentResult[] => {
    return dataPoints.map(data => processSensorData(data));
  };

  const switchScene = (sceneId: string): ContextTransition | null => {
    const targetScene = scenes.value.find(s => s.id === sceneId);
    if (!targetScene || !activeScene.value) return null;

    const transition = detectContextSwitch(activeScene.value, targetScene, []);

    activeScene.value = targetScene;

    return transition;
  };

  const addMapping = (mapping: Omit<SemanticMapping, 'id'>): SemanticMapping => {
    const newMapping: SemanticMapping = {
      ...mapping,
      id: `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    mappings.value.push(newMapping);
    return newMapping;
  };

  const updateMapping = (id: string, updates: Partial<SemanticMapping>) => {
    const index = mappings.value.findIndex(m => m.id === id);
    if (index !== -1) {
      mappings.value[index] = { ...mappings.value[index], ...updates };
    }
  };

  const deleteMapping = (id: string) => {
    mappings.value = mappings.value.filter(m => m.id !== id);
  };

  const addScene = (scene: Omit<Scene, 'id'>): Scene => {
    const newScene: Scene = {
      ...scene,
      id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    scenes.value.push(newScene);
    return newScene;
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    const index = scenes.value.findIndex(s => s.id === id);
    if (index !== -1) {
      scenes.value[index] = { ...scenes.value[index], ...updates };
    }
  };

  const getSecurityInterpretation = (data: SensorData): string => {
    const aligned = alignSensorData(data, enabledMappings.value, 'security');
    return aligned.securityInterpretation;
  };

  const getHomeControlInterpretation = (data: SensorData): string => {
    const aligned = alignSensorData(data, enabledMappings.value, 'homeControl');
    return aligned.homeControlInterpretation;
  };

  const getConflictPotential = (data: SensorData): number => {
    const result = alignToSemanticResult(data, activeScene.value, enabledMappings.value);
    return result.conflictPotential;
  };

  const getRecommendations = (data: SensorData): string[] => {
    const result = alignToSemanticResult(data, activeScene.value, enabledMappings.value);
    return result.recommendations;
  };

  const clearError = () => {
    error.value = null;
  };

  return {
    mappings,
    scenes,
    activeScene,
    alignmentResults,
    isProcessing,
    error,
    enabledMappings,
    enabledScenes,
    alignSensor,
    fuseData,
    resolveAmbiguity,
    processSensorData,
    processBatchData,
    switchScene,
    addMapping,
    updateMapping,
    deleteMapping,
    addScene,
    updateScene,
    getSecurityInterpretation,
    getHomeControlInterpretation,
    getConflictPotential,
    getRecommendations,
    clearError,
  };
}
