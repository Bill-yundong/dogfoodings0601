import { createSignal, createEffect, onCleanup } from 'solid-js'
import type { EnvironmentData, SleepStageData, DeviceStatus, SceneMode, HardwareControlParams, SleepStageType } from '@/types'
import { SensorSimulator, generateMockDevices, getScenePreset } from '@/mock/dataGenerator'

const sensorSim = new SensorSimulator()

const [realtimeEnvData, setRealtimeEnvData] = createSignal<EnvironmentData | null>(null)
const [realtimeSleepStage, setRealtimeSleepStage] = createSignal<SleepStageData | null>(null)
const [envHistory, setEnvHistory] = createSignal<EnvironmentData[]>([])
const [sleepHistory, setSleepHistory] = createSignal<SleepStageData[]>([])
const [devices, setDevices] = createSignal<DeviceStatus[]>([])
const [isRecording, setIsRecording] = createSignal(false)
const [controlParams, setControlParams] = createSignal<HardwareControlParams>({
  targetLight: 30,
  targetTemperature: 22,
  targetNoise: 35,
  sceneMode: 'deep_sleep',
})

const MAX_HISTORY_POINTS = 600
let updateInterval: number | null = null

function updateRealtimeData(): void {
  const now = Date.now()

  const envPoint = sensorSim.generateDataPoint(now)
  setRealtimeEnvData(envPoint)

  setEnvHistory((prev) => {
    const next = [...prev, envPoint]
    if (next.length > MAX_HISTORY_POINTS) {
      return next.slice(next.length - MAX_HISTORY_POINTS)
    }
    return next
  })

  const cyclePhase = (now % (90 * 60 * 1000)) / (90 * 60 * 1000)
  let stage: SleepStageType
  let depth: number

  if (cyclePhase < 0.1) {
    stage = 'wake'
    depth = 0.1 + Math.random() * 0.05
  } else if (cyclePhase < 0.35) {
    stage = 'light'
    depth = 0.3 + Math.random() * 0.1
  } else if (cyclePhase < 0.65) {
    stage = 'deep'
    depth = 0.75 + Math.random() * 0.15
  } else if (cyclePhase < 0.85) {
    stage = 'light'
    depth = 0.35 + Math.random() * 0.1
  } else {
    stage = 'rem'
    depth = 0.55 + Math.random() * 0.1
  }

  const sleepPoint: SleepStageData = {
    timestamp: now,
    depthLevel: depth,
    stage,
    heartRate: 55 + (1 - depth) * 20 + (Math.random() - 0.5) * 4,
    respirationRate: 14 + (1 - depth) * 4 + (Math.random() - 0.5) * 2,
  }

  setRealtimeSleepStage(sleepPoint)

  setSleepHistory((prev) => {
    const next = [...prev, sleepPoint]
    if (next.length > MAX_HISTORY_POINTS) {
      return next.slice(next.length - MAX_HISTORY_POINTS)
    }
    return next
  })

  setDevices((prev) =>
    prev.map((d) => ({
      ...d,
      lastUpdate: now,
    }))
  )
}

function startRealtimeUpdate(): void {
  if (updateInterval) return
  updateRealtimeData()
  updateInterval = window.setInterval(updateRealtimeData, 2000)
}

function stopRealtimeUpdate(): void {
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
}

function setSceneMode(mode: SceneMode): void {
  const preset = getScenePreset(mode)
  sensorSim.setTargetParams({
    lightLevel: preset.lightLevel,
    temperature: preset.temperature,
    noiseLevel: preset.noiseLevel,
  })
  setControlParams((prev) => ({
    ...prev,
    targetLight: preset.lightLevel,
    targetTemperature: preset.temperature,
    targetNoise: preset.noiseLevel,
    sceneMode: mode,
  }))
}

function setTargetParam(key: keyof HardwareControlParams, value: number | SceneMode): void {
  if (key === 'sceneMode') {
    setSceneMode(value as SceneMode)
    return
  }

  if (typeof value === 'number') {
    const paramKey = key.replace('target', '').toLowerCase()
    const envKey = paramKey === 'light' ? 'lightLevel' : paramKey === 'noise' ? 'noiseLevel' : 'temperature'
    sensorSim.setTargetParams({ [envKey]: value })
  }

  setControlParams((prev) => ({
    ...prev,
    [key]: value,
    sceneMode: 'custom',
  }))
}

function initDevices(): void {
  if (devices().length === 0) {
    setDevices(generateMockDevices())
  }
}

function toggleDevice(deviceId: string): void {
  setDevices((prev) =>
    prev.map((d) =>
      d.id === deviceId ? { ...d, connected: !d.connected, lastUpdate: Date.now() } : d
    )
  )
}

export function useRealtimeData() {
  createEffect(() => {
    startRealtimeUpdate()
    initDevices()
  })

  onCleanup(() => {
    stopRealtimeUpdate()
  })

  return {
    realtimeEnvData,
    realtimeSleepStage,
    envHistory,
    sleepHistory,
    devices,
    isRecording,
    controlParams,
    setIsRecording,
    setSceneMode,
    setTargetParam,
    toggleDevice,
  }
}

export {
  realtimeEnvData,
  realtimeSleepStage,
  envHistory,
  sleepHistory,
  devices,
  isRecording,
  controlParams,
  startRealtimeUpdate,
  stopRealtimeUpdate,
  setSceneMode,
  setTargetParam,
  toggleDevice,
  setIsRecording,
  initDevices,
}
