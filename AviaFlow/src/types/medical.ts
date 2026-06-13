export interface PhysiologicalData {
  id: string;
  crewId: string;
  timestamp: string;
  heartRate: number;
  hrv: number;
  sleepQuality: number;
  sleepDuration: number;
  reactionTime: number;
  cortisol: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  bodyTemperature: number;
  oxygenSaturation: number;
  stressLevel: number;
  source: 'wearable' | 'manual' | 'test';
  notes?: string;
  createdAt: string;
}

export interface HealthRecord {
  id: string;
  crewId: string;
  recordType: '体检' | '疲劳评估' | '疾病记录' | '疫苗接种' | '其他';
  title: string;
  description: string;
  date: string;
  doctor: string;
  hospital: string;
  findings: string;
  recommendations: string;
  attachments?: string[];
  createdAt: string;
}

export interface MedicalAlert {
  id: string;
  crewId: string;
  type: 'fatigue_high' | 'abnormal_vital' | 'expiring_cert' | 'sleep_deprivation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  crewName: string;
  triggeredAt: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export const VITAL_RANGES = {
  heartRate: { min: 60, max: 100, unit: 'bpm' },
  hrv: { min: 20, max: 80, unit: 'ms' },
  sleepQuality: { min: 60, max: 100, unit: '%' },
  sleepDuration: { min: 6, max: 9, unit: 'h' },
  reactionTime: { min: 200, max: 350, unit: 'ms' },
  cortisol: { min: 5, max: 25, unit: 'μg/dL' },
  bloodPressure: {
    systolic: { min: 90, max: 140, unit: 'mmHg' },
    diastolic: { min: 60, max: 90, unit: 'mmHg' },
  },
  bodyTemperature: { min: 36.0, max: 37.5, unit: '°C' },
  oxygenSaturation: { min: 95, max: 100, unit: '%' },
  stressLevel: { min: 0, max: 100, unit: '%' },
} as const;

export const ALERT_SEVERITY_COLORS = {
  low: 'text-green-500 bg-green-500/10',
  medium: 'text-yellow-500 bg-yellow-500/10',
  high: 'text-orange-500 bg-orange-500/10',
  critical: 'text-red-500 bg-red-500/10',
} as const;
