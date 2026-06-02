import { createStore } from 'solid-js/store';
import type { SystemStatus, LaserCoherenceRecord, QubitState, WorkerTask } from '@/types';

interface AppState {
  systemStatus: SystemStatus;
  coherenceData: LaserCoherenceRecord[];
  qubitStates: QubitState[];
  workerTasks: WorkerTask[];
  isSimulationRunning: boolean;
  selectedQubit: number | null;
  darkMode: boolean;
}

const initialQubitStates: QubitState[] = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  state: '|0⟩',
  probability0: 0.98,
  probability1: 0.02,
  coherence: 0.95 + Math.random() * 0.05,
  temperature: 0.01 + Math.random() * 0.005,
}));

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
};

export const [appState, setAppState] = createStore<AppState>(initialState);

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
};
