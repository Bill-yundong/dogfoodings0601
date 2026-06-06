export type SensorType = 'motion' | 'door' | 'window' | 'temperature' | 'humidity' | 'light' | 'smoke' | 'water' | 'gas';

export type DeviceType = 'security' | 'comfort' | 'entertainment' | 'energy';

export type DeviceStatus = 'online' | 'offline' | 'error' | 'syncing';

export type SyncStatus = 'pending' | 'synced' | 'failed';

export type SystemAffiliation = 'security' | 'homeControl' | 'both';

export interface SensorData {
  id: string;
  deviceId: string;
  sensorType: SensorType;
  value: number | boolean;
  unit: string;
  timestamp: number;
  location: string;
  semanticTags: string[];
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  category: string;
  status: DeviceStatus;
  currentState: Record<string, any>;
  location: string;
  lastActivity: number;
  systemAffiliation: SystemAffiliation;
  sensorTypes?: SensorType[];
}

export interface AlignedData {
  originalData: SensorData;
  securityInterpretation: string;
  homeControlInterpretation: string;
  normalizedValue: number;
  confidence: number;
}

export interface FusedData {
  id: string;
  timestamp: number;
  location: string;
  dataPoints: SensorData[];
  fusedValue: Record<string, number>;
  derivedInsights: string[];
}
