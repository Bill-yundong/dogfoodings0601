import type { CorrelationResult, WeightAnalysisItem, CorrelationMethod } from '@/types'
import type { AlignedDataPoint } from './alignment'
import { alignData } from './alignment'
import type { EnvironmentData, SleepStageData } from '@/types'

export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0

  const n = x.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < n; i++) {
    sumX += x[i]
    sumY += y[i]
    sumXY += x[i] * y[i]
    sumX2 += x[i] * x[i]
    sumY2 += y[i] * y[i]
  }

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  if (denominator === 0) return 0
  return numerator / denominator
}

export function spearmanCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0

  const rankX = getRanks(x)
  const rankY = getRanks(y)

  return pearsonCorrelation(rankX, rankY)
}

function getRanks(arr: number[]): number[] {
  const sorted = arr
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value)

  const ranks: number[] = new Array(arr.length)
  let i = 0

  while (i < sorted.length) {
    let j = i
    while (j < sorted.length - 1 && sorted[j + 1].value === sorted[i].value) {
      j++
    }
    const rank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) {
      ranks[sorted[k].index] = rank
    }
    i = j + 1
  }

  return ranks
}

export function calculateCorrelationMatrix(
  alignedData: AlignedDataPoint[],
  method: CorrelationMethod = 'pearson'
): CorrelationResult {
  const calc = method === 'pearson' ? pearsonCorrelation : spearmanCorrelation

  const lightLevels = alignedData.map((d) => d.lightLevel)
  const temperatures = alignedData.map((d) => d.temperature)
  const noiseLevels = alignedData.map((d) => d.noiseLevel)
  const humidityLevels = alignedData.map((d) => d.humidity)
  const depthLevels = alignedData.map((d) => d.depthLevel)

  return {
    lightVsDepth: calc(lightLevels, depthLevels),
    tempVsDepth: calc(temperatures, depthLevels),
    noiseVsDepth: calc(noiseLevels, depthLevels),
    humidityVsDepth: calc(humidityLevels, depthLevels),
    lightTemp: calc(lightLevels, temperatures),
    lightNoise: calc(lightLevels, noiseLevels),
    tempNoise: calc(temperatures, noiseLevels),
  }
}

export function calculateWeightAnalysis(
  correlation: CorrelationResult,
  _envData: EnvironmentData[]
): WeightAnalysisItem[] {
  const depthCorrelations = [
    { factor: 'lightLevel', factorLabel: '光照强度', value: correlation.lightVsDepth },
    { factor: 'temperature', factorLabel: '环境温度', value: correlation.tempVsDepth },
    { factor: 'noiseLevel', factorLabel: '噪音水平', value: correlation.noiseVsDepth },
    { factor: 'humidity', factorLabel: '湿度', value: correlation.humidityVsDepth },
  ]

  const totalAbs = depthCorrelations.reduce((sum, d) => sum + Math.abs(d.value), 0) || 1

  return depthCorrelations
    .map((d) => {
      const impact: 'positive' | 'negative' | 'neutral' = d.value > 0.1 ? 'positive' : d.value < -0.1 ? 'negative' : 'neutral'
      return {
        factor: d.factor,
        factorLabel: d.factorLabel,
        weight: Math.abs(d.value) / totalAbs,
        impact,
      }
    })
    .sort((a, b) => b.weight - a.weight)
}

export async function asyncCorrelationAnalysis(
  envData: EnvironmentData[],
  sleepStages: SleepStageData[],
  method: CorrelationMethod = 'pearson',
  intervalMs: number = 1000
): Promise<{
  correlation: CorrelationResult
  alignedData: AlignedDataPoint[]
  weightAnalysis: WeightAnalysisItem[]
}> {
  await new Promise((resolve) => setTimeout(resolve, 10))

  const alignedData = alignData(envData, sleepStages, intervalMs)

  if (alignedData.length < 10) {
    return {
      correlation: {
        lightVsDepth: 0,
        tempVsDepth: 0,
        noiseVsDepth: 0,
        humidityVsDepth: 0,
        lightTemp: 0,
        lightNoise: 0,
        tempNoise: 0,
      },
      alignedData: [],
      weightAnalysis: [],
    }
  }

  const correlation = calculateCorrelationMatrix(alignedData, method)
  const weightAnalysis = calculateWeightAnalysis(correlation, envData)

  return { correlation, alignedData, weightAnalysis }
}

export function timeShiftAnalysis(
  envData: EnvironmentData[],
  sleepStages: SleepStageData[],
  maxShiftMinutes: number = 30,
  shiftStepMinutes: number = 5
): { shift: number; correlation: number; factor: string }[] {
  const results: { shift: number; correlation: number; factor: string }[] = []
  const factors = ['lightLevel', 'temperature', 'noiseLevel', 'humidity'] as const

  for (const factor of factors) {
    for (let shift = -maxShiftMinutes; shift <= maxShiftMinutes; shift += shiftStepMinutes) {
      const shiftedEnv = envData.map((d) => ({
        ...d,
        timestamp: d.timestamp + shift * 60 * 1000,
      }))

      const aligned = alignData(shiftedEnv, sleepStages, 5000)
      if (aligned.length < 10) continue

      const envValues = aligned.map((d) => d[factor as keyof typeof d] as number)
      const depthValues = aligned.map((d) => d.depthLevel)
      const corr = pearsonCorrelation(envValues, depthValues)

      results.push({ shift, correlation: corr, factor })
    }
  }

  return results
}

export function overallSleepScore(
  _correlation: CorrelationResult,
  envData: EnvironmentData[]
): number {
  if (envData.length === 0) return 0

  const avgTemp = envData.reduce((sum, d) => sum + d.temperature, 0) / envData.length
  const avgLight = envData.reduce((sum, d) => sum + d.lightLevel, 0) / envData.length
  const avgNoise = envData.reduce((sum, d) => sum + d.noiseLevel, 0) / envData.length

  const tempScore = 1 - Math.abs(avgTemp - 22) / 10
  const lightScore = 1 - avgLight / 500
  const noiseScore = 1 - avgNoise / 80

  const baseScore = (tempScore * 0.4 + lightScore * 0.3 + noiseScore * 0.3) * 100

  return Math.max(0, Math.min(100, baseScore))
}
