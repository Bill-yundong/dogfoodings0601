import type { EnvDataPoint, SleepStagePoint, AlignedDataPoint } from '@/types/data';
import { linearInterpolation } from '@/utils/math';
import { generateTimeAxis } from '@/utils/time';

export interface AlignmentConfig {
  targetIntervalMs: number;
  windowSizeMs: number;
  maxGapMs: number;
  interpolationMethod: 'linear' | 'nearest' | 'none';
}

export const DEFAULT_ALIGNMENT_CONFIG: AlignmentConfig = {
  targetIntervalMs: 1000,
  windowSizeMs: 2000,
  maxGapMs: 5000,
  interpolationMethod: 'linear',
};

export interface AlignmentResult {
  alignedData: AlignedDataPoint[];
  alignmentStats: {
    totalPoints: number;
    alignedPoints: number;
    missingPoints: number;
    averageAlignmentScore: number;
    avgEnvDelayMs: number;
    avgSleepDelayMs: number;
  };
}

interface DataWindow<T> {
  points: T[];
  currentIndex: number;
}

export class TimestampAlignmentEngine {
  private config: AlignmentConfig;

  constructor(config: Partial<AlignmentConfig> = {}) {
    this.config = { ...DEFAULT_ALIGNMENT_CONFIG, ...config };
  }

  public alignData(
    envData: EnvDataPoint[],
    sleepData: SleepStagePoint[],
    startTime?: number,
    endTime?: number
  ): AlignmentResult {
    if (envData.length === 0 || sleepData.length === 0) {
      return {
        alignedData: [],
        alignmentStats: {
          totalPoints: 0,
          alignedPoints: 0,
          missingPoints: 0,
          averageAlignmentScore: 0,
          avgEnvDelayMs: 0,
          avgSleepDelayMs: 0,
        },
      };
    }

    const actualStartTime = startTime ?? Math.min(envData[0].timestamp, sleepData[0].timestamp);
    const actualEndTime = endTime ?? Math.max(envData[envData.length - 1].timestamp, sleepData[sleepData.length - 1].timestamp);

    const targetTimestamps = generateTimeAxis(
      actualStartTime,
      actualEndTime,
      this.config.targetIntervalMs
    );

    const sortedEnv = [...envData].sort((a, b) => a.timestamp - b.timestamp);
    const sortedSleep = [...sleepData].sort((a, b) => a.timestamp - b.timestamp);

    const envWindow: DataWindow<EnvDataPoint> = { points: sortedEnv, currentIndex: 0 };
    const sleepWindow: DataWindow<SleepStagePoint> = { points: sortedSleep, currentIndex: 0 };

    const alignedData: AlignedDataPoint[] = [];
    let missingCount = 0;
    let totalAlignmentScore = 0;
    let totalEnvDelay = 0;
    let totalSleepDelay = 0;
    let delayCount = 0;

    for (const targetTs of targetTimestamps) {
      const envMatch = this.findNearestPoints(envWindow, targetTs);
      const sleepMatch = this.findNearestPoints(sleepWindow, targetTs);

      if (!envMatch || !sleepMatch) {
        missingCount++;
        continue;
      }

      const envDistance = Math.min(
        Math.abs(targetTs - envMatch.prev.timestamp),
        Math.abs(targetTs - envMatch.next.timestamp)
      );
      const sleepDistance = Math.min(
        Math.abs(targetTs - sleepMatch.prev.timestamp),
        Math.abs(targetTs - sleepMatch.next.timestamp)
      );

      if (envDistance > this.config.maxGapMs || sleepDistance > this.config.maxGapMs) {
        missingCount++;
        continue;
      }

      const interpolatedEnv = this.interpolateEnvPoint(envMatch, targetTs);
      const interpolatedSleep = this.interpolateSleepPoint(sleepMatch, targetTs);

      const alignmentScore = this.calculateAlignmentScore(envDistance, sleepDistance);

      alignedData.push({
        timestamp: targetTs,
        env: interpolatedEnv,
        sleep: interpolatedSleep,
        alignmentScore,
      });

      totalAlignmentScore += alignmentScore;
      totalEnvDelay += envDistance;
      totalSleepDelay += sleepDistance;
      delayCount++;
    }

    return {
      alignedData,
      alignmentStats: {
        totalPoints: targetTimestamps.length,
        alignedPoints: alignedData.length,
        missingPoints: missingCount,
        averageAlignmentScore: alignedData.length > 0 ? totalAlignmentScore / alignedData.length : 0,
        avgEnvDelayMs: delayCount > 0 ? totalEnvDelay / delayCount : 0,
        avgSleepDelayMs: delayCount > 0 ? totalSleepDelay / delayCount : 0,
      },
    };
  }

  private findNearestPoints<T extends { timestamp: number }>(
    window: DataWindow<T>,
    targetTs: number
  ): { prev: T; next: T } | null {
    const { points } = window;
    const n = points.length;

    while (window.currentIndex < n - 1 && points[window.currentIndex + 1].timestamp <= targetTs) {
      window.currentIndex++;
    }

    if (window.currentIndex >= n) return null;

    const current = points[window.currentIndex];

    if (current.timestamp >= targetTs) {
      if (window.currentIndex === 0) {
        return { prev: current, next: current };
      }
      const prev = points[window.currentIndex - 1];
      return { prev, next: current };
    }

    if (window.currentIndex === n - 1) {
      return { prev: current, next: current };
    }

    const next = points[window.currentIndex + 1];
    return { prev: current, next };
  }

  private interpolateEnvPoint(
    match: { prev: EnvDataPoint; next: EnvDataPoint },
    targetTs: number
  ): EnvDataPoint {
    const { prev, next } = match;

    if (prev.timestamp === next.timestamp || this.config.interpolationMethod === 'none') {
      return Math.abs(targetTs - prev.timestamp) <= Math.abs(targetTs - next.timestamp) ? prev : next;
    }

    if (this.config.interpolationMethod === 'nearest') {
      return Math.abs(targetTs - prev.timestamp) <= Math.abs(targetTs - next.timestamp) ? prev : next;
    }

    const ratio = (targetTs - prev.timestamp) / (next.timestamp - prev.timestamp);

    return {
      id: prev.id,
      sessionId: prev.sessionId,
      timestamp: targetTs,
      lightLux: linearInterpolation(targetTs, prev.timestamp, next.timestamp, prev.lightLux, next.lightLux),
      temperatureC: linearInterpolation(targetTs, prev.timestamp, next.timestamp, prev.temperatureC, next.temperatureC),
      noiseDb: linearInterpolation(targetTs, prev.timestamp, next.timestamp, prev.noiseDb, next.noiseDb),
      humidity: prev.humidity !== undefined && next.humidity !== undefined
        ? linearInterpolation(targetTs, prev.timestamp, next.timestamp, prev.humidity, next.humidity)
        : prev.humidity ?? next.humidity,
    };
  }

  private interpolateSleepPoint(
    match: { prev: SleepStagePoint; next: SleepStagePoint },
    targetTs: number
  ): SleepStagePoint {
    const { prev, next } = match;

    if (prev.timestamp === next.timestamp || this.config.interpolationMethod === 'none') {
      return Math.abs(targetTs - prev.timestamp) <= Math.abs(targetTs - next.timestamp) ? prev : next;
    }

    if (this.config.interpolationMethod === 'nearest') {
      return Math.abs(targetTs - prev.timestamp) <= Math.abs(targetTs - next.timestamp) ? prev : next;
    }

    const ratio = (targetTs - prev.timestamp) / (next.timestamp - prev.timestamp);
    const usePrev = ratio < 0.5;
    const source = usePrev ? prev : next;

    return {
      id: source.id,
      sessionId: source.sessionId,
      timestamp: targetTs,
      stage: source.stage,
      confidence: linearInterpolation(targetTs, prev.timestamp, next.timestamp, prev.confidence, next.confidence),
      heartRate: prev.heartRate !== undefined && next.heartRate !== undefined
        ? linearInterpolation(targetTs, prev.timestamp, next.timestamp, prev.heartRate, next.heartRate)
        : prev.heartRate ?? next.heartRate,
      respiration: prev.respiration !== undefined && next.respiration !== undefined
        ? linearInterpolation(targetTs, prev.timestamp, next.timestamp, prev.respiration, next.respiration)
        : prev.respiration ?? next.respiration,
      movement: prev.movement !== undefined && next.movement !== undefined
        ? linearInterpolation(targetTs, prev.timestamp, next.timestamp, prev.movement, next.movement)
        : prev.movement ?? next.movement,
    };
  }

  private calculateAlignmentScore(envDistance: number, sleepDistance: number): number {
    const maxDistance = this.config.windowSizeMs;
    const envScore = Math.max(0, 1 - envDistance / maxDistance);
    const sleepScore = Math.max(0, 1 - sleepDistance / maxDistance);
    return (envScore + sleepScore) / 2;
  }

  public calculateOptimalLag(
    envData: EnvDataPoint[],
    sleepData: SleepStagePoint[],
    maxLagMs: number = 30000,
    stepMs: number = 1000
  ): { optimalLagMs: number; correlationAtLag: number; allCorrelations: Array<{ lagMs: number; correlation: number }> } {
    const envValues = envData.map(d => d.noiseDb);
    const sleepValues = sleepData.map(d => d.stage);

    const minLen = Math.min(envValues.length, sleepValues.length);
    const x = envValues.slice(0, minLen);
    const y = sleepValues.slice(0, minLen);

    const results: Array<{ lagMs: number; correlation: number }> = [];
    const maxLagSteps = Math.floor(maxLagMs / stepMs);

    for (let lagSteps = -maxLagSteps; lagSteps <= maxLagSteps; lagSteps++) {
      const lagMs = lagSteps * stepMs;
      const xSubset = lagSteps >= 0 ? x.slice(0, minLen - lagSteps) : x.slice(-lagSteps);
      const ySubset = lagSteps >= 0 ? y.slice(lagSteps) : y.slice(0, minLen + lagSteps);

      const correlation = this.quickCorrelation(xSubset, ySubset);
      results.push({ lagMs, correlation });
    }

    const best = results.reduce((best, current) =>
      Math.abs(current.correlation) > Math.abs(best.correlation) ? current : best
    );

    return {
      optimalLagMs: best.lagMs,
      correlationAtLag: best.correlation,
      allCorrelations: results,
    };
  }

  private quickCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  public applyLagCorrection(
    data: AlignedDataPoint[],
    lagMs: number
  ): AlignedDataPoint[] {
    return data.map(point => ({
      ...point,
      timestamp: point.timestamp + lagMs,
    }));
  }

  public detectMissingSegments(
    data: AlignedDataPoint[],
    thresholdMs: number = 5000
  ): Array<{ start: number; end: number; durationMs: number }> {
    const gaps: Array<{ start: number; end: number; durationMs: number }> = [];

    for (let i = 1; i < data.length; i++) {
      const gap = data[i].timestamp - data[i - 1].timestamp;
      if (gap > thresholdMs) {
        gaps.push({
          start: data[i - 1].timestamp,
          end: data[i].timestamp,
          durationMs: gap,
        });
      }
    }

    return gaps;
  }

  public validateDataQuality(
    envData: EnvDataPoint[],
    sleepData: SleepStagePoint[]
  ): {
    envQuality: number;
    sleepQuality: number;
    overallQuality: number;
    issues: string[];
  } {
    const issues: string[] = [];

    if (envData.length === 0) issues.push('环境数据为空');
    if (sleepData.length === 0) issues.push('睡眠数据为空');

    const envCoverage = this.calculateCoverage(envData);
    const sleepCoverage = this.calculateCoverage(sleepData);

    const envSamplingRegularity = this.calculateSamplingRegularity(envData);
    const sleepSamplingRegularity = this.calculateSamplingRegularity(sleepData);

    const envQuality = envCoverage * 0.6 + envSamplingRegularity * 0.4;
    const sleepQuality = sleepCoverage * 0.6 + sleepSamplingRegularity * 0.4;
    const overallQuality = (envQuality + sleepQuality) / 2;

    if (envCoverage < 0.8) issues.push(`环境数据覆盖率较低 (${(envCoverage * 100).toFixed(1)}%)`);
    if (sleepCoverage < 0.8) issues.push(`睡眠数据覆盖率较低 (${(sleepCoverage * 100).toFixed(1)}%)`);
    if (envSamplingRegularity < 0.7) issues.push('环境数据采样间隔不规则');
    if (sleepSamplingRegularity < 0.7) issues.push('睡眠数据采样间隔不规则');

    return { envQuality, sleepQuality, overallQuality, issues };
  }

  private calculateCoverage<T extends { timestamp: number }>(data: T[]): number {
    if (data.length < 2) return data.length === 0 ? 0 : 1;

    const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const duration = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
    if (duration === 0) return 1;

    const expectedPoints = duration / this.config.targetIntervalMs + 1;
    return Math.min(1, data.length / expectedPoints);
  }

  private calculateSamplingRegularity<T extends { timestamp: number }>(data: T[]): number {
    if (data.length < 3) return 1;

    const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const intervals: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp);
    }

    const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => {
      const diff = interval - meanInterval;
      return sum + diff * diff;
    }, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    return Math.max(0, 1 - stdDev / meanInterval);
  }
}
