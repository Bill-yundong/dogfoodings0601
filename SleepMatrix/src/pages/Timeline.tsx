import { createSignal, For } from 'solid-js'
import { Calendar, Clock, Moon, ChevronDown, ChevronUp } from 'lucide-solid'
import SleepWaveChart from '@/components/charts/SleepWaveChart'
import { useSnapshots } from '@/stores/snapshotStore'
import { formatDuration } from '@/utils/time'
import type { SleepSnapshot } from '@/types'

type ViewMode = 'day' | 'week' | 'month'

export default function Timeline() {
  const { snapshots, removeSnapshot, isLoading } = useSnapshots()

  const [viewMode, setViewMode] = createSignal<ViewMode>('day')
  const [expandedId, setExpandedId] = createSignal<string | null>(null)
  const [sceneFilter, setSceneFilter] = createSignal<string>('all')

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId() === id ? null : id)
  }

  const averageScore = () => {
    if (!snapshots().length) return 0
    return Math.round(snapshots().reduce((sum: number, s: SleepSnapshot) => sum + s.sleepScore, 0) / snapshots().length)
  }

  const averageDuration = () => {
    if (!snapshots().length) return 0
    return Math.round(snapshots().reduce((sum: number, s: SleepSnapshot) => sum + s.duration, 0) / snapshots().length / 60000)
  }

  const formatSnapshotTitle = (snapshot: SleepSnapshot) => {
    const date = new Date(snapshot.startTime)
    return `${date.getMonth() + 1}月${date.getDate()}日睡眠 · ${snapshot.scene}`
  }

  const getAvgMetrics = (snapshot: SleepSnapshot) => {
    const envData = snapshot.envData || []
    if (envData.length === 0) {
      return { light: 0, temp: 0, noise: 0, humidity: 0 }
    }
    const sum = envData.reduce((acc, d) => ({
      light: acc.light + d.lightLevel,
      temp: acc.temp + d.temperature,
      noise: acc.noise + d.noiseLevel,
      humidity: acc.humidity + d.humidity,
    }), { light: 0, temp: 0, noise: 0, humidity: 0 })
    return {
      light: sum.light / envData.length,
      temp: sum.temp / envData.length,
      noise: sum.noise / envData.length,
      humidity: sum.humidity / envData.length,
    }
  }

  return (
    <div class="h-full overflow-y-auto pr-2">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-white">睡眠轨迹</h1>
        <p class="text-sm text-slate-400 mt-1">长周期睡眠质量追踪与回顾</p>
      </div>

      <div class="flex flex-wrap gap-3 mb-6">
        <div class="flex bg-white/5 rounded-lg p-1 border border-white/10">
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              onClick={() => setViewMode(mode)}
              class={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode() === mode
                  ? 'bg-indigo-500/30 text-indigo-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode === 'day' ? '日视图' : mode === 'week' ? '周视图' : '月视图'}
            </button>
          ))}
        </div>

        <div class="flex bg-white/5 rounded-lg p-1 border border-white/10">
          {['all', 'deep_sleep', 'fast_sleep', 'nap', 'custom'].map((scene) => (
            <button
              onClick={() => setSceneFilter(scene)}
              class={`px-3 py-2 rounded-md text-xs font-medium transition-all ${
                sceneFilter() === scene
                  ? 'bg-indigo-500/30 text-indigo-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {scene === 'all' ? '全部' : scene === 'deep_sleep' ? '深睡' : scene === 'fast_sleep' ? '快速' : scene === 'nap' ? '午休' : '自定义'}
            </button>
          ))}
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="glass-panel rounded-xl p-4">
          <p class="text-sm text-slate-400">平均睡眠评分</p>
          <p class="text-3xl font-bold text-white mt-2">{averageScore()}<span class="text-sm text-slate-500 ml-1">分</span></p>
        </div>
        <div class="glass-panel rounded-xl p-4">
          <p class="text-sm text-slate-400">平均睡眠时长</p>
          <p class="text-3xl font-bold text-white mt-2">{formatDuration(averageDuration())}</p>
        </div>
        <div class="glass-panel rounded-xl p-4">
          <p class="text-sm text-slate-400">记录总数</p>
          <p class="text-3xl font-bold text-white mt-2">{snapshots().length}<span class="text-sm text-slate-500 ml-1">次</span></p>
        </div>
        <div class="glass-panel rounded-xl p-4">
          <p class="text-sm text-slate-400">最佳评分</p>
          <p class="text-3xl font-bold text-green-400 mt-2">{snapshots().length ? Math.max(...snapshots().map((s: SleepSnapshot) => s.sleepScore)) : 0}<span class="text-sm text-slate-500 ml-1">分</span></p>
        </div>
      </div>

      <div class="glass-panel rounded-xl p-6">
        <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar class="w-5 h-5 text-indigo-400" />
          睡眠记录时间轴
        </h2>

        {isLoading() ? (
          <div class="text-center py-12 text-slate-500">加载中...</div>
        ) : snapshots().length === 0 ? (
          <div class="text-center py-12">
            <Moon class="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p class="text-slate-500">暂无睡眠记录</p>
            <p class="text-sm text-slate-600 mt-1">开始监测你的第一次睡眠吧</p>
          </div>
        ) : (
          <div class="relative">
            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500/50 via-purple-500/30 to-transparent" />

            <div class="space-y-4">
              <For each={snapshots()}>
                {(snapshot) => {
                  const avgMetrics = getAvgMetrics(snapshot)
                  const durationMin = Math.floor(snapshot.duration / 60000)
                  return (
                    <div class="relative pl-10">
                      <div class={`absolute left-2 top-4 w-4 h-4 rounded-full border-2 ${
                        snapshot.sleepScore >= 80 ? 'border-green-400 bg-green-500/20' :
                        snapshot.sleepScore >= 60 ? 'border-yellow-400 bg-yellow-500/20' :
                        'border-red-400 bg-red-500/20'
                      }`} />

                      <div
                        class="glass-panel rounded-xl p-4 cursor-pointer hover:bg-white/5 transition-all"
                        onClick={() => toggleExpand(snapshot.id)}
                      >
                        <div class="flex items-start justify-between">
                          <div>
                            <h3 class="text-white font-medium">{formatSnapshotTitle(snapshot)}</h3>
                            <div class="flex items-center gap-3 mt-1 text-sm text-slate-500">
                              <span class="flex items-center gap-1">
                                <Calendar class="w-3 h-3" />
                                {new Date(snapshot.startTime).toLocaleDateString('zh-CN')}
                              </span>
                              <span class="flex items-center gap-1">
                                <Clock class="w-3 h-3" />
                                {formatDuration(durationMin)}
                              </span>
                            </div>
                          </div>
                          <div class="text-right">
                            <p class="text-2xl font-bold text-white">{snapshot.sleepScore}%</p>
                            <p class="text-xs text-slate-500">睡眠质量</p>
                          </div>
                        </div>

                        <div class="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            class="h-full rounded-full"
                            style={`width: ${snapshot.sleepScore}%; background: linear-gradient(90deg, ${
                              snapshot.sleepScore >= 80 ? '#22c55e' :
                              snapshot.sleepScore >= 60 ? '#eab308' : '#ef4444'
                            }, #8b5cf6);`}
                          />
                        </div>

                        {expandedId() === snapshot.id && (
                          <div class="mt-4 pt-4 border-t border-white/10">
                            <div class="mb-4">
                              <h4 class="text-sm font-medium text-white mb-2">睡眠深度波形</h4>
                              <SleepWaveChart data={snapshot.sleepStages || []} height={120} />
                            </div>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div class="bg-white/5 rounded-lg p-2">
                                <p class="text-slate-500 text-xs">平均光照</p>
                                <p class="text-white font-mono">{avgMetrics.light.toFixed(0)} lux</p>
                              </div>
                              <div class="bg-white/5 rounded-lg p-2">
                                <p class="text-slate-500 text-xs">平均温度</p>
                                <p class="text-white font-mono">{avgMetrics.temp.toFixed(1)}°C</p>
                              </div>
                              <div class="bg-white/5 rounded-lg p-2">
                                <p class="text-slate-500 text-xs">平均噪音</p>
                                <p class="text-white font-mono">{avgMetrics.noise.toFixed(0)} dB</p>
                              </div>
                              <div class="bg-white/5 rounded-lg p-2">
                                <p class="text-slate-500 text-xs">平均湿度</p>
                                <p class="text-white font-mono">{avgMetrics.humidity.toFixed(0)}%</p>
                              </div>
                            </div>
                            <div class="mt-3 flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); removeSnapshot(snapshot.id) }}
                                class="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-all"
                              >
                                删除记录
                              </button>
                            </div>
                          </div>
                        )}

                        <div class="mt-2 flex justify-center">
                          {expandedId() === snapshot.id ? (
                            <ChevronUp class="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown class="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }}
              </For>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
