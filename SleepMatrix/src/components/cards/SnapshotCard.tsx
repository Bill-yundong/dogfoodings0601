import type { SleepSnapshot } from '@/types'
import { formatDate, formatDuration } from '@/utils/time'
import { Moon, Sun, Bed, Clock } from 'lucide-solid'

interface Props {
  snapshot: SleepSnapshot
  selected?: boolean
  onClick?: () => void
}

export default function SnapshotCard(props: Props) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981'
    if (score >= 60) return '#F59E0B'
    return '#EF4444'
  }

  const getSceneIcon = (scene: string) => {
    if (scene.includes('午')) return Sun
    return Moon
  }

  const Icon = getSceneIcon(props.snapshot.scene)

  return (
    <div
      class={`glass-card glass-card-hover p-4 cursor-pointer transition-all duration-300 ${
        props.selected ? 'ring-2 ring-dream-purple/50 glow-border' : ''
      }`}
      onClick={props.onClick}
    >
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-dream-purple/20 flex items-center justify-center">
            <Icon class="w-5 h-5 text-dream-purple" />
          </div>
          <div>
            <p class="text-sm font-medium text-white">{props.snapshot.scene}</p>
            <p class="text-xs text-slate-500">{formatDate(props.snapshot.startTime)}</p>
          </div>
        </div>
        <div class="text-right">
          <p
            class="text-xl font-bold font-mono"
            style={{ color: getScoreColor(props.snapshot.sleepScore) }}
          >
            {props.snapshot.sleepScore}
          </p>
          <p class="text-xs text-slate-500">睡眠评分</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 py-3 border-y border-white/5">
        <div class="flex items-center gap-2">
          <Bed class="w-4 h-4 text-slate-500" />
          <div>
            <p class="text-xs text-slate-500">时长</p>
            <p class="text-sm text-white font-mono">{formatDuration(props.snapshot.duration)}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Clock class="w-4 h-4 text-slate-500" />
          <div>
            <p class="text-xs text-slate-500">数据点</p>
            <p class="text-sm text-white font-mono">{props.snapshot.envData.length}</p>
          </div>
        </div>
      </div>

      <div class="mt-3">
        <div class="flex justify-between text-xs text-slate-500 mb-1">
          <span>睡眠质量</span>
          <span>{props.snapshot.sleepScore}%</span>
        </div>
        <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            style={`width: ${props.snapshot.sleepScore}%; background-color: ${getScoreColor(props.snapshot.sleepScore)}; box-shadow: 0 0 8px ${getScoreColor(props.snapshot.sleepScore)}60;`}
          />
        </div>
      </div>
    </div>
  )
}
