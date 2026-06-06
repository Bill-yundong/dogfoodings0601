import { Component, ParentProps } from 'solid-js';
import { Motion } from '@motionone/solid';
import { cn } from '@/lib/utils';

interface StatCardProps extends ParentProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: Component<{ class?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'moon' | 'mint' | 'amber' | 'rose' | 'blue';
  class?: string;
}

const colorClasses = {
  moon: {
    bg: 'from-moon-500/10 to-moon-600/5',
    border: 'border-moon-500/20',
    icon: 'text-moon-400 bg-moon-500/20',
    trend: 'text-moon-400',
  },
  mint: {
    bg: 'from-mint-500/10 to-mint-600/5',
    border: 'border-mint-500/20',
    icon: 'text-mint-400 bg-mint-500/20',
    trend: 'text-mint-400',
  },
  amber: {
    bg: 'from-amber-500/10 to-amber-600/5',
    border: 'border-amber-500/20',
    icon: 'text-amber-400 bg-amber-500/20',
    trend: 'text-amber-400',
  },
  rose: {
    bg: 'from-rose-500/10 to-rose-600/5',
    border: 'border-rose-500/20',
    icon: 'text-rose-400 bg-rose-500/20',
    trend: 'text-rose-400',
  },
  blue: {
    bg: 'from-blue-500/10 to-blue-600/5',
    border: 'border-blue-500/20',
    icon: 'text-blue-400 bg-blue-500/20',
    trend: 'text-blue-400',
  },
};

export const StatCard: Component<StatCardProps> = (props) => {
  const colors = colorClasses[props.color ?? 'moon'];

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      class={cn(
        'relative p-6 rounded-2xl border backdrop-blur-xl overflow-hidden group',
        'bg-gradient-to-br',
        colors.bg,
        colors.border,
        'hover:shadow-lg hover:shadow-moon-500/5 transition-all duration-300',
        props.class
      )}
    >
      <div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div class="relative flex items-start justify-between mb-4">
        <div class={cn(
          'p-3 rounded-xl transition-transform group-hover:scale-110 duration-300',
          colors.icon
        )}>
          <props.icon class="w-6 h-6" />
        </div>
        {props.trend && (
          <div class={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
            props.trend.isPositive ? 'bg-mint-500/10 text-mint-400' : 'bg-rose-500/10 text-rose-400'
          )}>
            <span>{props.trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(props.trend.value)}%</span>
          </div>
        )}
      </div>

      <div class="relative">
        <p class="text-sm text-midnight-400 mb-1">{props.title}</p>
        <p class="text-3xl font-bold text-white font-display tracking-tight">
          {props.value}
        </p>
        {props.subtitle && (
          <p class="text-xs text-midnight-500 mt-1">{props.subtitle}</p>
        )}
      </div>

      {props.children && (
        <div class="relative mt-4 pt-4 border-t border-midnight-700/30">
          {props.children}
        </div>
      )}
    </Motion.div>
  );
};
