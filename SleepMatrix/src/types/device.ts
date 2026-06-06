export type DeviceStatus = 'online' | 'offline' | 'warning' | 'error';

export type DeviceType = 'sensor' | 'controller' | 'hybrid';

export interface Device {
  id: string;
  userId: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  firmware: string;
  lastOnline: number;
  signalStrength: number;
  batteryLevel?: number;
  model: string;
  manufacturer: string;
}

export interface DeviceConfig {
  id: string;
  deviceId: string;
  sampleRate: number;
  reportInterval: number;
  thresholdAlerts: ThresholdAlert[];
  autoControlRules: AutoControlRule[];
  createdAt: number;
  updatedAt: number;
}

export interface ThresholdAlert {
  id: string;
  parameter: 'lightLux' | 'temperatureC' | 'noiseDb' | 'humidity';
  minValue?: number;
  maxValue?: number;
  enabled: boolean;
  notificationType: 'popup' | 'email' | 'device';
}

export interface AutoControlRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: ControlCondition;
  action: ControlAction;
  priority: number;
}

export interface ControlCondition {
  type: 'threshold' | 'schedule' | 'correlation';
  parameter?: string;
  operator?: 'gt' | 'lt' | 'eq' | 'between';
  value?: number | [number, number];
  schedule?: string;
  correlationTarget?: string;
  minCorrelation?: number;
}

export interface ControlAction {
  type: 'set_parameter' | 'send_alert' | 'run_scene';
  parameter?: string;
  value?: number;
  sceneId?: string;
}

export interface DeviceCommand {
  deviceId: string;
  command: 'set_parameter' | 'calibrate' | 'reboot' | 'start_session' | 'stop_session';
  parameter?: string;
  value?: number;
  timestamp: number;
}

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  online: '在线',
  offline: '离线',
  warning: '警告',
  error: '错误',
};

export const DEVICE_STATUS_COLORS: Record<DeviceStatus, string> = {
  online: '#10B981',
  offline: '#6B7280',
  warning: '#F59E0B',
  error: '#EF4444',
};
