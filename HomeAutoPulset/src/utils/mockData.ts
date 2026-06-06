import type { Device, SensorData, SensorType } from '@/types/device';
import type { Conflict, ConflictType, ConflictSeverity, AsyncTask, ResolutionStrategy } from '@/types/conflict';
import type { DeviceSnapshot } from '@/types/snapshot';
import type { SemanticMapping, Scene, PriorityMode } from '@/types/semantic';

const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const mockDevices: Device[] = [
  {
    id: 'dev_001',
    name: '前门智能锁',
    type: 'security',
    category: 'smart_lock',
    status: 'online',
    currentState: { locked: true, battery: 85, lastAccess: Date.now() - 3600000 },
    location: '客厅',
    lastActivity: Date.now() - 300000,
    systemAffiliation: 'security',
    sensorTypes: ['door'],
  },
  {
    id: 'dev_002',
    name: '客厅移动传感器',
    type: 'security',
    category: 'motion_sensor',
    status: 'online',
    currentState: { motion: false, sensitivity: 'medium' },
    location: '客厅',
    lastActivity: Date.now() - 120000,
    systemAffiliation: 'both',
    sensorTypes: ['motion', 'light'],
  },
  {
    id: 'dev_003',
    name: '主卧温控器',
    type: 'comfort',
    category: 'thermostat',
    status: 'online',
    currentState: { temperature: 24, targetTemperature: 24, mode: 'cool', running: true },
    location: '主卧',
    lastActivity: Date.now() - 60000,
    systemAffiliation: 'homeControl',
    sensorTypes: ['temperature', 'humidity'],
  },
  {
    id: 'dev_004',
    name: '客厅空调',
    type: 'comfort',
    category: 'air_conditioner',
    status: 'online',
    currentState: { on: true, temperature: 24, mode: 'cool', fanSpeed: 'auto' },
    location: '客厅',
    lastActivity: Date.now() - 180000,
    systemAffiliation: 'homeControl',
    sensorTypes: ['temperature'],
  },
  {
    id: 'dev_005',
    name: '烟雾报警器',
    type: 'security',
    category: 'smoke_detector',
    status: 'online',
    currentState: { smokeLevel: 5, alarm: false, battery: 92 },
    location: '厨房',
    lastActivity: Date.now() - 600000,
    systemAffiliation: 'security',
    sensorTypes: ['smoke'],
  },
  {
    id: 'dev_006',
    name: '智能窗帘',
    type: 'comfort',
    category: 'curtain',
    status: 'online',
    currentState: { position: 80, autoMode: true, lastChange: Date.now() - 7200000 },
    location: '客厅',
    lastActivity: Date.now() - 7200000,
    systemAffiliation: 'homeControl',
    sensorTypes: ['light'],
  },
  {
    id: 'dev_007',
    name: '主卧门磁',
    type: 'security',
    category: 'door_sensor',
    status: 'online',
    currentState: { open: false, battery: 78 },
    location: '主卧',
    lastActivity: Date.now() - 1800000,
    systemAffiliation: 'both',
    sensorTypes: ['door'],
  },
  {
    id: 'dev_008',
    name: '燃气探测器',
    type: 'security',
    category: 'gas_detector',
    status: 'online',
    currentState: { gasLevel: 2, alarm: false, battery: 88 },
    location: '厨房',
    lastActivity: Date.now() - 900000,
    systemAffiliation: 'security',
    sensorTypes: ['gas'],
  },
  {
    id: 'dev_009',
    name: '水浸传感器',
    type: 'security',
    category: 'water_sensor',
    status: 'online',
    currentState: { waterDetected: false, battery: 75 },
    location: '卫生间',
    lastActivity: Date.now() - 1200000,
    systemAffiliation: 'security',
    sensorTypes: ['water'],
  },
  {
    id: 'dev_010',
    name: '环境监测仪',
    type: 'comfort',
    category: 'environment_sensor',
    status: 'online',
    currentState: { temperature: 23.5, humidity: 45, co2: 450, pm25: 12 },
    location: '客厅',
    lastActivity: Date.now() - 30000,
    systemAffiliation: 'homeControl',
    sensorTypes: ['temperature', 'humidity'],
  },
  {
    id: 'dev_011',
    name: '客厅灯光',
    type: 'comfort',
    category: 'light',
    status: 'online',
    currentState: { on: true, brightness: 75, colorTemp: 4000, autoMode: false },
    location: '客厅',
    lastActivity: Date.now() - 120000,
    systemAffiliation: 'homeControl',
    sensorTypes: ['light'],
  },
  {
    id: 'dev_012',
    name: '卧室窗户传感器',
    type: 'security',
    category: 'window_sensor',
    status: 'offline',
    currentState: { open: false, battery: 45 },
    location: '次卧',
    lastActivity: Date.now() - 86400000,
    systemAffiliation: 'both',
    sensorTypes: ['window'],
  },
];

const generateSensorValue = (type: SensorType): number | boolean => {
  switch (type) {
    case 'motion':
    case 'door':
    case 'window':
      return Math.random() > 0.85;
    case 'temperature':
      return Math.round((18 + Math.random() * 15) * 10) / 10;
    case 'humidity':
      return Math.round((30 + Math.random() * 50) * 10) / 10;
    case 'light':
      return Math.floor(Math.random() * 10000);
    case 'smoke':
      return Math.round(Math.random() * 15 * 10) / 10;
    case 'water':
      return Math.random() > 0.98 ? Math.random() * 100 : 0;
    case 'gas':
      return Math.round(Math.random() * 10 * 10) / 10;
    default:
      return 0;
  }
};

export const generateSensorData = (device: Device): SensorData | null => {
  if (!device.sensorTypes || device.sensorTypes.length === 0) return null;

  const sensorType = device.sensorTypes[Math.floor(Math.random() * device.sensorTypes.length)];
  const value = generateSensorValue(sensorType);

  const units: Record<SensorType, string> = {
    temperature: '°C',
    humidity: '%',
    light: 'lux',
    motion: '',
    door: '',
    window: '',
    smoke: '%',
    water: '%',
    gas: 'ppm',
  };

  return {
    id: generateId('sensor'),
    deviceId: device.id,
    sensorType,
    value,
    unit: units[sensorType],
    timestamp: Date.now(),
    location: device.location,
    semanticTags: [device.type, device.category],
  };
};

export const generateBatchSensorData = (count: number = 10): SensorData[] => {
  const data: SensorData[] = [];
  const activeDevices = mockDevices.filter(d => d.status === 'online' && d.sensorTypes);

  for (let i = 0; i < count; i++) {
    const device = activeDevices[Math.floor(Math.random() * activeDevices.length)];
    const sensorData = generateSensorData(device);
    if (sensorData) {
      data.push(sensorData);
    }
  }

  return data;
};

const conflictTypes: ConflictType[] = ['security_vs_comfort', 'energy_vs_comfort', 'scene_conflict', 'rule_contradiction'];
const severities: ConflictSeverity[] = ['critical', 'high', 'medium', 'low'];

export const generateMockConflict = (severity?: ConflictSeverity): Conflict => {
  const now = Date.now();
  const type = conflictTypes[Math.floor(Math.random() * conflictTypes.length)];
  const sev = severity || severities[Math.floor(Math.random() * severities.length)];
  const sourceDevice = mockDevices[Math.floor(Math.random() * mockDevices.length)];
  const targetDevices = mockDevices
    .filter(d => d.id !== sourceDevice.id)
    .slice(0, Math.floor(Math.random() * 3) + 1)
    .map(d => d.id);

  const descriptions: Record<ConflictType, string> = {
    security_vs_comfort: '安防系统与舒适系统存在指令冲突，需要优先确认安防需求',
    energy_vs_comfort: '节能模式与舒适度要求存在冲突，需要权衡能耗与用户体验',
    scene_conflict: '多个场景同时激活，目标状态存在矛盾',
    rule_contradiction: '自动化规则之间存在逻辑矛盾',
  };

  const risks: Record<ConflictType, string> = {
    security_vs_comfort: '安防漏洞可能导致安全事故',
    energy_vs_comfort: '设备频繁启停增加能耗或降低设备寿命',
    scene_conflict: '用户体验混乱，设备状态异常',
    rule_contradiction: '系统逻辑错误，部分自动化失效',
  };

  return {
    id: generateId('conflict'),
    type,
    severity: sev,
    status: 'detected',
    detectedAt: now - Math.floor(Math.random() * 3600000),
    sourceDevices: [sourceDevice.id],
    targetDevices,
    triggerEvent: `auto_trigger_${Math.random().toString(36).substr(2, 6)}`,
    description: descriptions[type],
    resolutionHistory: [],
    affectedScenes: ['home', 'away', 'sleep'].slice(0, Math.floor(Math.random() * 2) + 1),
    potentialRisk: risks[type],
  };
};

export const generateMockConflicts = (count: number = 5): Conflict[] => {
  return Array.from({ length: count }, () => generateMockConflict());
};

export const generateMockSnapshot = (device: Device, isOffline: boolean = false): DeviceSnapshot => {
  return {
    id: generateId('snapshot'),
    deviceId: device.id,
    timestamp: Date.now() - Math.floor(Math.random() * 86400000),
    state: { ...device.currentState },
    triggerCondition: isOffline ? 'network_disconnect' : 'state_change',
    isOffline,
    syncStatus: isOffline ? (Math.random() > 0.5 ? 'pending' : 'synced') : 'synced',
    dataHash: Math.random().toString(36).substr(2, 16),
    metadata: {
      location: device.location,
      deviceType: device.type,
      deviceName: device.name,
    },
  };
};

export const generateMockSnapshots = (count: number = 20): DeviceSnapshot[] => {
  return Array.from({ length: count }, () => {
    const device = mockDevices[Math.floor(Math.random() * mockDevices.length)];
    return generateMockSnapshot(device, Math.random() > 0.7);
  });
};

export const mockSemanticMappings: SemanticMapping[] = [
  {
    id: 'map_001',
    sensorType: 'motion',
    securityContext: '入侵检测',
    homeControlContext: '人员存在感应',
    priority: 'context_aware',
    enabled: true,
    description: '移动传感器的双重语义映射',
    rules: [
      {
        id: 'rule_001',
        condition: '布防模式下检测到移动',
        securityAction: '触发警报',
        homeControlAction: '忽略（安防优先）',
        conflictResolution: '安防优先',
        weight: 10,
      },
      {
        id: 'rule_002',
        condition: '在家模式下检测到移动',
        securityAction: '记录日志',
        homeControlAction: '开启照明/调节空调',
        conflictResolution: '舒适优先',
        weight: 8,
      },
    ],
  },
  {
    id: 'map_002',
    sensorType: 'door',
    securityContext: '出入口监控',
    homeControlContext: '迎宾/送客触发',
    priority: 'security',
    enabled: true,
    description: '门磁传感器的语义映射',
    rules: [
      {
        id: 'rule_003',
        condition: '布防时门被打开',
        securityAction: '立即触发警报',
        homeControlAction: '暂停迎宾模式',
        conflictResolution: '安防优先',
        weight: 10,
      },
    ],
  },
  {
    id: 'map_003',
    sensorType: 'temperature',
    securityContext: '设备运行环境监测',
    homeControlContext: '舒适度调节依据',
    priority: 'homeControl',
    enabled: true,
    description: '温度传感器的语义映射',
    rules: [],
  },
  {
    id: 'map_004',
    sensorType: 'smoke',
    securityContext: '火灾检测',
    homeControlContext: '空气质量监测',
    priority: 'security',
    enabled: true,
    description: '烟雾传感器的语义映射',
    rules: [],
  },
  {
    id: 'map_005',
    sensorType: 'light',
    securityContext: '环境异常检测',
    homeControlContext: '照明自动控制',
    priority: 'context_aware',
    enabled: true,
    description: '光照传感器的语义映射',
    rules: [],
  },
];

export const mockScenes: Scene[] = [
  {
    id: 'scene_001',
    name: '离家模式',
    type: 'away',
    description: '无人在家时启用，安防布防，设备节能',
    activeConditions: ['所有成员位置不在家', '手动触发'],
    securitySettings: { armed: true, alertLevel: 'high', cameras: 'recording' },
    homeControlSettings: { ac: 'off', lights: 'off', curtains: 'open' },
    conflictHandling: 'security',
    enabled: true,
  },
  {
    id: 'scene_002',
    name: '回家模式',
    type: 'home',
    description: '有人在家时启用，安防撤防，设备正常运行',
    activeConditions: ['成员位置到家', '手动触发'],
    securitySettings: { armed: false, alertLevel: 'low', cameras: 'motion_only' },
    homeControlSettings: { ac: 'auto', lights: 'auto', curtains: 'auto' },
    conflictHandling: 'context_aware',
    enabled: true,
  },
  {
    id: 'scene_003',
    name: '睡眠模式',
    type: 'sleep',
    description: '夜间睡眠时启用，部分布防，设备静音',
    activeConditions: ['时间 22:00-06:00', '手动触发'],
    securitySettings: { armed: true, alertLevel: 'medium', cameras: 'off' },
    homeControlSettings: { ac: 'sleep', lights: 'off', curtains: 'closed' },
    conflictHandling: 'context_aware',
    enabled: true,
  },
  {
    id: 'scene_004',
    name: '安防模式',
    type: 'security',
    description: '高等级安防，所有传感器高度敏感',
    activeConditions: ['长时间无人', '手动触发', '报警事件'],
    securitySettings: { armed: true, alertLevel: 'critical', cameras: 'continuous' },
    homeControlSettings: { ac: 'off', lights: 'simulation', curtains: 'closed' },
    conflictHandling: 'security',
    enabled: true,
  },
  {
    id: 'scene_005',
    name: '观影模式',
    type: 'movie',
    description: '观影场景，灯光调暗，窗帘关闭',
    activeConditions: ['电视开启', '手动触发'],
    securitySettings: { armed: false, alertLevel: 'low' },
    homeControlSettings: { ac: 'on', lights: 'dim', curtains: 'closed' },
    conflictHandling: 'homeControl',
    enabled: true,
  },
];

export const mockResolutionStrategies: ResolutionStrategy[] = [
  {
    id: 'strategy_001',
    name: '安防优先策略',
    priority: 100,
    type: 'security_first',
    timeout: 30000,
    description: '发生冲突时，优先保障安防系统需求，可能牺牲部分舒适度',
    actions: [
      {
        id: 'action_001',
        deviceId: 'system',
        actionType: 'notify',
        parameters: { message: '检测到安防冲突，已启动安防优先策略', level: 'warning' },
        status: 'pending',
      },
      {
        id: 'action_002',
        deviceId: 'system',
        actionType: 'set_state',
        parameters: { target: 'security', state: 'armed' },
        status: 'pending',
      },
    ],
  },
  {
    id: 'strategy_002',
    name: '舒适优先策略',
    priority: 50,
    type: 'comfort_first',
    timeout: 60000,
    description: '发生冲突时，优先保障用户舒适度，安防系统降敏',
    actions: [],
  },
  {
    id: 'strategy_003',
    name: '节能优先策略',
    priority: 40,
    type: 'energy_first',
    timeout: 120000,
    description: '发生冲突时，优先考虑能耗优化',
    actions: [],
  },
  {
    id: 'strategy_004',
    name: '用户手动策略',
    priority: 80,
    type: 'user_override',
    timeout: 300000,
    description: '等待用户手动决策，超时后执行默认策略',
    actions: [],
  },
];

export const generateMockAsyncTask = (conflict: Conflict): AsyncTask => {
  const now = Date.now();
  return {
    id: generateId('task'),
    conflictId: conflict.id,
    priority: conflict.severity === 'critical' ? 100 : conflict.severity === 'high' ? 75 : 50,
    status: 'queued',
    createdAt: now,
    progress: 0,
    retryCount: 0,
  };
};

export const generateTimeSeriesData = (
  hours: number = 24,
  intervalMinutes: number = 15
): { time: number; value: number }[] => {
  const now = Date.now();
  const intervalMs = intervalMinutes * 60 * 1000;
  const totalPoints = Math.floor((hours * 60) / intervalMinutes);
  const data: { time: number; value: number }[] = [];

  for (let i = totalPoints - 1; i >= 0; i--) {
    const time = now - i * intervalMs;
    const baseValue = 20 + Math.sin(i / 10) * 10;
    const noise = Math.random() * 5;
    data.push({ time, value: Math.round((baseValue + noise) * 10) / 10 });
  }

  return data;
};

export const generateConflictTrendData = (days: number = 7): { date: string; count: number; resolved: number }[] => {
  const data: { date: string; count: number; resolved: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const count = Math.floor(Math.random() * 8) + 2;
    const resolved = Math.floor(count * (0.7 + Math.random() * 0.3));
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      count,
      resolved,
    });
  }

  return data;
};
