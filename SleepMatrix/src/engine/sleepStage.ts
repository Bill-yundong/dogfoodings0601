import type { SleepStage, SleepStagePoint, SleepMetrics } from '@/types/data';
import { mean, stdDev, movingAverage } from '@/utils/math';

export interface SleepStageConfig {
  hrDeepSleepRange: [number, number];
  hrLightSleepRange: [number, number];
  hrRemRange: [number, number];
  hrAwakeRange: [number, number];
  stageTransitionSmoothing: number;
  minStageDuration: number;
}

export const DEFAULT_SLEEP_STAGE_CONFIG: SleepStageConfig = {
  hrDeepSleepRange: [40, 55],
  hrLightSleepRange: [50, 65],
  hrRemRange: [55, 75],
  hrAwakeRange: [65, 100],
  stageTransitionSmoothing: 5,
  minStageDuration: 30,
};

export class SleepStageEngine {
  private config: SleepStageConfig;

  constructor(config: Partial<SleepStageConfig> = {}) {
    this.config = { ...DEFAULT_SLEEP_STAGE_CONFIG, ...config };
  }

  public detectStage(
    heartRate: number,
    respiration: number = 16,
    movement: number = 0,
    previousStage: SleepStage = 4
  ): { stage: SleepStage; confidence: number } {
    const scores: Record<SleepStage, number> = {
      0: this.calculateAwakeScore(heartRate, respiration, movement),
      1: this.calculateRemScore(heartRate, respiration, movement, previousStage),
      2: this.calculateLightSleepScore(heartRate, respiration, movement),
      3: this.calculateDeepSleepScore(heartRate, respiration, movement),
      4: 0,
    };

    let bestStage: SleepStage = 4;
    let bestScore = -Infinity;

    for (const [stageStr, score] of Object.entries(scores)) {
      const stage = parseInt(stageStr) as SleepStage;
      const transitionBonus = stage === previousStage ? 0.1 : 0;
      const totalScore = score + transitionBonus;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestStage = stage;
      }
    }

    const confidence = this.calculateConfidence(scores, bestStage, heartRate, movement);

    return { stage: bestStage, confidence };
  }

  private calculateAwakeScore(hr: number, respiration: number, movement: number): number {
    let score = 0;

    if (hr >= this.config.hrAwakeRange[0] && hr <= this.config.hrAwakeRange[1]) {
      score += 0.4;
    } else if (hr > this.config.hrAwakeRange[1]) {
      score += 0.5;
    }

    if (respiration > 18) score += 0.2;
    if (movement > 0.5) score += 0.4;

    return score;
  }

  private calculateRemScore(
    hr: number,
    respiration: number,
    movement: number,
    previousStage: SleepStage
  ): number {
    let score = 0;

    if (hr >= this.config.hrRemRange[0] && hr <= this.config.hrRemRange[1]) {
      score += 0.4;
    }

    if (respiration >= 14 && respiration <= 20) score += 0.2;
    if (movement < 0.3) score += 0.2;

    if (previousStage === 2) score += 0.2;

    return score;
  }

  private calculateLightSleepScore(hr: number, respiration: number, movement: number): number {
    let score = 0;

    if (hr >= this.config.hrLightSleepRange[0] && hr <= this.config.hrLightSleepRange[1]) {
      score += 0.5;
    }

    if (respiration >= 12 && respiration <= 18) score += 0.25;
    if (movement < 0.2) score += 0.25;

    return score;
  }

  private calculateDeepSleepScore(hr: number, respiration: number, movement: number): number {
    let score = 0;

    if (hr >= this.config.hrDeepSleepRange[0] && hr <= this.config.hrDeepSleepRange[1]) {
      score += 0.5;
    } else if (hr < this.config.hrDeepSleepRange[0]) {
      score += 0.4;
    }

    if (respiration >= 8 && respiration <= 14) score += 0.25;
    if (movement < 0.1) score += 0.25;

    return score;
  }

  private calculateConfidence(
    scores: Record<SleepStage, number>,
    bestStage: SleepStage,
    heartRate: number,
    movement: number
  ): number {
    const allScores = Object.values(scores);
    const bestScore = scores[bestStage];
    const secondBest = allScores
      .filter((_, i) => i !== bestStage)
      .reduce((max, s) => Math.max(max, s), 0);

    const margin = bestScore - secondBest;
    const marginConfidence = Math.min(1, margin * 3);

    const hrVariability = heartRate > 40 && heartRate < 100 ? 1 : 0.5;
    const movementConfidence = movement < 0.5 ? 1 : 0.7;

    return (marginConfidence * 0.5 + hrVariability * 0.25 + movementConfidence * 0.25);
  }

  public smoothStages(stages: SleepStagePoint[]): SleepStagePoint[] {
    if (stages.length < this.config.stageTransitionSmoothing) return stages;

    const stageValues = stages.map(s => s.stage);
    const smoothedValues = movingAverage(stageValues, this.config.stageTransitionSmoothing);

    return stages.map((point, i) => ({
      ...point,
      stage: Math.round(smoothedValues[i]) as SleepStage,
      confidence: Math.min(1, point.confidence + 0.1),
    }));
  }

  public enforceMinimumDuration(stages: SleepStagePoint[]): SleepStagePoint[] {
    if (stages.length === 0) return stages;

    const result: SleepStagePoint[] = [];
    let currentStage = stages[0].stage;
    let currentStart = 0;

    for (let i = 1; i <= stages.length; i++) {
      if (i === stages.length || stages[i].stage !== currentStage) {
        const duration = i - currentStart;

        if (duration < this.config.minStageDuration && result.length > 0) {
          const prevStage = result[result.length - 1].stage;
          for (let j = currentStart; j < i; j++) {
            result.push({ ...stages[j], stage: prevStage });
          }
        } else {
          for (let j = currentStart; j < i; j++) {
            result.push(stages[j]);
          }
        }

        if (i < stages.length) {
          currentStage = stages[i].stage;
          currentStart = i;
        }
      }
    }

    return result;
  }

  public calculateSleepMetrics(stages: SleepStagePoint[]): SleepMetrics {
    if (stages.length === 0) {
      return {
        sleepScore: 0,
        deepSleepRatio: 0,
        remSleepRatio: 0,
        sleepEfficiency: 0,
        sleepLatency: 0,
        awakenings: 0,
      };
    }

    const totalDuration = stages.length;
    const deepSleepCount = stages.filter(s => s.stage === 3).length;
    const remCount = stages.filter(s => s.stage === 1).length;
    const lightSleepCount = stages.filter(s => s.stage === 2).length;
    const awakeCount = stages.filter(s => s.stage === 0).length;

    const sleepDuration = deepSleepCount + remCount + lightSleepCount;
    const sleepEfficiency = sleepDuration / totalDuration;

    let sleepLatency = 0;
    for (let i = 0; i < stages.length; i++) {
      if (stages[i].stage !== 0) {
        sleepLatency = i;
        break;
      }
    }

    let awakenings = 0;
    for (let i = 1; i < stages.length; i++) {
      if (stages[i].stage === 0 && stages[i - 1].stage !== 0) {
        awakenings++;
      }
    }

    const deepSleepRatio = deepSleepCount / totalDuration;
    const remSleepRatio = remCount / totalDuration;

    const deepSleepScore = Math.min(1, deepSleepRatio / 0.2) * 30;
    const remSleepScore = Math.min(1, remSleepRatio / 0.25) * 25;
    const efficiencyScore = sleepEfficiency * 25;
    const latencyScore = sleepLatency < 30 ? 10 : Math.max(0, 10 - (sleepLatency - 30) / 30 * 10);
    const awakeningScore = awakenings < 2 ? 10 : Math.max(0, 10 - (awakenings - 2) * 2);

    const sleepScore = deepSleepScore + remSleepScore + efficiencyScore + latencyScore + awakeningScore;

    return {
      sleepScore: Math.min(100, Math.max(0, sleepScore)),
      deepSleepRatio,
      remSleepRatio,
      sleepEfficiency,
      sleepLatency,
      awakenings,
    };
  }

  public detectSleepCycles(stages: SleepStagePoint[]): Array<{
    startTime: number;
    endTime: number;
    duration: number;
    hasDeepSleep: boolean;
    hasRem: boolean;
  }> {
    const cycles: Array<{
      startTime: number;
      endTime: number;
      duration: number;
      hasDeepSleep: boolean;
      hasRem: boolean;
    }> = [];

    if (stages.length < 90) return cycles;

    let cycleStart = 0;
    let inCycle = false;
    let hasDeepSleep = false;
    let hasRem = false;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i].stage;

      if (!inCycle && stage === 2) {
        cycleStart = i;
        inCycle = true;
        hasDeepSleep = false;
        hasRem = false;
      }

      if (inCycle) {
        if (stage === 3) hasDeepSleep = true;
        if (stage === 1) hasRem = true;

        const cycleDuration = i - cycleStart;
        if (cycleDuration >= 90 && stage === 0) {
          cycles.push({
            startTime: stages[cycleStart].timestamp,
            endTime: stages[i].timestamp,
            duration: cycleDuration,
            hasDeepSleep,
            hasRem,
          });
          inCycle = false;
        }
      }
    }

    return cycles;
  }

  public calculateHRV(heartRates: number[]): {
    rmssd: number;
    sdnn: number;
    pnn50: number;
  } {
    if (heartRates.length < 2) {
      return { rmssd: 0, sdnn: 0, pnn50: 0 };
    }

    const intervals = heartRates.map(hr => 60000 / hr);
    const differences: number[] = [];

    for (let i = 1; i < intervals.length; i++) {
      differences.push(intervals[i] - intervals[i - 1]);
    }

    const squaredDifferences = differences.map(d => d * d);
    const rmssd = Math.sqrt(mean(squaredDifferences));

    const sdnn = stdDev(intervals);

    const nn50 = differences.filter(d => Math.abs(d) > 50).length;
    const pnn50 = (nn50 / differences.length) * 100;

    return { rmssd, sdnn, pnn50 };
  }

  public classifySleepArchitecture(stages: SleepStagePoint[]): {
    pattern: 'normal' | 'fragmented' | 'delayed' | 'advanced' | 'short';
    description: string;
  } {
    const metrics = this.calculateSleepMetrics(stages);

    if (metrics.sleepScore >= 80 && metrics.sleepEfficiency >= 0.85) {
      return {
        pattern: 'normal',
        description: '睡眠结构正常，周期规律，深睡和REM比例合理',
      };
    }

    if (metrics.awakenings > 3 || metrics.sleepEfficiency < 0.7) {
      return {
        pattern: 'fragmented',
        description: '睡眠碎片化，夜间觉醒次数较多，睡眠效率较低',
      };
    }

    if (metrics.sleepLatency > 60) {
      return {
        pattern: 'delayed',
        description: '入睡潜伏期较长，可能存在入睡困难',
      };
    }

    if (stages.length < 360) {
      return {
        pattern: 'short',
        description: '睡眠时间较短，未达到推荐的睡眠时长',
      };
    }

    return {
      pattern: 'normal',
      description: '睡眠结构基本正常',
    };
  }
}
