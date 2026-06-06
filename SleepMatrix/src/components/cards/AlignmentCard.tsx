import { Component, createMemo } from 'solid-js';
import { Motion } from '@motionone/solid';
import { Target, Clock, CheckCircle, AlertTriangle } from 'lucide-solid';
import type { AlignedDataPoint } from '@/types/data';
import { cn } from '@/lib/utils';

interface AlignmentCardProps {
  alignedData: AlignedDataPoint[];
  class?: string;
}

export const AlignmentCard: Component<AlignmentCardProps> = (props) => {
  const stats = createMemo(() => {
    const data = props.alignedData;
    if (data.length === 0) {
      return {
        count: 0,
        avgScore: 0,
        minScore: 0,
        maxScore: 0,
        excellentCount: 0,
        goodCount: 0,
        poorCount: 0,
      };
    }

    const scores = data.map(d => d.alignmentScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    return {
      count: data.length,
      avgScore,
      minScore,
      maxScore,
      excellentCount: scores.filter(s => s >= 0.9).length,
      goodCount: scores.filter(s => s >= 0.7 && s < 0.9).length,
      poorCount: scores.filter(s => s < 0.7).length,
    };
  });

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-mint-400';
    if (score >= 0.7) return 'text-amber-400';
    return 'text-rose-400';
  };

  const lastTime = () => {
    if (stats().count === 0) return '--:--:--';
    const last = props.alignedData[props.alignedData.length - 1];
    if (!last?.timestamp) return '--:--:--';
    return new Date(last.timestamp).toLocaleTimeString();
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      class={cn(
        'bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6',
        props.class
      )}
    >
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="p-3 rounded-xl bg-moon-500/20">
            <Target class="w-5 h-5 text-moon-400" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-white font-display">时间对齐引擎</h3>
            <p class="text-xs text-midnight-400">传感器与生理数据实时对齐</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Clock class="w-4 h-4 text-midnight-400" />
          <span class="text-xs text-midnight-400 font-mono">{lastTime()}</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="text-center">
          <p class={cn('text-3xl font-bold font-display', getScoreColor(stats().avgScore))}>
            {(stats().avgScore * 100).toFixed(1)}%
          </p>
          <p class="text-xs text-midnight-400 mt-1">平均对齐质量</p>
        </div>
        <div class="text-center">
          <p class="text-3xl font-bold font-display text-white">{stats().count}</p>
          <p class="text-xs text-midnight-400 mt-1">对齐数据点</p>
        </div>
        <div class="text-center">
          <p class={cn('text-3xl font-bold font-display', getScoreColor(stats().minScore))}>
            {(stats().minScore * 100).toFixed(0)}%
          </p>
          <p class="text-xs text-midnight-400 mt-1">最低对齐分</p>
        </div>
      </div>

      <div class="mb-6">
        <div class="flex justify-between text-xs text-midnight-400 mb-2">
          <span>对齐质量分布</span>
          <span>
            优秀 {stats().excellentCount} · 良好 {stats().goodCount} · 待优化 {stats().poorCount}
          </span>
        </div>
        <div class="h-3 bg-midnight-700/50 rounded-full overflow-hidden flex">
          {stats().count > 0 && (
            <>
              <Motion.div
                class="h-full bg-mint-500"
                initial={{ width: 0 }}
                animate={{ width: `${(stats().excellentCount / stats().count) * 100}%` }}
                transition={{ duration: 0.8 }}
              />
              <Motion.div
                class="h-full bg-amber-500"
                initial={{ width: 0 }}
                animate={{ width: `${(stats().goodCount / stats().count) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
              <Motion.div
                class="h-full bg-rose-500"
                initial={{ width: 0 }}
                animate={{ width: `${(stats().poorCount / stats().count) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.4 }}
              />
            </>
          )}
        </div>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 text-xs">
          <CheckCircle class="w-4 h-4 text-mint-400" />
          <span class="text-midnight-300">滑动时间窗</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <CheckCircle class="w-4 h-4 text-mint-400" />
          <span class="text-midnight-300">加权插值</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          {stats().poorCount === 0 ? (
            <CheckCircle class="w-4 h-4 text-mint-400" />
          ) : (
            <AlertTriangle class="w-4 h-4 text-amber-400" />
          )}
          <span class={stats().poorCount === 0 ? 'text-midnight-300' : 'text-amber-400'}>
            {stats().poorCount === 0 ? '数据质量优秀' : `${stats().poorCount} 点需关注`}
          </span>
        </div>
      </div>
    </Motion.div>
  );
};
