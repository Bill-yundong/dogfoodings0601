export interface EnvironmentData {
  timestamp: number
  lightLevel: number
  temperature: number
  noiseLevel: number
  humidity: number
}

export type SleepStageType = 'wake' | 'light' | 'deep' | 'rem'

export interface SleepStageData {
  timestamp: number
  depthLevel: number
  stage: SleepStageType
  heartRate: number
  respirationRate: number
}

export interface SleepSnapshot {
  id: string
  startTime: number
  endTime: number
  duration: number
  sleepScore: number
  scene: string
  envData: EnvironmentData[]
  sleepStages: SleepStageData[]
  analysis?: AnalysisResult
  createdAt: number
}

export interface CorrelationResult {
  lightVsDepth: number
  tempVsDepth: number
  noiseVsDepth: number
  humidityVsDepth: number
  lightTemp: number
  lightNoise: number
  tempNoise: number
}

export interface WeightAnalysisItem {
  factor: string
  factorLabel: string
  weight: number
  impact: 'positive' | 'negative' | 'neutral'
}

export interface AnalysisResult {
  id: string
  snapshotId: string
  timestamp: number
  correlationMatrix: CorrelationResult
  weightAnalysis: WeightAnalysisItem[]
  overallScore: number
}

export interface DeviceStatus {
  id: string
  type: 'sensor' | 'controller'
  name: string
  connected: boolean
  lastUpdate: number
  metrics?: Record<string, string | number>
}

export interface HardwareControlParams {
  targetLight: number
  targetTemperature: number
  targetNoise: number
  sceneMode: SceneMode
}

export type SceneMode = 'deep_sleep' | 'fast_sleep' | 'nap' | 'custom'

export interface ScenePreset {
  id: SceneMode
  name: string
  description: string
  lightLevel: number
  temperature: number
  noiseLevel: number
  icon: string
}

export interface TimeRangeData {
  start: number
  end: number
  data: EnvironmentData[]
  sleepStages: SleepStageData[]
}

export type CorrelationMethod = 'pearson' | 'spearman'

export interface StorageStats {
  totalSize: number
  snapshotCount: number
  envDataCount: number
  sleepStageCount: number
  analysisCount: number
}
