export type SleepStage = 0 | 1 | 2 | 3 | 4;

export const SLEEP_STAGE_LABELS: Record<SleepStage, string> = {
  0: '清醒',
  1: 'REM',
  2: '浅睡',
  3: '深睡',
  4: '未知',
};

export const SLEEP_STAGE_COLORS: Record<SleepStage, string> = {
  0: '#EF4444',
  1: '#8B5CF6',
  2: '#3B82F6',
  3: '#10B981',
  4: '#6B7280',
};

export interface EnvDataPoint {
  id: string;
  sessionId: string;
  timestamp: number;
  lightLux: number;
  temperatureC: number;
  noiseDb: number;
  humidity?: number;
}

export interface SleepStagePoint {
  id: string;
  sessionId: string;
  timestamp: number;
  stage: SleepStage;
  confidence: number;
  heartRate?: number;
  respiration?: number;
  movement?: number;
}

export interface AlignedDataPoint {
  timestamp: number;
  env: EnvDataPoint;
  sleep: SleepStagePoint;
  alignmentScore: number;
}

export interface SleepSession {
  id: string;
  userId: string;
  deviceId: string;
  startTime: number;
  endTime: number;
  sleepScore: number;
  scenario: string;
  createdAt: number;
  deepSleepDuration: number;
  remSleepDuration: number;
  lightSleepDuration: number;
  awakeDuration: number;
}

export type ScenarioType = 'home' | 'travel' | 'vacation' | 'hotel' | 'other';

export const SCENARIO_LABELS: Record<ScenarioType, string> = {
  home: '居家',
  travel: '出差',
  vacation: '度假',
  hotel: '酒店',
  other: '其他',
};

export interface EnvParams {
  lightLux: number;
  temperatureC: number;
  noiseDb: number;
  humidity: number;
}

export interface SleepMetrics {
  sleepScore: number;
  deepSleepRatio: number;
  remSleepRatio: number;
  sleepEfficiency: number;
  sleepLatency: number;
  awakenings: number;
}
