import type { EnvironmentData, SleepStageData, SleepStageType, SleepSnapshot, DeviceStatus, ScenePreset, SceneMode } from '@/types'
import { generateId } from '@/utils/time'

export class SensorSimulator {
  private baseLight = 50
  private baseTemperature = 22
  private baseNoise = 30
  private baseHumidity = 55
  private lightVariation = 10
  private tempVariation = 2
  private noiseVariation = 15
  private humidityVariation = 10

  setTargetParams(params: {
    lightLevel?: number
    temperature?: number
    noiseLevel?: number
    humidity?: number
  }): void {
    if (params.lightLevel !== undefined) this.baseLight = params.lightLevel
    if (params.temperature !== undefined) this.baseTemperature = params.temperature
    if (params.noiseLevel !== undefined) this.baseNoise = params.noiseLevel
    if (params.humidity !== undefined) this.baseHumidity = params.humidity
  }

  generateDataPoint(timestamp: number): EnvironmentData {
    const timeOfDay = this.getTimeOfDayFactor(timestamp)

    return {
      timestamp,
      lightLevel: Math.max(0, this.baseLight + (Math.random() - 0.5) * 2 * this.lightVariation + timeOfDay.light),
      temperature: this.baseTemperature + (Math.random() - 0.5) * 2 * this.tempVariation + timeOfDay.temp,
      noiseLevel: Math.max(0, this.baseNoise + (Math.random() - 0.5) * 2 * this.noiseVariation + timeOfDay.noise),
      humidity: Math.max(0, Math.min(100, this.baseHumidity + (Math.random() - 0.5) * 2 * this.humidityVariation)),
    }
  }

  private getTimeOfDayFactor(timestamp: number): { light: number; temp: number; noise: number } {
    const date = new Date(timestamp)
    const hour = date.getHours() + date.getMinutes() / 60

    let light = 0
    if (hour >= 6 && hour < 18) {
      light = 200 * Math.sin(((hour - 6) / 12) * Math.PI)
    }

    let temp = 0
    if (hour >= 4 && hour < 16) {
      temp = 3 * Math.sin(((hour - 4) / 12) * Math.PI)
    } else {
      temp = -1.5
    }

    let noise = 0
    if (hour >= 7 && hour < 22) {
      noise = 10 * Math.sin(((hour - 7) / 15) * Math.PI)
    }

    return { light, temp, noise }
  }

  generateHistoricalData(
    startTime: number,
    endTime: number,
    intervalMs: number = 5000
  ): EnvironmentData[] {
    const data: EnvironmentData[] = []
    for (let t = startTime; t <= endTime; t += intervalMs) {
      data.push(this.generateDataPoint(t))
    }
    return data
  }
}

export class SleepDataGenerator {
  generateSleepStages(
    startTime: number,
    endTime: number,
    quality: 'good' | 'normal' | 'poor' = 'normal'
  ): SleepStageData[] {
    const stages: SleepStageData[] = []
    const totalDuration = endTime - startTime
    const cycleDuration = 90 * 60 * 1000
    const cycles = Math.floor(totalDuration / cycleDuration)

    const stagePattern = this.getStagePattern(quality)

    for (let i = 0; i < cycles; i++) {
      const cycleStart = startTime + i * cycleDuration
      const cycleStages = this.generateSleepCycle(cycleStart, cycleDuration, stagePattern)
      stages.push(...cycleStages)
    }

    const remaining = totalDuration - cycles * cycleDuration
    if (remaining > 0) {
      const lastStages = this.generateSleepCycle(
        startTime + cycles * cycleDuration,
        remaining,
        stagePattern.slice(0, Math.floor(stagePattern.length * (remaining / cycleDuration)))
      )
      stages.push(...lastStages)
    }

    return stages
  }

  private getStagePattern(quality: string): { stage: SleepStageType; duration: number; depth: number }[] {
    if (quality === 'good') {
      return [
        { stage: 'wake', duration: 0.05, depth: 0.1 },
        { stage: 'light', duration: 0.2, depth: 0.35 },
        { stage: 'deep', duration: 0.35, depth: 0.85 },
        { stage: 'light', duration: 0.15, depth: 0.4 },
        { stage: 'rem', duration: 0.25, depth: 0.6 },
      ]
    } else if (quality === 'poor') {
      return [
        { stage: 'wake', duration: 0.2, depth: 0.15 },
        { stage: 'light', duration: 0.35, depth: 0.3 },
        { stage: 'deep', duration: 0.15, depth: 0.7 },
        { stage: 'light', duration: 0.2, depth: 0.35 },
        { stage: 'rem', duration: 0.1, depth: 0.55 },
      ]
    }
    return [
      { stage: 'wake', duration: 0.1, depth: 0.1 },
      { stage: 'light', duration: 0.25, depth: 0.35 },
      { stage: 'deep', duration: 0.3, depth: 0.8 },
      { stage: 'light', duration: 0.2, depth: 0.4 },
      { stage: 'rem', duration: 0.15, depth: 0.6 },
    ]
  }

  private generateSleepCycle(
    startTime: number,
    duration: number,
    pattern: { stage: SleepStageType; duration: number; depth: number }[]
  ): SleepStageData[] {
    const stages: SleepStageData[] = []
    const interval = 30 * 1000

    let currentTime = startTime
    for (const phase of pattern) {
      const phaseDuration = duration * phase.duration
      const phaseEnd = currentTime + phaseDuration

      for (let t = currentTime; t < phaseEnd; t += interval) {
        const progress = (t - currentTime) / phaseDuration
        const depthVariation = Math.sin(progress * Math.PI) * 0.1
        const baseDepth = phase.depth + depthVariation
        const jitter = (Math.random() - 0.5) * 0.05

        stages.push({
          timestamp: t,
          depthLevel: Math.max(0, Math.min(1, baseDepth + jitter)),
          stage: phase.stage,
          heartRate: this.getHeartRate(phase.stage, baseDepth),
          respirationRate: this.getRespirationRate(phase.stage, baseDepth),
        })
      }

      currentTime = phaseEnd
    }

    return stages
  }

  private getHeartRate(stage: SleepStageType, depth: number): number {
    const baseRates: Record<SleepStageType, number> = {
      wake: 70,
      light: 60,
      deep: 50,
      rem: 65,
    }
    const base = baseRates[stage]
    return base + (Math.random() - 0.5) * 6 - (1 - depth) * 5
  }

  private getRespirationRate(stage: SleepStageType, depth: number): number {
    const baseRates: Record<SleepStageType, number> = {
      wake: 16,
      light: 14,
      deep: 12,
      rem: 18,
    }
    const base = baseRates[stage]
    return base + (Math.random() - 0.5) * 2 - (1 - depth) * 1.5
  }
}

export function generateMockSleepSnapshot(
  startTime: number,
  durationHours: number,
  quality: 'good' | 'normal' | 'poor' = 'normal',
  scene: string = '卧室'
): SleepSnapshot {
  const endTime = startTime + durationHours * 60 * 60 * 1000

  const sensorSim = new SensorSimulator()
  const sleepGen = new SleepDataGenerator()

  const envData = sensorSim.generateHistoricalData(startTime, endTime, 30000)
  const sleepStages = sleepGen.generateSleepStages(startTime, endTime, quality)

  const avgDepth = sleepStages.reduce((sum, s) => sum + s.depthLevel, 0) / sleepStages.length
  const sleepScore = Math.round(avgDepth * 100)

  return {
    id: generateId(),
    startTime,
    endTime,
    duration: endTime - startTime,
    sleepScore,
    scene,
    envData,
    sleepStages,
    createdAt: Date.now(),
  }
}

export function generateMockDevices(): DeviceStatus[] {
  return [
    {
      id: 'sensor-light',
      type: 'sensor',
      name: '光照传感器',
      connected: true,
      lastUpdate: Date.now(),
      metrics: { lux: 45 },
    },
    {
      id: 'sensor-temp',
      type: 'sensor',
      name: '温湿度传感器',
      connected: true,
      lastUpdate: Date.now(),
      metrics: { temperature: 22.5, humidity: 55 },
    },
    {
      id: 'sensor-noise',
      type: 'sensor',
      name: '噪音传感器',
      connected: true,
      lastUpdate: Date.now(),
      metrics: { db: 32 },
    },
    {
      id: 'controller-light',
      type: 'controller',
      name: '智能灯光',
      connected: true,
      lastUpdate: Date.now(),
      metrics: { brightness: 30, colorTemp: 2700 },
    },
    {
      id: 'controller-ac',
      type: 'controller',
      name: '空调控制',
      connected: true,
      lastUpdate: Date.now(),
      metrics: { targetTemp: 22, mode: 'sleep' },
    },
    {
      id: 'controller-white-noise',
      type: 'controller',
      name: '白噪音机',
      connected: false,
      lastUpdate: Date.now() - 3600000,
      metrics: { volume: 0 },
    },
  ]
}

export const scenePresets: ScenePreset[] = [
  {
    id: 'deep_sleep',
    name: '深度睡眠',
    description: '最低光照、适宜温度、白噪音助眠',
    lightLevel: 5,
    temperature: 20,
    noiseLevel: 25,
    icon: 'Moon',
  },
  {
    id: 'fast_sleep',
    name: '快速入睡',
    description: '暖光渐变、舒缓温度、轻音乐',
    lightLevel: 20,
    temperature: 22,
    noiseLevel: 30,
    icon: 'Zap',
  },
  {
    id: 'nap',
    name: '午休模式',
    description: '柔和环境、适中温度、定时唤醒',
    lightLevel: 30,
    temperature: 24,
    noiseLevel: 35,
    icon: 'Sun',
  },
  {
    id: 'custom',
    name: '自定义',
    description: '自由调节环境参数',
    lightLevel: 50,
    temperature: 22,
    noiseLevel: 40,
    icon: 'Settings',
  },
]

export function getScenePreset(mode: SceneMode): ScenePreset {
  return scenePresets.find((p) => p.id === mode) || scenePresets[0]
}

export function generateHistoricalSnapshots(days: number = 14): SleepSnapshot[] {
  const snapshots: SleepSnapshot[] = []
  const now = Date.now()
  const scenes = ['卧室', '旅行', '午休', '客房']
  const qualities: ('good' | 'normal' | 'poor')[] = ['good', 'normal', 'normal', 'poor']

  for (let i = 0; i < days; i++) {
    const dayOffset = (days - i - 1) * 24 * 60 * 60 * 1000
    const startTime = now - dayOffset - 7 * 60 * 60 * 1000
    const quality = qualities[Math.floor(Math.random() * qualities.length)]
    const duration = 6 + Math.random() * 2.5
    const scene = i % 5 === 2 ? '午休' : scenes[0]

    snapshots.push(generateMockSleepSnapshot(startTime, duration, quality, scene))
  }

  return snapshots
}
