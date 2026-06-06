import type { AlignedDataPoint } from '@/types/data';
import type {
  CorrelationResult,
  CorrelationMatrix,
  SensitivityScore,
  Recommendation,
  AnalysisResult,
  TimeLagCorrelation,
  PartialCorrelationResult,
  KeyInsight,
} from '@/types/analysis';
import {
  pearsonCorrelation,
  spearmanRankCorrelation,
  pValueForCorrelation,
  partialCorrelation,
  crossCorrelation,
  mean,
  stdDev,
  normalize,
} from '@/utils/math';
import { OPTIMAL_RANGES, VARIABLE_LABELS } from '@/types/analysis';
import { v4 as uuidv4 } from 'uuid';

export interface CorrelationAnalysisConfig {
  significanceLevel: number;
  minSampleSize: number;
  includePartialCorrelation: boolean;
  includeTimeLag: boolean;
  maxLagSeconds: number;
}

export const DEFAULT_CORRELATION_CONFIG: CorrelationAnalysisConfig = {
  significanceLevel: 0.05,
  minSampleSize: 30,
  includePartialCorrelation: true,
  includeTimeLag: true,
  maxLagSeconds: 60,
};

export interface VariableExtractor {
  name: string;
  label: string;
  extract: (point: AlignedDataPoint) => number;
}

export const DEFAULT_VARIABLES: VariableExtractor[] = [
  { name: 'lightLux', label: '光照', extract: p => p.env.lightLux },
  { name: 'temperatureC', label: '温度', extract: p => p.env.temperatureC },
  { name: 'noiseDb', label: '噪音', extract: p => p.env.noiseDb },
  { name: 'humidity', label: '湿度', extract: p => p.env.humidity ?? 50 },
  { name: 'sleepStage', label: '睡眠分期', extract: p => p.sleep.stage },
  { name: 'confidence', label: '检测置信度', extract: p => p.sleep.confidence },
  { name: 'heartRate', label: '心率', extract: p => p.sleep.heartRate ?? 60 },
  { name: 'respiration', label: '呼吸频率', extract: p => p.sleep.respiration ?? 16 },
];

export class CorrelationAnalysisEngine {
  private config: CorrelationAnalysisConfig;

  constructor(config: Partial<CorrelationAnalysisConfig> = {}) {
    this.config = { ...DEFAULT_CORRELATION_CONFIG, ...config };
  }

  public async runFullAnalysis(
    alignedData: AlignedDataPoint[],
    sessionId: string,
    variables: VariableExtractor[] = DEFAULT_VARIABLES
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    const filteredData = this.filterValidData(alignedData);
    const dataQuality = this.calculateDataQuality(filteredData);

    const correlationMatrix = this.calculateCorrelationMatrix(filteredData, variables);
    const sensitivityScores = this.calculateSensitivityScores(filteredData, variables);
    const recommendations = this.generateRecommendations(filteredData, correlationMatrix, sensitivityScores);
    const keyInsights = this.generateKeyInsights(correlationMatrix, sensitivityScores);
    const overallScore = this.calculateOverallScore(correlationMatrix, sensitivityScores, dataQuality);

    return {
      id: uuidv4(),
      sessionId,
      correlationMatrix,
      sensitivityScores,
      recommendations,
      keyInsights,
      overallScore,
      analyzedAt: Date.now(),
      analysisDuration: Date.now() - startTime,
      dataQuality,
    };
  }

  private filterValidData(data: AlignedDataPoint[]): AlignedDataPoint[] {
    return data.filter(p =>
      p.alignmentScore >= 0.5 &&
      p.sleep.stage !== 4 &&
      p.sleep.confidence >= 0.3
    );
  }

  private calculateDataQuality(data: AlignedDataPoint[]): number {
    if (data.length === 0) return 0;

    const avgAlignmentScore = mean(data.map(d => d.alignmentScore));
    const avgConfidence = mean(data.map(d => d.sleep.confidence));
    const sampleSizeScore = Math.min(1, data.length / 1000);

    return (avgAlignmentScore * 0.4 + avgConfidence * 0.3 + sampleSizeScore * 0.3);
  }

  public calculateCorrelationMatrix(
    data: AlignedDataPoint[],
    variables: VariableExtractor[]
  ): CorrelationMatrix {
    const n = variables.length;
    const matrix: CorrelationResult[][] = [];

    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = {
            variableX: variables[i].name,
            variableY: variables[j].name,
            pearson: 1,
            spearman: 1,
            pValue: 0,
            sampleSize: data.length,
            significant: true,
          };
        } else {
          const x = data.map(variables[i].extract);
          const y = data.map(variables[j].extract);

          const pearson = pearsonCorrelation(x, y);
          const spearman = spearmanRankCorrelation(x, y);
          const pValue = pValueForCorrelation(pearson, data.length);

          matrix[i][j] = {
            variableX: variables[i].name,
            variableY: variables[j].name,
            pearson,
            spearman,
            pValue,
            sampleSize: data.length,
            significant: pValue < this.config.significanceLevel,
          };
        }
      }
    }

    return {
      variables: variables.map(v => v.name),
      matrix,
      timestamp: Date.now(),
      sessionId: '',
    };
  }

  public calculatePartialCorrelations(
    data: AlignedDataPoint[],
    targetVar: VariableExtractor,
    dependentVar: VariableExtractor,
    controlVars: VariableExtractor[]
  ): PartialCorrelationResult {
    const x = data.map(targetVar.extract);
    const y = data.map(dependentVar.extract);
    const controls = controlVars.map(v => data.map(v.extract));

    const partialCorr = partialCorrelation(x, y, controls);
    const pValue = pValueForCorrelation(partialCorr, data.length - controlVars.length);

    return {
      variableX: targetVar.name,
      variableY: dependentVar.name,
      controlVariables: controlVars.map(v => v.name),
      partialCorrelation: partialCorr,
      pValue,
      degreesOfFreedom: data.length - controlVars.length - 2,
    };
  }

  public calculateTimeLagCorrelations(
    data: AlignedDataPoint[],
    envVar: VariableExtractor,
    sleepVar: VariableExtractor
  ): TimeLagCorrelation[] {
    const x = data.map(envVar.extract);
    const y = data.map(sleepVar.extract);
    const maxLag = Math.min(this.config.maxLagSeconds, Math.floor(data.length / 4));

    const results = crossCorrelation(x, y, maxLag);
    return results.map(r => ({
      lag: r.lag,
      correlation: r.correlation,
      variableX: envVar.name,
      variableY: sleepVar.name,
    }));
  }

  public calculateSensitivityScores(
    data: AlignedDataPoint[],
    variables: VariableExtractor[]
  ): Record<string, SensitivityScore> {
    const scores: Record<string, SensitivityScore> = {};
    const sleepStageVar = variables.find(v => v.name === 'sleepStage');
    if (!sleepStageVar) return scores;

    const envVariables = variables.filter(v =>
      ['lightLux', 'temperatureC', 'noiseDb', 'humidity'].includes(v.name)
    );

    const sleepValues = data.map(sleepStageVar.extract);

    for (const envVar of envVariables) {
      const envValues = data.map(envVar.extract);
      const correlation = pearsonCorrelation(envValues, sleepValues);
      const absCorrelation = Math.abs(correlation);

      const normalizedEnv = normalize(envValues);
      const normalizedSleep = normalize(sleepValues);

      const slope = this.calculateRegressionSlope(normalizedEnv, normalizedSleep);

      const optimalRange = OPTIMAL_RANGES[envVar.name];
      const currentValues = envValues.filter(v =>
        v >= optimalRange[0] && v <= optimalRange[1]
      );
      const inRangeRatio = currentValues.length / envValues.length;

      const confidence = this.calculateConfidence(envValues, sleepValues, absCorrelation);

      scores[envVar.name] = {
        parameter: envVar.name,
        score: absCorrelation * (1 - inRangeRatio) * 100,
        unit: this.getUnitForParameter(envVar.name),
        direction: correlation > 0.05 ? 'positive' : correlation < -0.05 ? 'negative' : 'neutral',
        confidence,
      };
    }

    return scores;
  }

  private calculateRegressionSlope(x: number[], y: number[]): number {
    if (x.length < 2) return 0;

    const meanX = mean(x);
    const meanY = mean(y);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < x.length; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += Math.pow(x[i] - meanX, 2);
    }

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateConfidence(x: number[], y: number[], correlation: number): number {
    const sampleSizeScore = Math.min(1, x.length / 500);
    const correlationStrength = Math.min(1, Math.abs(correlation) / 0.5);
    const varianceX = stdDev(x) / (mean(x) || 1);
    const varianceY = stdDev(y) / (mean(y) || 1);
    const varianceScore = Math.min(1, (varianceX + varianceY) / 2);

    return (sampleSizeScore * 0.4 + correlationStrength * 0.4 + varianceScore * 0.2);
  }

  private getUnitForParameter(param: string): string {
    const units: Record<string, string> = {
      lightLux: 'lux',
      temperatureC: '°C',
      noiseDb: 'dB',
      humidity: '%',
    };
    return units[param] || '';
  }

  public generateRecommendations(
    data: AlignedDataPoint[],
    correlationMatrix: CorrelationMatrix,
    sensitivityScores: Record<string, SensitivityScore>
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const sleepStageIndex = correlationMatrix.variables.indexOf('sleepStage');

    if (sleepStageIndex === -1) return recommendations;

    const currentValues = this.calculateCurrentValues(data);

    for (const [param, sensitivity] of Object.entries(sensitivityScores)) {
      if (sensitivity.confidence < 0.3) continue;

      const paramIndex = correlationMatrix.variables.indexOf(param);
      const correlation = paramIndex !== -1
        ? correlationMatrix.matrix[paramIndex][sleepStageIndex]
        : null;

      const optimalRange = OPTIMAL_RANGES[param];
      const currentValue = currentValues[param];
      const inRange = currentValue >= optimalRange[0] && currentValue <= optimalRange[1];

      if (inRange && Math.abs(sensitivity.score) < 20) continue;

      const priority = this.determinePriority(sensitivity.score, sensitivity.confidence, inRange);
      const expectedImprovement = this.calculateExpectedImprovement(sensitivity, currentValue, optimalRange);

      recommendations.push({
        id: uuidv4(),
        type: param as 'light' | 'temperature' | 'noise' | 'humidity',
        priority,
        parameter: param,
        currentValue,
        targetRange: optimalRange,
        expectedImprovement,
        confidence: sensitivity.confidence,
        description: this.generateRecommendationText(param, currentValue, optimalRange, sensitivity, correlation),
        actionable: true,
      });
    }

    if (recommendations.length > 1) {
      const combinedRec = this.generateCombinedRecommendation(recommendations, data);
      if (combinedRec) recommendations.push(combinedRec);
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.expectedImprovement - a.expectedImprovement;
    });
  }

  private calculateCurrentValues(data: AlignedDataPoint[]): Record<string, number> {
    return {
      lightLux: mean(data.map(d => d.env.lightLux)),
      temperatureC: mean(data.map(d => d.env.temperatureC)),
      noiseDb: mean(data.map(d => d.env.noiseDb)),
      humidity: mean(data.map(d => d.env.humidity ?? 50)),
    };
  }

  private determinePriority(
    score: number,
    confidence: number,
    inRange: boolean
  ): 'high' | 'medium' | 'low' {
    if (inRange) return 'low';
    if (score >= 50 && confidence >= 0.7) return 'high';
    if (score >= 30 && confidence >= 0.5) return 'medium';
    return 'low';
  }

  private calculateExpectedImprovement(
    sensitivity: SensitivityScore,
    currentValue: number,
    targetRange: [number, number]
  ): number {
    const [min, max] = targetRange;
    const midpoint = (min + max) / 2;
    const distance = Math.abs(currentValue - midpoint);
    const range = max - min;
    const normalizedDistance = distance / range;

    return Math.min(100, sensitivity.score * normalizedDistance);
  }

  private generateRecommendationText(
    param: string,
    currentValue: number,
    targetRange: [number, number],
    sensitivity: SensitivityScore,
    correlation: CorrelationResult | null
  ): string {
    const [min, max] = targetRange;
    const labels: Record<string, string> = {
      lightLux: '光照强度',
      temperatureC: '环境温度',
      noiseDb: '环境噪音',
      humidity: '空气湿度',
    };

    const label = labels[param] || param;
    const unit = this.getUnitForParameter(param);

    if (currentValue < min) {
      const direction = sensitivity.direction === 'negative' ? '升高' : '降低';
      return `${label}当前为 ${currentValue.toFixed(1)}${unit}，建议${direction}至 ${min}-${max}${unit} 范围，预计可改善睡眠质量约 ${sensitivity.score.toFixed(0)}%`;
    } else if (currentValue > max) {
      const direction = sensitivity.direction === 'negative' ? '降低' : '升高';
      return `${label}当前为 ${currentValue.toFixed(1)}${unit}，建议${direction}至 ${min}-${max}${unit} 范围，预计可改善睡眠质量约 ${sensitivity.score.toFixed(0)}%`;
    } else {
      return `${label}当前为 ${currentValue.toFixed(1)}${unit}，处于最佳范围 ${min}-${max}${unit} 内，保持当前状态`;
    }
  }

  private generateCombinedRecommendation(
    recommendations: Recommendation[],
    data: AlignedDataPoint[]
  ): Recommendation | null {
    const highPriority = recommendations.filter(r => r.priority === 'high');
    if (highPriority.length < 2) return null;

    const params = highPriority.map(r => VARIABLE_LABELS[r.parameter] || r.parameter).join('、');
    const totalImprovement = highPriority.reduce((sum, r) => sum + r.expectedImprovement, 0) / highPriority.length;
    const avgConfidence = highPriority.reduce((sum, r) => sum + r.confidence, 0) / highPriority.length;

    return {
      id: uuidv4(),
      type: 'combined',
      priority: 'high',
      parameter: 'combined',
      currentValue: 0,
      targetRange: [0, 0],
      expectedImprovement: totalImprovement,
      confidence: avgConfidence,
      description: `综合分析显示，${params} 多个环境参数需要协同优化，建议同时调整以获得最佳睡眠改善效果`,
      actionable: true,
    };
  }

  private calculateOverallScore(
    correlationMatrix: CorrelationMatrix,
    sensitivityScores: Record<string, SensitivityScore>,
    dataQuality: number
  ): number {
    const sleepStageIndex = correlationMatrix.variables.indexOf('sleepStage');
    if (sleepStageIndex === -1) return 0;

    const envIndices = correlationMatrix.variables
      .map((v, i) => ['lightLux', 'temperatureC', 'noiseDb', 'humidity'].includes(v) ? i : -1)
      .filter(i => i !== -1);

    let totalCorrelation = 0;
    for (const idx of envIndices) {
      totalCorrelation += Math.abs(correlationMatrix.matrix[idx][sleepStageIndex].pearson);
    }
    const avgCorrelation = totalCorrelation / envIndices.length;

    const sensitivityValues = Object.values(sensitivityScores);
    const avgSensitivity = sensitivityValues.length > 0
      ? mean(sensitivityValues.map(s => s.score)) / 100
      : 0;

    const score = (
      avgCorrelation * 0.35 +
      avgSensitivity * 0.35 +
      dataQuality * 0.3
    ) * 100;

    return Math.max(0, Math.min(100, score));
  }

  public generateKeyInsights(
    correlationMatrix: CorrelationMatrix,
    sensitivityScores: Record<string, SensitivityScore>
  ): KeyInsight[] {
    const insights: KeyInsight[] = [];
    const sleepStageIndex = correlationMatrix.variables.indexOf('sleepStage');

    if (sleepStageIndex === -1) return insights;

    const significantCorrelations = this.findSignificantCorrelations(correlationMatrix);
    const envVariables = ['lightLux', 'temperatureC', 'noiseDb', 'humidity'];

    for (const corr of significantCorrelations) {
      const isEnvSleepCorrelation = 
        (envVariables.includes(corr.variableX) && corr.variableY === 'sleepStage') ||
        (envVariables.includes(corr.variableY) && corr.variableX === 'sleepStage');

      if (!isEnvSleepCorrelation) continue;

      const envVar = envVariables.includes(corr.variableX) ? corr.variableX : corr.variableY;
      const sensitivity = sensitivityScores[envVar];
      const label = VARIABLE_LABELS[envVar] || envVar;

      let severity: 'positive' | 'warning' | 'negative' | 'neutral' = 'neutral';
      let message = '';

      if (Math.abs(corr.pearson) >= 0.5) {
        severity = corr.pearson > 0 ? 'negative' : 'positive';
        const direction = corr.pearson > 0 ? '升高' : '降低';
        message = `${label}与睡眠质量呈${direction}强相关（${Math.round(Math.abs(corr.pearson) * 100)}%），建议重点关注`;
      } else if (Math.abs(corr.pearson) >= 0.3) {
        severity = corr.pearson > 0 ? 'warning' : 'positive';
        const direction = corr.pearson > 0 ? '升高' : '降低';
        message = `${label}与睡眠质量呈${direction}中度相关（${Math.round(Math.abs(corr.pearson) * 100)}%），可考虑优化`;
      }

      if (severity !== 'neutral') {
        insights.push({
          id: uuidv4(),
          message,
          severity,
          correlation: corr.pearson,
          variables: [corr.variableX, corr.variableY],
        });
      }
    }

    for (const [param, score] of Object.entries(sensitivityScores)) {
      if (score.score >= 40 && score.confidence >= 0.6) {
        const label = VARIABLE_LABELS[param] || param;
        insights.push({
          id: uuidv4(),
          message: `${label}灵敏度评分较高（${score.score.toFixed(0)}分），优化该参数可显著改善睡眠质量`,
          severity: score.direction === 'negative' ? 'negative' : 'warning',
          correlation: score.score / 100,
          variables: [param, 'sleepStage'],
        });
      }
    }

    return insights.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).slice(0, 6);
  }

  public findSignificantCorrelations(
    correlationMatrix: CorrelationMatrix
  ): CorrelationResult[] {
    const significant: CorrelationResult[] = [];
    const n = correlationMatrix.matrix.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const result = correlationMatrix.matrix[i][j];
        if (result.significant && Math.abs(result.pearson) >= 0.3) {
          significant.push(result);
        }
      }
    }

    return significant.sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson));
  }

  public calculateSleepQualityIndex(
    data: AlignedDataPoint[],
    correlationMatrix: CorrelationMatrix
  ): number {
    const deepSleepRatio = data.filter(d => d.sleep.stage === 3).length / data.length;
    const remRatio = data.filter(d => d.sleep.stage === 1).length / data.length;
    const awakeRatio = data.filter(d => d.sleep.stage === 0).length / data.length;

    const sleepStageScore = (deepSleepRatio * 40 + remRatio * 30 + (1 - awakeRatio) * 30);

    const envIndices = correlationMatrix.variables
      .map((v, i) => ['lightLux', 'temperatureC', 'noiseDb', 'humidity'].includes(v) ? i : -1)
      .filter(i => i !== -1);
    const sleepStageIndex = correlationMatrix.variables.indexOf('sleepStage');

    let envImpactScore = 0;
    if (sleepStageIndex !== -1) {
      for (const idx of envIndices) {
        const corr = correlationMatrix.matrix[idx][sleepStageIndex].pearson;
        const varName = correlationMatrix.variables[idx];
        const optimal = OPTIMAL_RANGES[varName];
        const values = data.map(d => {
          switch (varName) {
            case 'lightLux': return d.env.lightLux;
            case 'temperatureC': return d.env.temperatureC;
            case 'noiseDb': return d.env.noiseDb;
            case 'humidity': return d.env.humidity ?? 50;
            default: return 0;
          }
        });
        const avgValue = mean(values);
        const inOptimal = avgValue >= optimal[0] && avgValue <= optimal[1];
        envImpactScore += (inOptimal ? 1 : 0.5) * (1 - Math.abs(corr)) * 25;
      }
    }

    return Math.min(100, sleepStageScore + envImpactScore);
  }
}
