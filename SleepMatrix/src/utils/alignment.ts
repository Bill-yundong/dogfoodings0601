import type { EnvironmentData, SleepStageData } from '@/types'
import { lerp } from './time'

export interface AlignedDataPoint {
  timestamp: number
  lightLevel: number
  temperature: number
  noiseLevel: number
  humidity: number
  depthLevel: number
}

export function alignData(
  envData: EnvironmentData[],
  sleepStages: SleepStageData[],
  intervalMs: number = 1000
): AlignedDataPoint[] {
  if (envData.length === 0 || sleepStages.length === 0) return []

  const startTime = Math.max(envData[0].timestamp, sleepStages[0].timestamp)
  const endTime = Math.min(
    envData[envData.length - 1].timestamp,
    sleepStages[sleepStages.length - 1].timestamp
  )

  if (startTime >= endTime) return []

  const result: AlignedDataPoint[] = []
  const envSorted = [...envData].sort((a, b) => a.timestamp - b.timestamp)
  const stageSorted = [...sleepStages].sort((a, b) => a.timestamp - b.timestamp)

  for (let t = startTime; t <= endTime; t += intervalMs) {
    const envPoint = interpolateEnv(envSorted, t)
    const stagePoint = interpolateStage(stageSorted, t)

    if (envPoint && stagePoint) {
      result.push({
        timestamp: t,
        lightLevel: envPoint.lightLevel,
        temperature: envPoint.temperature,
        noiseLevel: envPoint.noiseLevel,
        humidity: envPoint.humidity,
        depthLevel: stagePoint.depthLevel,
      })
    }
  }

  return result
}

function interpolateEnv(
  data: EnvironmentData[],
  targetTime: number
): EnvironmentData | null {
  if (data.length === 0) return null

  let left = 0
  let right = data.length - 1

  if (targetTime < data[0].timestamp || targetTime > data[data.length - 1].timestamp) {
    return null
  }

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (data[mid].timestamp === targetTime) {
      return data[mid]
    } else if (data[mid].timestamp < targetTime) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  if (right < 0) return data[0]
  if (left >= data.length) return data[data.length - 1]

  const before = data[right]
  const after = data[left]
  const t = (targetTime - before.timestamp) / (after.timestamp - before.timestamp)

  return {
    timestamp: targetTime,
    lightLevel: lerp(before.lightLevel, after.lightLevel, t),
    temperature: lerp(before.temperature, after.temperature, t),
    noiseLevel: lerp(before.noiseLevel, after.noiseLevel, t),
    humidity: lerp(before.humidity, after.humidity, t),
  }
}

function interpolateStage(
  data: SleepStageData[],
  targetTime: number
): SleepStageData | null {
  if (data.length === 0) return null

  let left = 0
  let right = data.length - 1

  if (targetTime < data[0].timestamp || targetTime > data[data.length - 1].timestamp) {
    return null
  }

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (data[mid].timestamp === targetTime) {
      return data[mid]
    } else if (data[mid].timestamp < targetTime) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  if (right < 0) return data[0]
  if (left >= data.length) return data[data.length - 1]

  const before = data[right]
  const after = data[left]
  const t = (targetTime - before.timestamp) / (after.timestamp - before.timestamp)

  return {
    timestamp: targetTime,
    depthLevel: lerp(before.depthLevel, after.depthLevel, t),
    stage: t < 0.5 ? before.stage : after.stage,
    heartRate: lerp(before.heartRate, after.heartRate, t),
    respirationRate: lerp(before.respirationRate, after.respirationRate, t),
  }
}

export function slidingWindowAnalysis<T>(
  data: T[],
  windowSize: number,
  stepSize: number,
  analyze: (window: T[], windowStart: number, windowEnd: number) => void
): void {
  if (data.length < windowSize) return

  for (let i = 0; i <= data.length - windowSize; i += stepSize) {
    const window = data.slice(i, i + windowSize)
    analyze(window, i, i + windowSize - 1)
  }
}

export function resampleData<T extends { timestamp: number }>(
  data: T[],
  targetIntervalMs: number
): T[] {
  if (data.length < 2) return data

  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)
  const result: T[] = []
  let currentTime = sorted[0].timestamp
  const endTime = sorted[sorted.length - 1].timestamp

  while (currentTime <= endTime) {
    const interpolated = interpolatePoint(sorted, currentTime)
    if (interpolated) {
      result.push(interpolated)
    }
    currentTime += targetIntervalMs
  }

  return result
}

function interpolatePoint<T extends { timestamp: number }>(
  data: T[],
  targetTime: number
): T | null {
  if (data.length === 0) return null

  let left = 0
  let right = data.length - 1

  if (targetTime < data[0].timestamp || targetTime > data[data.length - 1].timestamp) {
    return null
  }

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (data[mid].timestamp === targetTime) {
      return { ...data[mid] }
    } else if (data[mid].timestamp < targetTime) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  if (right < 0 || left >= data.length) return null

  const before = data[right]
  const after = data[left]
  const t = (targetTime - before.timestamp) / (after.timestamp - before.timestamp)

  const result: Record<string, number> = { timestamp: targetTime }
  for (const key of Object.keys(before)) {
    if (key === 'timestamp') continue
    const valBefore = before[key as keyof T]
    const valAfter = after[key as keyof T]
    if (typeof valBefore === 'number' && typeof valAfter === 'number') {
      result[key] = lerp(valBefore, valAfter, t)
    }
  }

  return result as unknown as T
}
