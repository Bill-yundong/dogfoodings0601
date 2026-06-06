import { createStore, produce } from 'solid-js/store';
import type { EnvDataPoint, SleepStagePoint, AlignedDataPoint, SleepSession } from '@/types/data';
import type { AnalysisTask } from '@/types/analysis';
import type { Device } from '@/types/device';

interface RealtimeState {
  currentSessionId: string | null;
  currentSession: SleepSession | null;
  isRecording: boolean;
  isConnected: boolean;
  envData: EnvDataPoint[];
  sleepData: SleepStagePoint[];
  alignedData: AlignedDataPoint[];
  latestEnvData: EnvDataPoint | null;
  latestSleepData: SleepStagePoint | null;
  alignmentLatencyMs: number;
  dataQuality: number;
  connectedDevices: Device[];
  activeTasks: AnalysisTask[];
  lastUpdateTime: number;
  error: string | null;
}

const initialState: RealtimeState = {
  currentSessionId: null,
  currentSession: null,
  isRecording: false,
  isConnected: false,
  envData: [],
  sleepData: [],
  alignedData: [],
  latestEnvData: null,
  latestSleepData: null,
  alignmentLatencyMs: 0,
  dataQuality: 0,
  connectedDevices: [],
  activeTasks: [],
  lastUpdateTime: 0,
  error: null,
};

export const [realtimeStore, setRealtimeState] = createStore<RealtimeState>(initialState);

export const realtimeActions = {
  startSession(sessionId: string, session: SleepSession): void {
    setRealtimeState({
      currentSessionId: sessionId,
      currentSession: session,
      isRecording: true,
      envData: [],
      sleepData: [],
      alignedData: [],
      error: null,
    });
  },

  stopSession(): void {
    setRealtimeState({
      isRecording: false,
    });
  },

  addEnvData(point: Omit<EnvDataPoint, 'id'>): void {
    const id = crypto.randomUUID();
    const dataPoint: EnvDataPoint = { ...point, id };

    setRealtimeState(
      produce((state) => {
        state.envData.push(dataPoint);
        state.latestEnvData = dataPoint;
        state.lastUpdateTime = Date.now();

        if (state.envData.length > 3600) {
          state.envData = state.envData.slice(-1800);
        }
      })
    );
  },

  addSleepData(point: Omit<SleepStagePoint, 'id'>): void {
    const id = crypto.randomUUID();
    const dataPoint: SleepStagePoint = { ...point, id };

    setRealtimeState(
      produce((state) => {
        state.sleepData.push(dataPoint);
        state.latestSleepData = dataPoint;
        state.lastUpdateTime = Date.now();

        if (state.sleepData.length > 3600) {
          state.sleepData = state.sleepData.slice(-1800);
        }
      })
    );
  },

  setAlignedData(data: AlignedDataPoint[]): void {
    setRealtimeState(
      produce((state) => {
        state.alignedData = data;
        if (data.length > 0) {
          const lastPoint = data[data.length - 1];
          state.alignmentLatencyMs = Date.now() - lastPoint.timestamp;
        }
      })
    );
  },

  setDataQuality(quality: number): void {
    setRealtimeState({ dataQuality: quality });
  },

  addConnectedDevice(device: Device): void {
    setRealtimeState(
      produce((state) => {
        const existingIndex = state.connectedDevices.findIndex(d => d.id === device.id);
        if (existingIndex >= 0) {
          state.connectedDevices[existingIndex] = device;
        } else {
          state.connectedDevices.push(device);
        }
      })
    );
  },

  removeConnectedDevice(deviceId: string): void {
    setRealtimeState(
      produce((state) => {
        state.connectedDevices = state.connectedDevices.filter(d => d.id !== deviceId);
      })
    );
  },

  updateDevice(deviceId: string, updates: Partial<Device>): void {
    setRealtimeState(
      produce((state) => {
        const device = state.connectedDevices.find(d => d.id === deviceId);
        if (device) {
          Object.assign(device, updates);
        }
      })
    );
  },

  addTask(task: AnalysisTask): void {
    setRealtimeState(
      produce((state) => {
        state.activeTasks.push(task);
      })
    );
  },

  updateTask(taskId: string, updates: Partial<AnalysisTask>): void {
    setRealtimeState(
      produce((state) => {
        const task = state.activeTasks.find(t => t.id === taskId);
        if (task) {
          Object.assign(task, updates);
        }
      })
    );
  },

  removeTask(taskId: string): void {
    setRealtimeState(
      produce((state) => {
        state.activeTasks = state.activeTasks.filter(t => t.id !== taskId);
      })
    );
  },

  setError(error: string | null): void {
    setRealtimeState({ error });
  },

  setConnected(connected: boolean): void {
    setRealtimeState({ isConnected: connected });
  },

  setRecording(recording: boolean): void {
    setRealtimeState({ isRecording: recording });
  },

  setEnvData(data: EnvDataPoint[]): void {
    setRealtimeState(
      produce((state) => {
        state.envData = data;
        if (data.length > 0) {
          state.latestEnvData = data[data.length - 1];
        }
      })
    );
  },

  setSleepData(data: SleepStagePoint[]): void {
    setRealtimeState(
      produce((state) => {
        state.sleepData = data;
        if (data.length > 0) {
          state.latestSleepData = data[data.length - 1];
        }
      })
    );
  },

  addAlignedData(point: AlignedDataPoint): void {
    setRealtimeState(
      produce((state) => {
        state.alignedData.push(point);
        state.lastUpdateTime = Date.now();

        if (state.alignedData.length > 3600) {
          state.alignedData = state.alignedData.slice(-1800);
        }
      })
    );
  },

  reset(): void {
    setRealtimeState(initialState);
  },

  getRecentEnvData(seconds: number): EnvDataPoint[] {
    const cutoff = Date.now() - seconds * 1000;
    return realtimeStore.envData.filter(d => d.timestamp >= cutoff);
  },

  getRecentSleepData(seconds: number): SleepStagePoint[] {
    const cutoff = Date.now() - seconds * 1000;
    return realtimeStore.sleepData.filter(d => d.timestamp >= cutoff);
  },
};
