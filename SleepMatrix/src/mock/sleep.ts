import { v4 as uuidv4 } from 'uuid';
import type { SleepStage, SleepStagePoint, SleepSession, ScenarioType } from '@/types/data';
import { SCENARIO_LABELS } from '@/types/data';

const seededRandom = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export interface SleepGeneratorOptions {
  sessionId: string;
  startTime: number;
  durationMs: number;
  sampleIntervalMs: number;
  sleepQuality?: 'excellent' | 'good' | 'average' | 'poor';
  seed?: number;
}

const generateSleepStageSequence = (
  numCycles: number,
  quality: 'excellent' | 'good' | 'average' | 'poor',
  random: () => number
): SleepStage[] => {
  const stages: SleepStage[] = [];
  const stageDurations = {
    excellent: { awake: 3, light: 45, deep: 22, rem: 25 },
    good: { awake: 5, light: 48, deep: 20, rem: 22 },
    average: { awake: 10, light: 50, deep: 18, rem: 18 },
    poor: { awake: 18, light: 52, deep: 14, rem: 12 },
  };

  const durations = stageDurations[quality];

  for (let cycle = 0; cycle < numCycles; cycle++) {
    const cycleMultiplier = 1 + cycle * 0.1;

    const awakeCount = Math.floor(durations.awake * cycleMultiplier * (random() * 0.4 + 0.8));
    for (let i = 0; i < awakeCount; i++) stages.push(0);

    const lightCount = Math.floor(durations.light * (random() * 0.4 + 0.8));
    for (let i = 0; i < lightCount; i++) stages.push(2);

    const deepCount = Math.max(0, Math.floor(durations.deep * (1 - cycle * 0.15) * (random() * 0.4 + 0.8)));
    for (let i = 0; i < deepCount; i++) stages.push(3);

    const remCount = Math.floor(durations.rem * cycleMultiplier * (random() * 0.4 + 0.8));
    for (let i = 0; i < remCount; i++) stages.push(1);
  }

  if (random() < 0.3) {
    for (let i = 0; i < 5; i++) stages.push(0);
  }

  return stages;
};

export const generateSleepData = (
  options: SleepGeneratorOptions
): SleepStagePoint[] => {
  const {
    sessionId,
    startTime,
    durationMs,
    sampleIntervalMs,
    sleepQuality = 'good',
    seed = Date.now(),
  } = options;

  const random = seededRandom(seed);
  const data: SleepStagePoint[] = [];
  const numPoints = Math.floor(durationMs / sampleIntervalMs);
  const sleepCycleMs = 90 * 60 * 1000;
  const numCycles = Math.max(3, Math.floor(durationMs / sleepCycleMs));

  const stageSequence = generateSleepStageSequence(numCycles, sleepQuality, random);

  const qualityConfidence = {
    excellent: 0.95,
    good: 0.88,
    average: 0.78,
    poor: 0.65,
  };
  const baseConfidence = qualityConfidence[sleepQuality];

  for (let i = 0; i < numPoints; i++) {
    const timestamp = startTime + i * sampleIntervalMs;
    const stageIndex = Math.floor((i / numPoints) * stageSequence.length);
    const stage = stageSequence[clamp(stageIndex, 0, stageSequence.length - 1)];

    let baseHR = 70;
    let baseResp = 16;
    let baseMovement = 0.1;

    switch (stage) {
      case 0:
        baseHR = 75 + random() * 15;
        baseResp = 18 + random() * 4;
        baseMovement = 0.6 + random() * 0.4;
        break;
      case 1:
        baseHR = 68 + random() * 12;
        baseResp = 16 + random() * 6;
        baseMovement = 0.05 + random() * 0.1;
        break;
      case 2:
        baseHR = 62 + random() * 8;
        baseResp = 14 + random() * 3;
        baseMovement = 0.02 + random() * 0.08;
        break;
      case 3:
        baseHR = 55 + random() * 6;
        baseResp = 12 + random() * 2;
        baseMovement = 0.01 + random() * 0.03;
        break;
      default:
        baseHR = 65;
        baseResp = 15;
        baseMovement = 0.2;
    }

    const timeVariation = Math.sin((i / numPoints) * Math.PI * 2) * 3;
    const hr = clamp(baseHR + timeVariation + random() * 4 - 2, 45, 100);
    const resp = clamp(baseResp + random() * 2 - 1, 8, 28);
    const movement = clamp(baseMovement + random() * 0.05, 0, 1);

    const confidence = clamp(
      baseConfidence + random() * 0.1 - 0.05,
      0.4,
      1
    );

    data.push({
      id: uuidv4(),
      sessionId,
      timestamp,
      stage,
      confidence: Number(confidence.toFixed(3)),
      heartRate: Number(hr.toFixed(1)),
      respiration: Number(resp.toFixed(1)),
      movement: Number(movement.toFixed(3)),
    });
  }

  return data;
};

export const generateRealtimeSleepPoint = (
  sessionId: string,
  timestamp: number,
  lastPoint?: SleepStagePoint
): SleepStagePoint => {
  const random = () => Math.random();

  const lastStage: SleepStage = lastPoint?.stage ?? 2;
  let stage: SleepStage = lastStage;

  if (random() < 0.08) {
    const transitions: Record<SleepStage, SleepStage[]> = {
      0: [0, 2],
      1: [1, 2, 0],
      2: [2, 3, 1, 0],
      3: [3, 2],
      4: [2, 0],
    };
    const options = transitions[lastStage];
    stage = options[Math.floor(random() * options.length)];
  }

  const baseValues: Record<SleepStage, { hr: number; resp: number; movement: number }> = {
    0: { hr: 75, resp: 18, movement: 0.6 },
    1: { hr: 68, resp: 16, movement: 0.08 },
    2: { hr: 62, resp: 14, movement: 0.05 },
    3: { hr: 55, resp: 12, movement: 0.02 },
    4: { hr: 65, resp: 15, movement: 0.2 },
  };

  const base = baseValues[stage];
  const lastHR = lastPoint?.heartRate ?? base.hr;
  const lastResp = lastPoint?.respiration ?? base.resp;
  const lastMovement = lastPoint?.movement ?? base.movement;

  const hr = clamp(lastHR + (base.hr - lastHR) * 0.1 + random() * 3 - 1.5, 45, 100);
  const resp = clamp(lastResp + (base.resp - lastResp) * 0.1 + random() * 1.5 - 0.75, 8, 28);
  const movement = clamp(lastMovement + (base.movement - lastMovement) * 0.1 + random() * 0.03, 0, 1);
  const confidence = clamp(0.85 + random() * 0.1 - 0.05, 0.5, 1);

  return {
    id: uuidv4(),
    sessionId,
    timestamp,
    stage,
    confidence: Number(confidence.toFixed(3)),
    heartRate: Number(hr.toFixed(1)),
    respiration: Number(resp.toFixed(1)),
    movement: Number(movement.toFixed(3)),
  };
};

export const generateSleepSession = (
  userId: string,
  deviceId: string,
  date: Date,
  quality: 'excellent' | 'good' | 'average' | 'poor' = 'good',
  scenario: ScenarioType = 'home'
): SleepSession => {
  const random = seededRandom(date.getTime());

  const hours = 22 + random() * 2;
  const startTime = new Date(date);
  startTime.setHours(Math.floor(hours), Math.floor((hours % 1) * 60), 0, 0);

  const durationHours = quality === 'excellent' ? 7.5 + random() * 1 :
                       quality === 'good' ? 7 + random() * 1 :
                       quality === 'average' ? 6 + random() * 1.5 :
                       5 + random() * 1.5;

  const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

  const durationMs = endTime.getTime() - startTime.getTime();
  const cycleCount = Math.floor(durationMs / (90 * 60 * 1000));

  const stageRatios = {
    excellent: { deep: 0.22, rem: 0.25, light: 0.45, awake: 0.08 },
    good: { deep: 0.20, rem: 0.22, light: 0.48, awake: 0.10 },
    average: { deep: 0.18, rem: 0.18, light: 0.50, awake: 0.14 },
    poor: { deep: 0.14, rem: 0.12, light: 0.52, awake: 0.22 },
  };

  const ratios = stageRatios[quality];
  const sleepScore = quality === 'excellent' ? 85 + random() * 15 :
                     quality === 'good' ? 72 + random() * 13 :
                     quality === 'average' ? 58 + random() * 14 :
                     40 + random() * 18;

  return {
    id: uuidv4(),
    userId,
    deviceId,
    startTime: startTime.getTime(),
    endTime: endTime.getTime(),
    sleepScore: Math.round(sleepScore),
    scenario: SCENARIO_LABELS[scenario],
    createdAt: Date.now(),
    deepSleepDuration: Math.round(durationMs * ratios.deep),
    remSleepDuration: Math.round(durationMs * ratios.rem),
    lightSleepDuration: Math.round(durationMs * ratios.light),
    awakeDuration: Math.round(durationMs * ratios.awake),
  };
};

export const generateHistoricalSessions = (
  userId: string,
  deviceId: string,
  count: number
): SleepSession[] => {
  const sessions: SleepSession[] = [];
  const qualities: Array<'excellent' | 'good' | 'average' | 'poor'> = ['excellent', 'good', 'good', 'average', 'poor'];
  const scenarios: ScenarioType[] = ['home', 'home', 'home', 'travel', 'hotel'];

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const quality = qualities[Math.floor(Math.random() * qualities.length)];
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

    sessions.push(generateSleepSession(userId, deviceId, date, quality, scenario));
  }

  return sessions;
};
