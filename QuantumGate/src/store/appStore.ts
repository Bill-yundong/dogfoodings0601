import { createStore, produce } from 'solid-js/store';
import type { SystemStatus, LaserCoherenceRecord, QubitState, WorkerTask, QuantumGateType, FidelityResult } from '@/types';

interface SettingsState {
  hardwareEndpoint: string;
  autoSync: boolean;
  syncInterval: number;
  mockLatency: number;
  mockErrorRate: number;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

interface FidelityState {
  selectedGate: QuantumGateType;
  iterations: number;
  noiseLevel: number;
  decoherenceRate: number;
  isCalculating: boolean;
  progress: number;
  results: FidelityResult[];
  currentResult: FidelityResult | null;
}

interface AppState {
  systemStatus: SystemStatus;
  coherenceData: LaserCoherenceRecord[];
  qubitStates: QubitState[];
  workerTasks: WorkerTask[];
  isSimulationRunning: boolean;
  selectedQubit: number | null;
  darkMode: boolean;
  settings: SettingsState;
  fidelity: FidelityState;
}

const initialQubitStates: QubitState[] = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  state: '|0⟩',
  probability0: 0.98,
  probability1: 0.02,
  coherence: 0.95 + Math.random() * 0.05,
  temperature: 0.01 + Math.random() * 0.005,
}));

const loadSettingsFromStorage = (): SettingsState => {
  try {
    const saved = localStorage.getItem('quantum-gate-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      return {
        hardwareEndpoint: settings.hardwareEndpoint ?? 'ws://localhost:8080/quantum',
        autoSync: settings.autoSync ?? true,
        syncInterval: settings.syncInterval ?? 5000,
        mockLatency: settings.mockLatency ?? 150,
        mockErrorRate: settings.mockErrorRate ?? 0.05,
        connectionStatus: 'disconnected',
      };
    }
  } catch {
  }
  return {
    hardwareEndpoint: 'ws://localhost:8080/quantum',
    autoSync: true,
    syncInterval: 5000,
    mockLatency: 150,
    mockErrorRate: 0.05,
    connectionStatus: 'disconnected',
  };
};

const loadFidelityFromStorage = (): FidelityState => {
  try {
    const saved = localStorage.getItem('quantum-gate-fidelity');
    if (saved) {
      const fidelity = JSON.parse(saved);
      return {
        selectedGate: fidelity.selectedGate ?? 'H',
        iterations: fidelity.iterations ?? 1000,
        noiseLevel: fidelity.noiseLevel ?? 0.01,
        decoherenceRate: fidelity.decoherenceRate ?? 0.001,
        isCalculating: false,
        progress: 0,
        results: fidelity.results ?? [],
        currentResult: fidelity.currentResult ?? null,
      };
    }
  } catch {
  }
  return {
    selectedGate: 'H',
    iterations: 1000,
    noiseLevel: 0.01,
    decoherenceRate: 0.001,
    isCalculating: false,
    progress: 0,
    results: [],
    currentResult: null,
  };
};

const initialState: AppState = {
  systemStatus: {
    laserPower: 85,
    chamberTemperature: 0.015,
    vacuumPressure: 1.2e-11,
    qubitCount: 8,
    activeQubits: 7,
    uptime: 3600 * 24 * 3.5,
    lastSync: Date.now(),
    connectionStatus: 'connected',
  },
  coherenceData: [],
  qubitStates: initialQubitStates,
  workerTasks: [],
  isSimulationRunning: true,
  selectedQubit: null,
  darkMode: true,
  settings: loadSettingsFromStorage(),
  fidelity: loadFidelityFromStorage(),
};

export const [appState, setAppState] = createStore<AppState>(initialState);

const saveSettingsToStorage = () => {
  localStorage.setItem('quantum-gate-settings', JSON.stringify({
    hardwareEndpoint: appState.settings.hardwareEndpoint,
    autoSync: appState.settings.autoSync,
    syncInterval: appState.settings.syncInterval,
    mockLatency: appState.settings.mockLatency,
    mockErrorRate: appState.settings.mockErrorRate,
  }));
};

const saveFidelityToStorage = () => {
  localStorage.setItem('quantum-gate-fidelity', JSON.stringify({
    selectedGate: appState.fidelity.selectedGate,
    iterations: appState.fidelity.iterations,
    noiseLevel: appState.fidelity.noiseLevel,
    decoherenceRate: appState.fidelity.decoherenceRate,
    results: appState.fidelity.results,
    currentResult: appState.fidelity.currentResult,
  }));
};

export const actions = {
  updateSystemStatus(updates: Partial<SystemStatus>) {
    setAppState('systemStatus', (prev) => ({ ...prev, ...updates }));
  },

  addCoherenceData(record: LaserCoherenceRecord) {
    setAppState('coherenceData', (prev) => {
      const newData = [...prev, record];
      return newData.slice(-200);
    });
  },

  updateQubitState(qubitId: number, updates: Partial<QubitState>) {
    setAppState('qubitStates', qubitId, (prev) => ({ ...prev, ...updates }));
  },

  addWorkerTask(task: WorkerTask) {
    setAppState('workerTasks', (prev) => [...prev, task]);
  },

  updateWorkerTask(taskId: string, updates: Partial<WorkerTask>) {
    setAppState('workerTasks', (prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
  },

  removeWorkerTask(taskId: string) {
    setAppState('workerTasks', (prev) => prev.filter((t) => t.id !== taskId));
  },

  toggleSimulation() {
    setAppState('isSimulationRunning', (prev) => !prev);
  },

  setSelectedQubit(qubitId: number | null) {
    setAppState('selectedQubit', qubitId);
  },

  setConnectionStatus(status: SystemStatus['connectionStatus']) {
    setAppState('systemStatus', 'connectionStatus', status);
  },

  updateSettings(updates: Partial<SettingsState>) {
    setAppState('settings', (prev) => {
      const newSettings = { ...prev, ...updates };
      return newSettings;
    });
    saveSettingsToStorage();
  },

  saveSettings() {
    saveSettingsToStorage();
  },

  updateFidelity(updates: Partial<FidelityState>) {
    setAppState('fidelity', (prev) => {
      const newFidelity = { ...prev, ...updates };
      return newFidelity;
    });
    saveFidelityToStorage();
  },

  addFidelityResult(result: FidelityResult) {
    setAppState('fidelity', produce((state) => {
      state.results = [result, ...state.results].slice(0, 10);
      state.currentResult = result;
    }));
    saveFidelityToStorage();
  },

  clearFidelityResults() {
    setAppState('fidelity', produce((state) => {
      state.results = [];
      state.currentResult = null;
    }));
    saveFidelityToStorage();
  },
};
