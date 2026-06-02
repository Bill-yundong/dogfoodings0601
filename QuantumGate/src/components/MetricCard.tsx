import { Component } from 'solid-js';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon?: string;
  color?: 'cyan' | 'green' | 'orange' | 'purple' | 'blue';
}

export const MetricCard: Component<MetricCardProps> = (props) => {
  const colorClasses: Record<string, string> = {
    cyan: 'text-quantum-cyan border-quantum-cyan/30',
    green: 'text-quantum-green border-quantum-green/30',
    orange: 'text-quantum-orange border-quantum-orange/30',
    purple: 'text-quantum-purple border-quantum-purple/30',
    blue: 'text-quantum-cyan border-quantum-cyan/30',
  };

  const color = props.color || 'cyan';

  return (
    <div class="glass-card rounded-lg p-4 hover:border-opacity-30 transition-all duration-300">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-xs font-mono text-white/50 mb-1">{props.title}</p>
          <div class="flex items-baseline gap-1">
            <span class={`text-2xl font-display font-bold ${colorClasses[color].split(' ')[0]}`}>
              {props.value}
            </span>
            {props.unit && (
              <span class="text-sm font-mono text-white/50">{props.unit}</span>
            )}
          </div>
        </div>
        {props.icon && (
          <div class={`w-10 h-10 rounded-lg flex items-center justify-center border ${colorClasses[color]} bg-white/5 text-xl`}>
            {props.icon}
          </div>
        )}
      </div>
      {props.trend !== undefined && (
        <div class="mt-3 flex items-center gap-1">
          <span class={props.trend >= 0 ? 'text-quantum-green' : 'text-quantum-orange'}>
            {props.trend >= 0 ? '↑' : '↓'}
          </span>
          <span class="text-xs font-mono text-white/50">
            {Math.abs(props.trend).toFixed(2)}% 较上周期
          </span>
        </div>
      )}
    </div>
  );
};
