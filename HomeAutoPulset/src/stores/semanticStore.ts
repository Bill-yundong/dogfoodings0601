import { defineStore } from 'pinia';
import { useSemanticAlignment } from '@/composables/useSemanticAlignment';

export const useSemanticStore = defineStore('semantic', () => {
  const alignment = useSemanticAlignment();

  const mappings = alignment.mappings;
  const scenes = alignment.scenes;
  const activeScene = alignment.activeScene;
  const alignmentResults = alignment.alignmentResults;
  const isProcessing = alignment.isProcessing;
  const error = alignment.error;
  const enabledMappings = alignment.enabledMappings;
  const enabledScenes = alignment.enabledScenes;

  const processSensorData = alignment.processSensorData;
  const processBatchData = alignment.processBatchData;
  const switchScene = alignment.switchScene;
  const addMapping = alignment.addMapping;
  const updateMapping = alignment.updateMapping;
  const deleteMapping = alignment.deleteMapping;
  const addScene = alignment.addScene;
  const updateScene = alignment.updateScene;
  const getSecurityInterpretation = alignment.getSecurityInterpretation;
  const getHomeControlInterpretation = alignment.getHomeControlInterpretation;
  const getConflictPotential = alignment.getConflictPotential;
  const getRecommendations = alignment.getRecommendations;
  const alignSensor = alignment.alignSensor;
  const fuseData = alignment.fuseData;
  const resolveAmbiguity = alignment.resolveAmbiguity;
  const clearError = alignment.clearError;

  return {
    mappings,
    scenes,
    activeScene,
    alignmentResults,
    isProcessing,
    error,
    enabledMappings,
    enabledScenes,
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
    alignSensor,
    fuseData,
    resolveAmbiguity,
    clearError,
  };
});
