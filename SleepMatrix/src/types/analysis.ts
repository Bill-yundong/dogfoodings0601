export interface CorrelationResult {
  variableX: string;
  variableY: string;
  pearson: number;
  spearman: number;
  pValue: number;
  sampleSize: number;
  significant: boolean;
}

export interface CorrelationMatrix {
  variables: string[];
  matrix: CorrelationResult[][];
  timestamp: number;
  sessionId: string;
}

export interface SensitivityScore {
  parameter: string;
  score: number;
  unit: string;
  direction: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface KeyInsight {
  id: string;
  message: string;
  severity: 'positive' | 'warning' | 'negative';
  correlation: number;
  variables: string[];
}

export interface Recommendation {
  id: string;
  type: 'light' | 'temperature' | 'noise' | 'humidity' | 'combined';
  priority: 'high' | 'medium' | 'low';
  parameter: string;
  currentValue: number;
  targetRange: [number, number];
  expectedImprovement: number;
  confidence: number;
  description: string;
  actionable: boolean;
}

export interface AnalysisResult {
  id: string;
  sessionId: string;
  correlationMatrix: CorrelationMatrix;
  sensitivityScores: Record<string, SensitivityScore>;
  recommendations: Recommendation[];
  keyInsights: KeyInsight[];
  overallScore: number;
  analyzedAt: number;
  analysisDuration: number;
  dataQuality: number;
}

export interface AnalysisTask {
  id: string;
  sessionId: string;
  type: 'correlation' | 'sensitivity' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  priority: 'high' | 'medium' | 'low';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface TimeLagCorrelation {
  lag: number;
  correlation: number;
  variableX: string;
  variableY: string;
}

export interface PartialCorrelationResult {
  variableX: string;
  variableY: string;
  controlVariables: string[];
  partialCorrelation: number;
  pValue: number;
  degreesOfFreedom: number;
}

export interface GrangerCausalityResult {
  variableX: string;
  variableY: string;
  fStatistic: number;
  pValue: number;
  lagOrder: number;
  significant: boolean;
}

export const VARIABLE_LABELS: Record<string, string> = {
  lightLux: '光照 (lux)',
  temperatureC: '温度 (°C)',
  noiseDb: '噪音 (dB)',
  humidity: '湿度 (%)',
  sleepStage: '睡眠分期',
  sleepScore: '睡眠评分',
  deepSleepRatio: '深睡比例',
  remSleepRatio: 'REM比例',
  sleepEfficiency: '睡眠效率',
  heartRate: '心率',
  respiration: '呼吸频率',
};

export const PARAMETER_UNITS: Record<string, string> = {
  lightLux: 'lux',
  temperatureC: '°C',
  noiseDb: 'dB',
  humidity: '%',
  heartRate: 'BPM',
  respiration: '次/分',
};

export const OPTIMAL_RANGES: Record<string, [number, number]> = {
  lightLux: [0, 50],
  temperatureC: [18, 22],
  noiseDb: [0, 30],
  humidity: [40, 60],
};
