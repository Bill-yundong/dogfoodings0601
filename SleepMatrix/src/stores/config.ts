import { createStore, produce } from 'solid-js/store';

export type ThemeMode = 'dark' | 'light' | 'system';
export type TimeUnit = '1s' | '5s' | '10s' | '30s' | '1m';
export type ChartType = 'line' | 'area' | 'heatmap';

export interface AppConfig {
  theme: ThemeMode;
  language: 'zh-CN' | 'en-US';
  autoSave: boolean;
  autoSaveInterval: number;
  maxDataPoints: number;
  realtimeRefreshRate: TimeUnit;
  defaultChartType: ChartType;
  showConfidenceInterval: boolean;
  showDataPointLabels: boolean;
  enableNotifications: boolean;
  notificationThresholdAlerts: boolean;
  notificationAnalysisComplete: boolean;
  notificationDeviceStatus: boolean;
  soundEnabled: boolean;
  animationEnabled: boolean;
  dataRetentionDays: number;
  exportFormat: 'json' | 'csv';
  correlationThreshold: number;
  alignmentWindowMs: number;
  autoRunAnalysis: boolean;
  useWebWorker: boolean;
}

interface ConfigState {
  config: AppConfig;
  isSaving: boolean;
  lastSaved: number | null;
}

const defaultConfig: AppConfig = {
  theme: 'dark',
  language: 'zh-CN',
  autoSave: true,
  autoSaveInterval: 30000,
  maxDataPoints: 10000,
  realtimeRefreshRate: '1s',
  defaultChartType: 'line',
  showConfidenceInterval: true,
  showDataPointLabels: false,
  enableNotifications: true,
  notificationThresholdAlerts: true,
  notificationAnalysisComplete: true,
  notificationDeviceStatus: true,
  soundEnabled: false,
  animationEnabled: true,
  dataRetentionDays: 90,
  exportFormat: 'json',
  correlationThreshold: 0.5,
  alignmentWindowMs: 5000,
  autoRunAnalysis: true,
  useWebWorker: true,
};

const initialState: ConfigState = {
  config: { ...defaultConfig },
  isSaving: false,
  lastSaved: null,
};

const [state, setState] = createStore<ConfigState>(initialState);

export const configStore = state;

const TIME_UNIT_MAP: Record<TimeUnit, number> = {
  '1s': 1000,
  '5s': 5000,
  '10s': 10000,
  '30s': 30000,
  '1m': 60000,
};

export const configActions = {
  updateConfig: async (updates: Partial<AppConfig>) => {
    setState('isSaving', true);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      setState(produce(s => {
        Object.assign(s.config, updates);
        s.isSaving = false;
        s.lastSaved = Date.now();
      }));

      localStorage.setItem('sleepmatrix_config', JSON.stringify(state.config));
    } catch (error) {
      setState('isSaving', false);
      throw error;
    }
  },

  loadConfig: async () => {
    try {
      const saved = localStorage.getItem('sleepmatrix_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setState(produce(s => {
          Object.assign(s.config, parsed);
        }));
      }
    } catch (error) {
      console.warn('Failed to load config:', error);
    }
  },

  resetConfig: async () => {
    setState(produce(s => {
      s.config = { ...defaultConfig };
      s.lastSaved = Date.now();
    }));
    localStorage.removeItem('sleepmatrix_config');
  },

  getRefreshRateMs: (): number => {
    return TIME_UNIT_MAP[state.config.realtimeRefreshRate];
  },

  toggleTheme: () => {
    const newTheme: ThemeMode = state.config.theme === 'dark' ? 'light' : 'dark';
    configActions.updateConfig({ theme: newTheme });
  },

  setTheme: (theme: ThemeMode) => {
    configActions.updateConfig({ theme });
  },

  setLanguage: (language: AppConfig['language']) => {
    configActions.updateConfig({ language });
  },
};
