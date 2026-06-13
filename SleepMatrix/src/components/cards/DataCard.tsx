import type { Component } from 'solid-js'

interface Props {
  icon: Component<any>
  title: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: string
  children?: any
}

export default function DataCard(props: Props) {
  const Icon = props.icon

  return (
    <div class="glass-card glass-card-hover p-5 transition-all duration-300">
      <div class="flex items-start justify-between mb-4">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center"
          style={`background: ${props.color || '#6366F1'}20;`}
        >
          <Icon class="w-5 h-5" style={`color: ${props.color || '#6366F1'};`} />
        </div>
        {props.trend && (
          <span
            class={`text-xs px-2 py-1 rounded-lg font-medium ${
              props.trend === 'up'
                ? 'bg-emerald-500/20 text-emerald-400'
                : props.trend === 'down'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-slate-500/20 text-slate-400'
            }`}
          >
            {props.trend === 'up' ? '↑' : props.trend === 'down' ? '↓' : '→'} {props.trendValue}
          </span>
        )}
      </div>

      <p class="text-sm text-slate-400 mb-1">{props.title}</p>
      <div class="flex items-baseline gap-1">
        <span class="text-2xl font-bold text-white font-mono">{props.value}</span>
        {props.unit && <span class="text-sm text-slate-500">{props.unit}</span>}
      </div>

      {props.children && <div class="mt-4 pt-4 border-t border-white/5">{props.children}</div>}
    </div>
  )
}
