export type QuantumGateType = 'X' | 'Y' | 'Z' | 'H' | 'CNOT' | 'T' | 'S' | 'Rx' | 'Ry' | 'Rz';

export interface LaserCoherenceRecord {
  id?: number;
  timestamp: number;
  coherenceValue: number;
  qubitId: number;
  phaseNoise: number;
  amplitude: number;
}

export interface RabiOscillationRecord {
  id?: number;
  timestamp: number;
  probability: number;
  omega: number;
  delta: number;
  qubitId: number;
  time: number;
}

export interface FidelityResult {
  id?: number;
  gateType: QuantumGateType;
  fidelity: number;
  errorRate: number;
  parameters: GateParams;
  computeTime: number;
  timestamp: number;
  iterations: number;
}

export interface SyndromeSnapshot {
  id?: number;
  cycleNumber: number;
  syndromeData: number[][];
  errorProbability: number;
  timestamp: number;
  correctionResult: 'success' | 'failed' | 'partial';
  qubitStates: number[];
}

export interface ProtocolSyncRecord {
  id?: number;
  syncId: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  syncTime: number;
  payload: Record<string, unknown>;
  direction: 'to-hardware' | 'from-hardware' | 'bidirectional';
  timestamp: number;
}

export interface GateParams {
  theta?: number;
  phi?: number;
  lambda?: number;
  noiseLevel?: number;
  decoherenceRate?: number;
}

export interface SystemStatus {
  laserPower: number;
  chamberTemperature: number;
  vacuumPressure: number;
  qubitCount: number;
  activeQubits: number;
  uptime: number;
  lastSync: number | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

export interface RabiParams {
  omega: number;
  delta: number;
  gamma: number;
  duration: number;
  samples: number;
}

export interface WorkerTask {
  id: string;
  type: 'fidelity' | 'rabi' | 'syndrome';
  payload: unknown;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: unknown;
  error?: string;
}

export interface QubitState {
  id: number;
  state: '|0⟩' | '|1⟩' | '|+⟩' | '|-⟩' | 'superposition';
  probability0: number;
  probability1: number;
  coherence: number;
  temperature: number;
}
