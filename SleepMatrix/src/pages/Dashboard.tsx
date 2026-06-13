import { onMount } from 'solid-js'
import { Sun, Thermometer, Volume2, Droplets, Heart, Wind, Moon } from 'lucide-solid'
import { useRealtimeData } from '@/stores/realtimeStore'
import DataCard from '@/components/cards/DataCard'
import SleepWaveChart from '@/components/charts/SleepWaveChart'
import MiniLineChart from '@/components/charts/MiniLineChart'
import DeviceCard from '@/components/cards/DeviceCard'
import CircularProgress from '@/components/charts/CircularProgress'

export default function Dashboard() {
  const {
    realtimeEnvData,
    realtimeSleepStage,
    envHistory,
    sleepHistory,
    devices,
    controlParams,
  } = useRealtimeData()

  onMount(() => {
    // 数据已通过 store 自动初始化
  })

  const env = () => realtimeEnvData()
  const sleep = () => realtimeSleepStage()

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-white">实时监测</h2>
          <p class="text-slate-400 text-sm mt-1">睡眠环境与生理指标实时监控</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span class="text-sm text-emerald-400">实时同步中</span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DataCard
          icon={Sun}
          title="光照强度"
          value={env()?.lightLevel.toFixed(1) || '--'}
          unit="lux"
          color="#F59E0B"
          trend="neutral"
          trendValue="稳定"
        >
          <MiniLineChart data={envHistory()} type="light" color="#F59E0B" />
        </DataCard>

        <DataCard
          icon={Thermometer}
          title="环境温度"
          value={env()?.temperature.toFixed(1) || '--'}
          unit="°C"
          color="#EF4444"
          trend="neutral"
          trendValue="适宜"
        >
          <MiniLineChart data={envHistory()} type="temperature" color="#EF4444" />
        </DataCard>

        <DataCard
          icon={Volume2}
          title="噪音水平"
          value={env()?.noiseLevel.toFixed(1) || '--'}
          unit="dB"
          color="#8B5CF6"
          trend="neutral"
          trendValue="安静"
        >
          <MiniLineChart data={envHistory()} type="noise" color="#8B5CF6" />
        </DataCard>

        <DataCard
          icon={Droplets}
          title="空气湿度"
          value={env()?.humidity.toFixed(1) || '--'}
          unit="%"
          color="#06B6D4"
          trend="neutral"
          trendValue="适宜"
        >
          <MiniLineChart data={envHistory()} type="humidity" color="#06B6D4" />
        </DataCard>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold text-white">睡眠深度波形</h3>
              <p class="text-sm text-slate-500">实时睡眠阶段变化</p>
            </div>
            <div class="flex items-center gap-4 text-xs">
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                <span class="text-slate-400">清醒</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-dream-purple"></span>
                <span class="text-slate-400">浅睡</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-calm-cyan"></span>
                <span class="text-slate-400">深睡</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-pink-500"></span>
                <span class="text-slate-400">REM</span>
              </div>
            </div>
          </div>
          <SleepWaveChart data={sleepHistory()} height={220} />
        </div>

        <div class="glass-card p-6">
          <h3 class="text-lg font-semibold text-white mb-4">当前状态</h3>
          
          <div class="flex flex-col items-center py-4">
            <CircularProgress
              value={sleep()?.depthLevel ? sleep()!.depthLevel * 100 : 0}
              size={140}
              strokeWidth={10}
              color="#6366F1"
              label="睡眠深度"
              sublabel={sleep()?.stage === 'wake' ? '清醒' : sleep()?.stage === 'light' ? '浅睡' : sleep()?.stage === 'deep' ? '深睡' : 'REM'}
            />
          </div>

          <div class="grid grid-cols-2 gap-4 mt-6">
            <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5">
              <Heart class="w-5 h-5 text-red-400" />
              <div>
                <p class="text-xs text-slate-500">心率</p>
                <p class="text-lg font-mono font-semibold text-white">
                  {sleep()?.heartRate.toFixed(0) || '--'}
                  <span class="text-xs text-slate-500 ml-1">bpm</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5">
              <Wind class="w-5 h-5 text-calm-cyan" />
              <div>
                <p class="text-xs text-slate-500">呼吸</p>
                <p class="text-lg font-mono font-semibold text-white">
                  {sleep()?.respirationRate.toFixed(1) || '--'}
                  <span class="text-xs text-slate-500 ml-1">/min</span>
                </p>
              </div>
            </div>
          </div>

          <div class="mt-6 p-4 rounded-xl bg-dream-purple/10 border border-dream-purple/20">
            <div class="flex items-center gap-2 mb-2">
              <Moon class="w-4 h-4 text-dream-purple" />
              <span class="text-sm font-medium text-dream-purple">当前场景</span>
            </div>
            <p class="text-white font-medium">
              {controlParams().sceneMode === 'deep_sleep' ? '深度睡眠模式' :
               controlParams().sceneMode === 'fast_sleep' ? '快速入睡模式' :
               controlParams().sceneMode === 'nap' ? '午休模式' : '自定义模式'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">硬件设备状态</h3>
          <span class="text-sm text-slate-500">
            {devices().filter((d) => d.connected).length}/{devices().length} 在线
          </span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices().map((device) => (
            <DeviceCard device={device} />
          ))}
        </div>
      </div>
    </div>
  )
}
