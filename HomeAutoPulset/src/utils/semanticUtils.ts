import type { SensorData, AlignedData, FusedData } from '@/types/device';
import type { SemanticMapping, ResolvedSemantics, ContextTransition, SemanticAlignmentResult, Scene } from '@/types/semantic';

export const normalizeSensorValue = (sensorType: string, value: number | boolean): number => {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  const ranges: Record<string, [number, number]> = {
    temperature: [-10, 50],
    humidity: [0, 100],
    light: [0, 10000],
    motion: [0, 1],
    door: [0, 1],
    window: [0, 1],
    smoke: [0, 100],
    water: [0, 100],
    gas: [0, 100],
  };

  const [min, max] = ranges[sensorType] || [0, 100];
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

export const getSecurityInterpretation = (sensorType: string, value: number | boolean): string => {
  const interpretations: Record<string, (v: number | boolean) => string> = {
    motion: (v) => v ? '检测到移动目标，存在入侵风险' : '区域安全，无移动目标',
    door: (v) => v ? '门处于打开状态，安防漏洞' : '门已关闭，安全状态',
    window: (v) => v ? '窗户处于打开状态，安防漏洞' : '窗户已关闭，安全状态',
    temperature: (v) => `环境温度 ${v}°C，设备运行正常`,
    humidity: (v) => `环境湿度 ${v}%，设备运行正常`,
    smoke: (v) => typeof v === 'number' && v > 50 ? '烟雾浓度过高，可能存在火灾' : '烟雾浓度正常',
    water: (v) => typeof v === 'number' && v > 0 ? '检测到水浸，存在漏水风险' : '无漏水检测',
    gas: (v) => typeof v === 'number' && v > 30 ? '燃气浓度过高，存在安全隐患' : '燃气浓度正常',
    light: (v) => `光照强度 ${v} lux，环境正常`,
  };

  return interpretations[sensorType]?.(value) || `传感器数据: ${value}`;
};

export const getHomeControlInterpretation = (sensorType: string, value: number | boolean): string => {
  const interpretations: Record<string, (v: number | boolean) => string> = {
    motion: (v) => v ? '检测到人员活动，调整设备状态' : '无人员活动，可进入节能模式',
    door: (v) => v ? '门打开，启动迎宾模式' : '门关闭，保持当前场景',
    window: (v) => v ? '窗户打开，关闭空调/新风' : '窗户关闭，可调节温湿度',
    temperature: (v) => {
      const temp = typeof v === 'number' ? v : 25;
      if (temp > 28) return '温度过高，建议开启制冷';
      if (temp < 18) return '温度过低，建议开启制热';
      return `温度适宜 (${temp}°C)`;
    },
    humidity: (v) => {
      const hum = typeof v === 'number' ? v : 50;
      if (hum > 70) return '湿度过高，建议开启除湿';
      if (hum < 30) return '湿度过低，建议开启加湿';
      return `湿度适宜 (${hum}%)`;
    },
    smoke: (v) => typeof v === 'number' && v > 20 ? '空气质量差，开启新风系统' : '空气质量良好',
    water: (v) => typeof v === 'number' && v > 0 ? '检测到漏水，关闭水阀' : '供水系统正常',
    gas: (v) => typeof v === 'number' && v > 10 ? '检测到燃气，开启排气扇' : '燃气系统正常',
    light: (v) => {
      const lux = typeof v === 'number' ? v : 500;
      if (lux < 100) return '光线不足，开启照明';
      if (lux > 5000) return '光线充足，关闭照明，调节窗帘';
      return `光照适宜 (${lux} lux)`;
    },
  };

  return interpretations[sensorType]?.(value) || `传感器数据: ${value}`;
};

export const alignSensorData = (
  data: SensorData,
  mappings: SemanticMapping[],
  context: 'security' | 'homeControl' | 'both' = 'both'
): AlignedData => {
  const mapping = mappings.find(m => m.sensorType === data.sensorType);

  let securityInterpretation = getSecurityInterpretation(data.sensorType, data.value);
  let homeControlInterpretation = getHomeControlInterpretation(data.sensorType, data.value);
  let confidence = 0.8;

  if (mapping) {
    if (mapping.securityContext && context !== 'homeControl') {
      securityInterpretation = mapping.securityContext;
    }
    if (mapping.homeControlContext && context !== 'security') {
      homeControlInterpretation = mapping.homeControlContext;
    }
    confidence = mapping.enabled ? 0.95 : 0.7;
  }

  return {
    originalData: data,
    securityInterpretation,
    homeControlInterpretation,
    normalizedValue: normalizeSensorValue(data.sensorType, data.value),
    confidence,
  };
};

export const fuseMultiSourceData = (dataPoints: SensorData[]): FusedData => {
  const now = Date.now();
  const location = dataPoints[0]?.location || 'unknown';

  const fusedValue: Record<string, number> = {};
  const derivedInsights: string[] = [];

  const groupedData = dataPoints.reduce((acc, data) => {
    if (!acc[data.sensorType]) {
      acc[data.sensorType] = [];
    }
    acc[data.sensorType].push(data);
    return acc;
  }, {} as Record<string, SensorData[]>);

  for (const [type, points] of Object.entries(groupedData)) {
    const values = points.map(p => typeof p.value === 'number' ? p.value : (p.value ? 1 : 0));
    fusedValue[type] = values.reduce((a, b) => a + b, 0) / values.length;
  }

  if (fusedValue.temperature !== undefined && fusedValue.humidity !== undefined) {
    const temp = fusedValue.temperature;
    const hum = fusedValue.humidity;
    if (temp > 26 && hum > 60) {
      derivedInsights.push('高温高湿环境，建议开启空调除湿');
    }
  }

  if (fusedValue.motion !== undefined && fusedValue.light !== undefined) {
    if (fusedValue.motion > 0.5 && fusedValue.light < 0.2) {
      derivedInsights.push('检测到黑暗环境中有人员活动，建议开启照明');
    }
  }

  if (fusedValue.door !== undefined && fusedValue.window !== undefined) {
    if (fusedValue.door > 0.5 || fusedValue.window > 0.5) {
      derivedInsights.push('有门窗未关闭，建议检查安防状态');
    }
  }

  return {
    id: `fused_${now}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: now,
    location,
    dataPoints: [...dataPoints],
    fusedValue,
    derivedInsights,
  };
};

export const resolveSemanticAmbiguity = (
  data: SensorData,
  currentScene: string
): ResolvedSemantics => {
  const securityInterpretation = getSecurityInterpretation(data.sensorType, data.value);
  const homeControlInterpretation = getHomeControlInterpretation(data.sensorType, data.value);

  const contextScores: { context: string; score: number }[] = [
    { context: 'security', score: 0.6 },
    { context: 'homeControl', score: 0.6 },
  ];

  if (currentScene === 'security' || currentScene === 'away') {
    contextScores[0].score = 0.9;
    contextScores[1].score = 0.3;
  } else if (currentScene === 'home' || currentScene === 'dinner' || currentScene === 'movie') {
    contextScores[0].score = 0.4;
    contextScores[1].score = 0.8;
  } else if (currentScene === 'sleep') {
    contextScores[0].score = 0.7;
    contextScores[1].score = 0.5;
  }

  const winner = contextScores.sort((a, b) => b.score - a.score)[0];
  const recommendedAction = winner.context === 'security' ? securityInterpretation : homeControlInterpretation;

  return {
    originalSensorType: data.sensorType,
    resolvedContext: winner.context,
    securityInterpretation,
    homeControlInterpretation,
    recommendedAction,
    confidence: winner.score,
    alternativeInterpretations: contextScores.filter(s => s.context !== winner.context).map(s => ({
      context: s.context,
      confidence: s.score,
    })),
  };
};

export const detectContextSwitch = (
  currentScene: Scene,
  targetScene: Scene,
  devices: { id: string; systemAffiliation: string }[]
): ContextTransition => {
  const affectedDevices = devices.filter(d =>
    d.systemAffiliation === 'both' ||
    (currentScene.conflictHandling === 'security' && d.systemAffiliation === 'security') ||
    (targetScene.conflictHandling === 'homeControl' && d.systemAffiliation === 'homeControl')
  ).map(d => d.id);

  const potentialConflicts: string[] = [];

  if (currentScene.type === 'security' && targetScene.type === 'home') {
    potentialConflicts.push('安防撤防与家居设备启动的时序冲突');
  }
  if (currentScene.type === 'sleep' && targetScene.type === 'morning') {
    potentialConflicts.push('夜间安防与晨间照明的状态切换冲突');
  }
  if (currentScene.conflictHandling !== targetScene.conflictHandling) {
    potentialConflicts.push('优先级模式切换可能导致设备状态突变');
  }

  const smoothTransition = potentialConflicts.length === 0;

  return {
    fromContext: currentScene.name,
    toContext: targetScene.name,
    transitionTime: smoothTransition ? 500 : 3000,
    affectedDevices,
    potentialConflicts,
    smoothTransition,
  };
};

export const alignToSemanticResult = (
  data: SensorData,
  activeScene: Scene | undefined,
  mappings: SemanticMapping[]
): SemanticAlignmentResult => {
  const aligned = alignSensorData(data, mappings);
  const securityTags = [data.sensorType, data.location, ...data.semanticTags];
  const homeControlTags = [data.sensorType, data.location, ...data.semanticTags];

  let conflictPotential = 0;
  const recommendations: string[] = [];

  if (activeScene) {
    if (activeScene.conflictHandling === 'security' && aligned.normalizedValue > 0.7) {
      conflictPotential += 0.5;
      recommendations.push('安防模式下检测到异常事件，优先触发安防响应');
    }
    if (activeScene.conflictHandling === 'homeControl' && aligned.normalizedValue > 0.5) {
      conflictPotential += 0.3;
      recommendations.push('家居模式下检测到环境变化，优化舒适度控制');
    }
    if (activeScene.conflictHandling === 'context_aware') {
      conflictPotential += 0.2;
      recommendations.push('上下文感知模式，系统将自动权衡安防与舒适需求');
    }
  }

  if (data.sensorType === 'smoke' && typeof data.value === 'number' && data.value > 30) {
    conflictPotential = 1.0;
    recommendations.unshift('检测到烟雾，立即触发安防警报！');
  }

  if (data.sensorType === 'gas' && typeof data.value === 'number' && data.value > 20) {
    conflictPotential = 1.0;
    recommendations.unshift('检测到燃气泄漏，立即触发安防警报！');
  }

  return {
    sensorId: data.id,
    timestamp: data.timestamp,
    alignedValue: aligned.normalizedValue,
    securityTags,
    homeControlTags,
    activeScene: activeScene?.name || 'default',
    conflictPotential: Math.min(1, conflictPotential),
    recommendations,
  };
};
