import { v4 as uuidv4 } from 'uuid';
import type { EnvDataPoint } from '@/types/data';

const seededRandom = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export interface EnvGeneratorOptions {
  sessionId: string;
  startTime: number;
  durationMs: number;
  sampleIntervalMs: number;
  baseTemperature?: number;
  baseLight?: number;
  baseNoise?: number;
  baseHumidity?: number;
  addAnomalies?: boolean;
  seed?: number;
}

export const generateEnvData = (
  options: EnvGeneratorOptions
): EnvDataPoint[] => {
  const {
    sessionId,
    startTime,
    durationMs,
    sampleIntervalMs,
    baseTemperature = 22,
    baseLight = 5,
    baseNoise = 35,
    baseHumidity = 50,
    addAnomalies = true,
    seed = Date.now(),
  } = options;

  const random = seededRandom(seed);
  const data: EnvDataPoint[] = [];
  const numPoints = Math.floor(durationMs / sampleIntervalMs);

  const sleepCycleMs = 90 * 60 * 1000;
  const nightProgress = (t: number) => (t - startTime) / durationMs;

  for (let i = 0; i < numPoints; i++) {
    const timestamp = startTime + i * sampleIntervalMs;
    const progress = nightProgress(timestamp);
    const cyclePhase = ((timestamp - startTime) % sleepCycleMs) / sleepCycleMs;

    let light = baseLight + Math.sin(progress * Math.PI) * 3;
    light += Math.sin(cyclePhase * Math.PI * 2) * 2;
    light += random() * 2 - 1;

    if (addAnomalies && random() < 0.02) {
      light += random() * 50;
    }
    light = clamp(light, 0, 100);

    let temperature = baseTemperature;
    temperature += Math.sin(progress * Math.PI * 0.8) * 1.5;
    temperature += Math.sin(cyclePhase * Math.PI * 2) * 0.5;
    temperature += random() * 0.6 - 0.3;

    if (addAnomalies && random() < 0.01) {
      temperature += random() * 2 - 1;
    }
    temperature = clamp(temperature, 15, 35);

    let noise = baseNoise + Math.sin(progress * Math.PI * 0.5) * 10;
    noise += Math.sin(cyclePhase * Math.PI * 4) * 5;
    noise += random() * 6 - 3;

    if (addAnomalies && random() < 0.03) {
      noise += random() * 20 + 10;
    }
    noise = clamp(noise, 20, 85);

    let humidity = baseHumidity + Math.sin(progress * Math.PI * 1.2) * 8;
    humidity += Math.sin(cyclePhase * Math.PI * 2) * 3;
    humidity += random() * 4 - 2;

    if (addAnomalies && random() < 0.015) {
      humidity += random() * 10 - 5;
    }
    humidity = clamp(humidity, 30, 80);

    data.push({
      id: uuidv4(),
      sessionId,
      timestamp,
      lightLux: Number(light.toFixed(2)),
      temperatureC: Number(temperature.toFixed(2)),
      noiseDb: Number(noise.toFixed(2)),
      humidity: Number(humidity.toFixed(2)),
    });
  }

  return data;
};

export const generateRealtimeEnvPoint = (
  sessionId: string,
  timestamp: number,
  lastPoint?: EnvDataPoint
): EnvDataPoint => {
  const random = () => Math.random();

  const baseLight = lastPoint?.lightLux ?? 8;
  const baseTemp = lastPoint?.temperatureC ?? 23;
  const baseNoise = lastPoint?.noiseDb ?? 38;
  const baseHumidity = lastPoint?.humidity ?? 48;

  let light = baseLight + random() * 2 - 1;
  let temperature = baseTemp + random() * 0.4 - 0.2;
  let noise = baseNoise + random() * 4 - 2;
  let humidity = baseHumidity + random() * 2 - 1;

  if (random() < 0.05) {
    light += random() * 20;
  }
  if (random() < 0.08) {
    noise += random() * 15;
  }

  return {
    id: uuidv4(),
    sessionId,
    timestamp,
    lightLux: Number(clamp(light, 0, 100).toFixed(2)),
    temperatureC: Number(clamp(temperature, 15, 35).toFixed(2)),
    noiseDb: Number(clamp(noise, 20, 85).toFixed(2)),
    humidity: Number(clamp(humidity, 30, 80).toFixed(2)),
  };
};

export const generateEnvSessionBatch = (
  sessionId: string,
  startTime: number,
  count: number
): EnvDataPoint[] => {
  return generateEnvData({
    sessionId,
    startTime,
    durationMs: count * 1000,
    sampleIntervalMs: 1000,
  });
};
