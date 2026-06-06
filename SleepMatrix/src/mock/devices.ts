import { v4 as uuidv4 } from 'uuid';
import type { Device, DeviceConfig, ThresholdAlert, AutoControlRule } from '@/types/device';

const seededRandom = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

export const generateMockDevices = (userId: string, seed: number = Date.now()): Device[] => {
  const random = seededRandom(seed);

  const deviceTemplates = [
    {
      name: '睡眠环境传感器 Pro',
      type: 'sensor' as const,
      model: 'SM-ENV-001',
      manufacturer: 'SleepMatrix',
      hasBattery: false,
    },
    {
      name: '智能睡眠带',
      type: 'sensor' as const,
      model: 'SM-BAND-002',
      manufacturer: 'SleepMatrix',
      hasBattery: true,
    },
    {
      name: '卧室智能控制器',
      type: 'controller' as const,
      model: 'SM-CTRL-001',
      manufacturer: 'SleepMatrix',
      hasBattery: false,
    },
    {
      name: '睡眠监测仪 Plus',
      type: 'hybrid' as const,
      model: 'SM-HUB-003',
      manufacturer: 'SleepMatrix',
      hasBattery: true,
    },
  ];

  const statuses: Array<'online' | 'offline' | 'warning' | 'error'> = ['online', 'online', 'online', 'warning', 'offline'];

  return deviceTemplates.map((template, index) => {
    const status = statuses[Math.floor(random() * statuses.length)];
    const lastOnline = status === 'online'
      ? Date.now()
      : Date.now() - Math.floor(random() * 86400000 * 3);

    return {
      id: uuidv4(),
      userId,
      name: template.name,
      type: template.type,
      status,
      firmware: `v${1 + Math.floor(random() * 2)}.${Math.floor(random() * 10)}.${Math.floor(random() * 10)}`,
      lastOnline,
      signalStrength: status === 'offline' ? 0 : Math.floor(40 + random() * 60),
      batteryLevel: template.hasBattery ? Math.floor(20 + random() * 80) : undefined,
      model: template.model,
      manufacturer: template.manufacturer,
    };
  });
};

export const generateDefaultThresholdAlerts = (): ThresholdAlert[] => [
  {
    id: uuidv4(),
    parameter: 'lightLux',
    maxValue: 50,
    enabled: true,
    notificationType: 'popup',
  },
  {
    id: uuidv4(),
    parameter: 'temperatureC',
    minValue: 18,
    maxValue: 26,
    enabled: true,
    notificationType: 'popup',
  },
  {
    id: uuidv4(),
    parameter: 'noiseDb',
    maxValue: 55,
    enabled: true,
    notificationType: 'popup',
  },
  {
    id: uuidv4(),
    parameter: 'humidity',
    minValue: 40,
    maxValue: 65,
    enabled: true,
    notificationType: 'device',
  },
];

export const generateDefaultAutoControlRules = (): AutoControlRule[] => [
  {
    id: uuidv4(),
    name: '夜间自动调温',
    enabled: true,
    priority: 1,
    condition: {
      type: 'schedule',
      schedule: '22:00-06:00',
    },
    action: {
      type: 'set_parameter',
      parameter: 'temperatureC',
      value: 21,
    },
  },
  {
    id: uuidv4(),
    name: '深睡时降噪',
    enabled: true,
    priority: 2,
    condition: {
      type: 'correlation',
      correlationTarget: 'deepSleep',
      minCorrelation: 0.7,
    },
    action: {
      type: 'send_alert',
    },
  },
  {
    id: uuidv4(),
    name: '噪音超标自动提醒',
    enabled: true,
    priority: 3,
    condition: {
      type: 'threshold',
      parameter: 'noiseDb',
      operator: 'gt',
      value: 60,
    },
    action: {
      type: 'send_alert',
    },
  },
  {
    id: uuidv4(),
    name: '入睡时关灯',
    enabled: true,
    priority: 4,
    condition: {
      type: 'correlation',
      correlationTarget: 'sleepOnset',
      minCorrelation: 0.6,
    },
    action: {
      type: 'set_parameter',
      parameter: 'lightLux',
      value: 0,
    },
  },
];

export const generateDeviceConfig = (deviceId: string): DeviceConfig => {
  return {
    id: uuidv4(),
    deviceId,
    sampleRate: 1,
    reportInterval: 5,
    thresholdAlerts: generateDefaultThresholdAlerts(),
    autoControlRules: generateDefaultAutoControlRules(),
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 3600000,
  };
};

export const generateMockDeviceConfigs = (devices: Device[]): DeviceConfig[] => {
  return devices.map(device => generateDeviceConfig(device.id));
};
