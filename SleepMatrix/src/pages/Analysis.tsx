import { createSignal, For } from 'solid-js'
import CorrelationHeatmap from '@/components/charts/CorrelationHeatmap'
import DataCard from '@/components/cards/DataCard'
import { useAnalysis } from '@/stores/analysisStore'
import { useSnapshots } from '@/stores/snapshotStore'
import { Brain, TrendingUp, Clock, Sun } from 'lucide-solid'
import type { WeightAnalysisItem } from '@/types'
import { formatDuration } from '@/utils/time'

export default function Analysis() {
  const {
    analysisResult,
    isAnalyzing,
    correlationMethod,
    setCorrelationMethod,
    runAnalysis,
    runTimeShiftAnalysis,
  } = useAnalysis()

  const { snapshots, setSelectedSnapshot, selectedSnapshot } = useSnapshots()

  const [showSidebar, setShowSidebar] = createSignal(false)

  const handleSelectSnapshot = async (id: string) => {
    const snapshot = snapshots().find(s => s.id === id)
    if (snapshot) {
      setSelectedSnapshot(snapshot)
      await runAnalysis(id)
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return 'text-red-400'
      case 'negative': return 'text-cyan-400'
      default: return 'text-slate-400'
    }
  }

  const getImpactLabel = (impact: string) => {
    switch (impact) {
      case 'positive': return '正向影响'
      case 'negative': return '负向影响'
      default: return '微弱影响'
    }
  }

  const formatSnapshotTitle = (snapshot: { startTime: number; scene: string; sleepScore: number }) => {
    const date = new Date(snapshot.startTime)
    return `${date.getMonth() + 1}月${date.getDate()}日 · ${snapshot.scene}`
  }

  return (
    <div class="flex h-full gap-4">
      <div class="flex-1 overflow-y-auto pr-2">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-bold text-white">多维关联分析</h1>
            <p class="text-sm text-slate-400 mt-1">分析环境参数与睡眠深度的相关性</p>
          </div>
          <div class="flex gap-2">
            <button
              onClick={() => setCorrelationMethod('pearson')}
              class={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                correlationMethod() === 'pearson'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              Pearson
            </button>
            <button
              onClick={() => setCorrelationMethod('spearman')}
              class={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                correlationMethod() === 'spearman'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              Spearman
            </button>
            <button
              onClick={() => setShowSidebar(!showSidebar())}
              class="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-all md:hidden"
            >
              选择快照
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="glass-panel rounded-xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Brain class="w-5 h-5 text-indigo-400" />
              相关性热力图
            </h3>
            {analysisResult() ? (
              <CorrelationHeatmap data={analysisResult()!.correlationMatrix} size={260} />
            ) : (
              <div class="h-64 flex items-center justify-center">
                <p class="text-slate-500">请选择睡眠快照进行分析</p>
              </div>
            )}
          </div>

          <div class="glass-panel rounded-xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp class="w-5 h-5 text-cyan-400" />
              影响权重排序
            </h3>
            {analysisResult()?.weightAnalysis?.length ? (
              <div class="space-y-4">
                <For each={analysisResult()!.weightAnalysis}>
                  {(item: WeightAnalysisItem) => (
                    <div>
                      <div class="flex justify-between items-center mb-1">
                        <span class="text-sm text-slate-300">{item.factorLabel}</span>
                        <span class={`text-sm font-mono ${getImpactColor(item.impact)}`}>
                          {(item.weight * 100).toFixed(1)}% · {getImpactLabel(item.impact)}
                        </span>
                      </div>
                      <div class="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          class="h-full rounded-full transition-all"
                          style={`width: ${item.weight * 100}%; background: linear-gradient(90deg, ${item.impact === 'negative' ? '#06b6d4' : '#ef4444'}, ${item.impact === 'negative' ? '#8b5cf6' : '#f97316'});`}
                        />
                      </div>
                    </div>
                  )}
                </For>
              </div>
            ) : (
              <div class="h-64 flex items-center justify-center">
                <p class="text-slate-500">暂无分析数据</p>
              </div>
            )}
          </div>

          <div class="glass-panel rounded-xl p-6 lg:col-span-2">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock class="w-5 h-5 text-purple-400" />
              综合睡眠评分
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DataCard
                icon={Sun}
                title="综合睡眠质量"
                value={analysisResult() ? `${analysisResult()!.overallScore}%` : '--'}
                color="#8b5cf6"
              >
                <p class="text-xs text-slate-500">基于多维环境参数综合评估</p>
              </DataCard>
              <div class="glass-panel rounded-xl p-4 bg-white/5">
                <p class="text-sm text-slate-400 mb-2">分析信息</p>
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-slate-500">分析方法</span>
                    <span class="text-white font-mono uppercase">{correlationMethod()}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-slate-500">分析时间</span>
                    <span class="text-white font-mono text-xs">
                      {analysisResult() ? new Date(analysisResult()!.timestamp).toLocaleString('zh-CN') : '--'}
                    </span>
                  </div>
                  <button
                    onClick={() => analysisResult() && runTimeShiftAnalysis(analysisResult()!.snapshotId)}
                    disabled={!analysisResult() || isAnalyzing()}
                    class="w-full mt-2 px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-sm border border-indigo-500/40 hover:bg-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing() ? '分析中...' : '时间偏移分析'}
                  </button>
                </div>
              </div>
              <div class="glass-panel rounded-xl p-4 bg-white/5">
                <p class="text-sm text-slate-400 mb-2">当前快照</p>
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-slate-500">场景</span>
                    <span class="text-white">{selectedSnapshot()?.scene || '--'}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-slate-500">时长</span>
                    <span class="text-white font-mono">
                      {selectedSnapshot() ? formatDuration(Math.floor(selectedSnapshot()!.duration / 60000)) : '--'}
                    </span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-slate-500">睡眠评分</span>
                    <span class="text-green-400 font-mono">
                      {selectedSnapshot() ? `${selectedSnapshot()!.sleepScore}%` : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="glass-panel rounded-xl p-6 lg:col-span-2">
            <h3 class="text-lg font-semibold text-white mb-4">关于时间偏移分析</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              睡眠环境对睡眠质量的影响可能存在延迟效应。例如，入睡前的高噪音可能会影响入睡后一段时间的睡眠深度。
              时间偏移分析可以帮助发现环境参数变化与睡眠质量变化之间的时间延迟关系，
              有助于优化睡眠环境调控策略的提前量设置。
            </p>
          </div>
        </div>
      </div>

      <div
        class={`w-80 flex-shrink-0 glass-panel rounded-xl p-4 overflow-y-auto transition-all ${
          showSidebar() ? 'block' : 'hidden md:block'
        }`}
      >
        <h3 class="text-lg font-semibold text-white mb-4">选择睡眠快照</h3>
        <div class="space-y-2">
          <For each={snapshots()}>
            {(snapshot) => (
              <div
                onClick={() => handleSelectSnapshot(snapshot.id)}
                class={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedSnapshot()?.id === snapshot.id
                    ? 'bg-indigo-500/20 border border-indigo-500/40'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                <div class="flex justify-between items-start mb-1">
                  <span class="text-sm font-medium text-white">{formatSnapshotTitle(snapshot)}</span>
                  <span class="text-xs text-slate-500">{snapshot.sleepScore}%</span>
                </div>
                <div class="text-xs text-slate-500">
                  {new Date(snapshot.startTime).toLocaleDateString('zh-CN')}
                </div>
                <div class="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      class="h-full rounded-full"
                      style={`width: ${snapshot.sleepScore}%; background: linear-gradient(90deg, #8b5cf6, #06b6d4);`}
                    />
                  </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
