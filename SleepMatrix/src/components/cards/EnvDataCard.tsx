import { Component, createMemo, For } from 'solid-js';
import { Motion } from '@motionone/solid';
import { Sun, Thermometer, Volume2, Droplets } from 'lucide-solid';
import type { EnvDataPoint } from '@/types/data';
import { cn } from '@/lib/utils';

interface EnvDataCardProps {
  data: EnvDataPoint | null;
  class?: string;
}

const getStatusColor = (value: number, param: string): string => {
  const ranges: Record<string, [number, number]> = {
    lightLux: [0, 50],
    temperatureC: [18, 26],
    noiseDb: [20, 55],
    humidity: [40, 65],
  };
  const [min, max] = ranges[param] || [0, 100];
  if (value < min || value > max) return 'text-rose-400';
  if (value < min + (max - min) * 0.2 || value > max - (max - min) * 0.2) return 'text-amber-400';
  return 'text-mint-400';
};

const getBarColor = (value: number, param: string): string => {
  const ranges: Record<string, [number, number]> = {
    lightLux: [0, 100],
    temperatureC: [15, 35],
    noiseDb: [20, 85],
    humidity: [30, 80],
  };
  const [min, max] = ranges[param] || [0, 100];
  const percent = ((value - min) / (max - min)) * 100;

  if (param === 'temperatureC') {
    if (percent < 30) return 'from-blue-500 to-blue-400';
    if (percent < 60) return 'from-mint-500 to-mint-400';
    return 'from-amber-500 to-rose-500';
  }
  if (param === 'noiseDb') {
    if (percent < 40) return 'from-mint-500 to-mint-400';
    if (percent < 70) return 'from-amber-500 to-amber-400';
    return 'from-rose-500 to-rose-400';
  }
  return 'from-moon-500 to-moon-400';
};

const params = [
  { key: 'lightLux', label: '光照', unit: 'lux', icon: Sun, range: [0, 100] },
  { key: 'temperatureC', label: '温度', unit: '°C', icon: Thermometer, range: [15, 35] },
  { key: 'noiseDb', label: '噪音', unit: 'dB', icon: Volume2, range: [20, 85] },
  { key: 'humidity', label: '湿度', unit: '%', icon: Droplets, range: [30, 80] },
] as const;

export const EnvDataCard: Component<EnvDataCardProps> = (props) => {
  const data = createMemo(() => props.data);

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      class={cn(
        'bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6',
        props.class
      )}
    >
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-white font-display">环境参数</h3>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-mint-400 animate-pulse" />
          <span class="text-xs text-midnight-400">实时</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <For each={params}>
          {(param) => {
            const value = data()?.[param.key] ?? 0;
            const percent = ((value - param.range[0]) / (param.range[1] - param.range[0])) * 100;

            return (
              <div class="bg-midnight-800/40 rounded-xl p-4 border border-midnight-700/30 hover:border-moon-500/30 transition-all duration-300">
                <div class="flex items-center gap-2 mb-3">
                  <div class={cn(
                    'p-2 rounded-lg',
                    getStatusColor(value, param.key) === 'text-mint-400' ? 'bg-mint-500/20' :
                    getStatusColor(value, param.key) === 'text-amber-400' ? 'bg-amber-500/20' : 'bg-rose-500/20'
                  )}>
                    <param.icon class={cn('w-4 h-4', getStatusColor(value, param.key))} />
                  </div>
                  <span class="text-sm text-midnight-400">{param.label}</span>
                </div>

                <div class="mb-2">
                  <span class={cn('text-2xl font-bold font-display', getStatusColor(value, param.key))}>
                    {value.toFixed(1)}
                  </span>
                  <span class="text-sm text-midnight-500 ml-1">{param.unit}</span>
                </div>

                <div class="h-1.5 bg-midnight-700/50 rounded-full overflow-hidden">
                  <Motion.div
                    class={cn('h-full rounded-full bg-gradient-to-r', getBarColor(value, param.key))}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </Motion.div>
  );
};
