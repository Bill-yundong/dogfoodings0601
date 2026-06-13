import { For } from 'solid-js'
import { Sun, Settings, Lightbulb, Thermometer, Volume2, Droplets, Wifi, WifiOff, Moon, Zap } from 'lucide-solid'
import GlowSlider from '@/components/controls/GlowSlider'
import DeviceCard from '@/components/cards/DeviceCard'
import { scenePresets } from '@/mock/dataGenerator'
import { useRealtimeData } from '@/stores/realtimeStore'
import type { SceneMode, ScenePreset } from '@/types'
import type { Component } from 'solid-js'

export default function Control() {
  const { controlParams, setSceneMode, setTargetParam, devices, toggleDevice } = useRealtimeData()

  const iconMap: Record<string, Component<any>> = {
    Moon,
    Zap,
    Sun,
    Settings,
  }

  const getSceneIcon = (preset: ScenePreset) => {
    return iconMap[preset.icon] || Settings
  }

  const isController = (deviceId: string) => deviceId.startsWith('controller')
  const isSensor = (deviceId: string) => deviceId.startsWith('sensor')

  const getDeviceIcon = (deviceId: string) => {
    if (deviceId.includes('light')) return Lightbulb
    if (deviceId.includes('temp')) return Thermometer
    if (deviceId.includes('noise')) return Volume2
    if (deviceId.includes('humid')) return Droplets
    return Settings
  }

  const getDeviceColor = (deviceId: string) => {
    if (deviceId.includes('light')) return '#fbbf24'
    if (deviceId.includes('temp')) return '#ef4444'
    if (deviceId.includes('noise')) return '#8b5cf6'
    if (deviceId.includes('humid')) return '#06b6d4'
    return '#6366f1'
  }

  return (
    <div class="h-full overflow-y-auto pr-2">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-white">硬件控制中心</h1>
        <p class="text-sm text-slate-400 mt-1">智能调节睡眠环境参数</p>
      </div>

      <div class="mb-6">
        <h2 class="text-lg font-semibold text-white mb-3">场景模式</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <For each={scenePresets}>
            {(preset) => {
              const Icon = getSceneIcon(preset)
              return (
                <div
                  onClick={() => setSceneMode(preset.id as SceneMode)}
                  class={`glass-panel rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] ${
                    controlParams().sceneMode === preset.id
                      ? 'border-2 border-indigo-500/60 bg-indigo-500/10'
                      : 'border border-white/10'
                  }`}
                >
                  <div class={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                    controlParams().sceneMode === preset.id ? 'bg-indigo-500/30' : 'bg-white/10'
                  }`}>
                    <Icon class={`w-5 h-5 ${controlParams().sceneMode === preset.id ? 'text-indigo-300' : 'text-slate-300'}`} />
                  </div>
                  <h3 class="text-white font-medium">{preset.name}</h3>
                  <p class="text-xs text-slate-500 mt-1">{preset.description}</p>
                </div>
              )
            }}
          </For>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div class="glass-panel rounded-xl p-6">
          <h2 class="text-lg font-semibold text-white mb-4">环境参数调节</h2>
          <div class="space-y-6">
            <GlowSlider
              label="目标光照强度"
              value={controlParams().targetLight}
              min={0}
              max={500}
              step={10}
              unit="lux"
              color="#fbbf24"
              onChange={(v) => setTargetParam('targetLight', v)}
            />
            <GlowSlider
              label="目标温度"
              value={controlParams().targetTemperature}
              min={16}
              max={30}
              step={0.5}
              unit="°C"
              color="#ef4444"
              onChange={(v) => setTargetParam('targetTemperature', v)}
            />
            <GlowSlider
              label="目标噪音水平"
              value={controlParams().targetNoise}
              min={20}
              max={80}
              step={1}
              unit="dB"
              color="#8b5cf6"
              onChange={(v) => setTargetParam('targetNoise', v)}
            />
          </div>
        </div>

        <div class="glass-panel rounded-xl p-6">
          <h2 class="text-lg font-semibold text-white mb-4">控制设备</h2>
          <div class="space-y-3">
            <For each={devices().filter(d => isController(d.id))}>
              {(device) => {
                const Icon = getDeviceIcon(device.id)
                const color = getDeviceColor(device.id)
                const isOn = device.connected
                return (
                  <div class="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                    <div class="flex items-center gap-3">
                      <div class={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        device.connected ? '' : 'opacity-50'
                      }`}
                      style={`background: ${color}20;`}
                      >
                        <Icon class="w-5 h-5" style={`color: ${color};`} />
                      </div>
                      <div>
                        <p class="text-sm font-medium text-white">{device.name}</p>
                        <div class="flex items-center gap-1 text-xs text-slate-500">
                          {device.connected ? (
                            <><Wifi class="w-3 h-3 text-green-400" /> 在线</>
                          ) : (
                            <><WifiOff class="w-3 h-3 text-slate-600" /> 离线</>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleDevice(device.id)}
                      disabled={!device.connected}
                      class={`w-12 h-7 rounded-full transition-all relative ${
                        isOn
                          ? 'bg-green-500/30'
                          : 'bg-white/10'
                      } disabled:opacity-50`}
                    >
                      <div
                        class={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${
                          isOn ? 'left-[22px]' : 'left-0.5'
                        }`}
                        style="box-shadow: 0 2px 8px rgba(0,0,0,0.3)"
                      />
                    </button>
                  </div>
                )
              }}
            </For>
          </div>
        </div>
      </div>

      <div class="mb-6">
        <h2 class="text-lg font-semibold text-white mb-3">传感器状态</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <For each={devices().filter(d => isSensor(d.id))}>
            {(device) => <DeviceCard device={device} />}
          </For>
        </div>
      </div>

      <div class="glass-panel rounded-xl p-6">
        <h2 class="text-lg font-semibold text-white mb-4">控制策略说明</h2>
        <div class="space-y-3 text-sm text-slate-400">
          <div class="flex items-start gap-2">
            <div class="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
            <p><span class="text-white">智能联动</span>：系统根据实时睡眠阶段自动调整环境参数，深睡阶段降低光照和噪音</p>
          </div>
          <div class="flex items-start gap-2">
            <div class="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
            <p><span class="text-white">渐进调节</span>：环境参数变化采用渐进式调节，避免突变影响睡眠质量</p>
          </div>
          <div class="flex items-start gap-2">
            <div class="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
            <p><span class="text-white">学习优化</span>：基于历史睡眠数据分析，持续优化环境参数推荐值</p>
          </div>
          <div class="flex items-start gap-2">
            <div class="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
            <p><span class="text-white">安全优先</span>：温度、湿度等参数设有安全阈值，保护用户健康安全</p>
          </div>
        </div>
      </div>
    </div>
  )
}
