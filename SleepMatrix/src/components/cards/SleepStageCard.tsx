import { Component, createMemo, For } from 'solid-js';
import { Motion } from '@motionone/solid';
import { Heart, Wind, Activity, Brain } from 'lucide-solid';
import type { SleepStagePoint } from '@/types/data';
import { SLEEP_STAGE_LABELS, SLEEP_STAGE_COLORS } from '@/types/data';
import { cn } from '@/lib/utils';

interface SleepStageCardProps {
  data: SleepStagePoint | null;
  class?: string;
}

export const SleepStageCard: Component<SleepStageCardProps> = (props) => {
  const data = createMemo(() => props.data);
  const stage = createMemo(() => data()?.stage ?? 4);
  const stageColor = createMemo(() => SLEEP_STAGE_COLORS[stage()]);
  const stageLabel = createMemo(() => SLEEP_STAGE_LABELS[stage()]);

  const metrics: Array<{
    key: string;
    label: string;
    unit: string;
    icon: Component<{ class?: string }>;
    value: () => number;
    format?: (v: number) => string;
    color: string;
  }> = [
    { key: 'heartRate', label: '心率', unit: 'BPM', icon: Heart, value: () => data()?.heartRate ?? 0, color: 'text-rose-400' },
    { key: 'respiration', label: '呼吸', unit: '次/分', icon: Wind, value: () => data()?.respiration ?? 0, color: 'text-blue-400' },
    { key: 'movement', label: '体动', unit: '', icon: Activity, value: () => (data()?.movement ?? 0) * 100, format: (v: number) => v.toFixed(1), color: 'text-amber-400' },
    { key: 'confidence', label: '置信度', unit: '%', icon: Brain, value: () => (data()?.confidence ?? 0) * 100, format: (v: number) => v.toFixed(0), color: 'text-mint-400' },
  ];

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      class={cn(
        'bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6',
        props.class
      )}
    >
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-white font-display">睡眠状态</h3>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full animate-pulse" style={{ 'background-color': stageColor() }} />
          <span class="text-xs text-midnight-400">实时监测</span>
        </div>
      </div>

      <div class="text-center mb-6">
        <Motion.div
          class="relative inline-flex items-center justify-center"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div class="absolute inset-0 rounded-full blur-xl opacity-30" style={{ 'background-color': stageColor() }} />
          <div
            class="relative w-28 h-28 rounded-full flex flex-col items-center justify-center border-4"
            style={{ 'border-color': stageColor(), 'background-color': `${stageColor()}15` }}
          >
            <span class="text-3xl font-bold font-display" style={{ color: stageColor() }}>
              {stageLabel()}
            </span>
            <span class="text-xs text-midnight-400 mt-1">睡眠分期</span>
          </div>
        </Motion.div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <For each={metrics}>
          {(metric) => {
            const rawValue = metric.value();
            const displayValue = metric.format ? metric.format(rawValue) : rawValue.toFixed(0);

            return (
              <div
                class="bg-midnight-800/40 rounded-xl p-3 border border-midnight-700/30 hover:border-moon-500/30 transition-all duration-300"
              >
              <div class="flex items-center gap-2 mb-2">
                <metric.icon class={cn('w-3.5 h-3.5', metric.color)} />
                <span class="text-xs text-midnight-400">{metric.label}</span>
              </div>
              <div class="flex items-baseline gap-1">
                <span class={cn('text-xl font-bold font-display', metric.color)}>
                  {displayValue}
                </span>
                {metric.unit && (
                  <span class="text-xs text-midnight-500">{metric.unit}</span>
                )}
              </div>
            </div>
          );
        }}
        </For>
      </div>
    </Motion.div>
  );
};
