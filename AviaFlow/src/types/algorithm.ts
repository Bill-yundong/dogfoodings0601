export interface BiorhythmResult {
  physical: number;
  emotional: number;
  intellectual: number;
  isCriticalDay: boolean;
  criticalType?: 'physical' | 'emotional' | 'intellectual' | 'combined';
}

export interface BiorhythmDayData {
  date: string;
  physical: number;
  emotional: number;
  intellectual: number;
  isCritical: boolean;
}

export const BIORHYTHM_CYCLES = {
  physical: 23,
  emotional: 28,
  intellectual: 33,
} as const;

export interface ReactionTimePrediction {
  baselineReactionTime: number;
  predictedReactionTime: number;
  attenuationFactor: number;
  timezoneJetlag: number;
  sleepDebt: number;
  fatigueAccumulation: number;
  confidence: number;
  currentReactionTime: number;
  predictedPeak: number;
  peakDate: string;
  estimatedRecoveryDays: number;
}

export interface FatigueAssessment {
  id: string;
  crewId: string;
  dutyId?: string;
  assessmentTime: string;
  assessmentTimestamp: string;
  fatigueScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  biorhythmState: BiorhythmResult;
  reactionTime: ReactionTimePrediction;
  predictedReactionTime: number;
  contributingFactors: string[];
  recommendations: string[];
  factors: {
    jetlag: number;
    sleepDebt: number;
    fatigueAccumulation: number;
    hrvInfluence: number;
    stressInfluence: number;
    biorhythmInfluence: number;
  };
  timeWindow: {
    start: string;
    end: string;
  };
}

export interface FatigueEvolutionPoint {
  timestamp: string;
  fatigueScore: number;
  riskLevel: FatigueAssessment['riskLevel'];
  flightHoursAccumulated: number;
  sleepHoursAccumulated: number;
  timezoneChanges: number;
}

export interface SyncMessage {
  id: string;
  type: 'medical_update' | 'schedule_update' | 'fatigue_alert' | 'conflict_detected' | 'sync_request';
  payload: any;
  timestamp: string;
  source: 'medical' | 'aoc' | 'algorithm' | 'system';
  target?: 'medical' | 'aoc' | 'all';
  status: 'pending' | 'delivered' | 'read' | 'processed';
  processedAt?: string;
}

export interface SyncLog {
  id: string;
  source: 'medical' | 'aoc' | 'algorithm' | 'system';
  target: 'medical' | 'aoc' | 'all';
  recordId: string;
  recordType: string;
  syncTime: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  dataHash?: string;
}

export const FATIGUE_RISK_THRESHOLDS = {
  low: { min: 0, max: 30, color: '#22c55e', label: '低风险' },
  medium: { min: 30, max: 55, color: '#eab308', label: '中风险' },
  high: { min: 55, max: 75, color: '#f97316', label: '高风险' },
  critical: { min: 75, max: 100, color: '#ef4444', label: '极高风险' },
} as const;

export type RiskLevel = keyof typeof FATIGUE_RISK_THRESHOLDS;

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

export function getRiskColor(level: RiskLevel): string {
  return FATIGUE_RISK_THRESHOLDS[level].color;
}

export function getRiskLabel(level: RiskLevel): string {
  return FATIGUE_RISK_THRESHOLDS[level].label;
}
