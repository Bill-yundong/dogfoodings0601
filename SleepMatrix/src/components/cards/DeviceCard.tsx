import type { DeviceStatus } from '@/types'
import { Wifi, WifiOff, Activity } from 'lucide-solid'

interface Props {
  device: DeviceStatus
  onClick?: () => void
}

export default function DeviceCard(props: Props) {
  const isSensor = props.device.type === 'sensor'

  return (
    <div
      class="glass-card glass-card-hover p-4 cursor-pointer transition-all duration-300"
      onClick={props.onClick}
    >
      <div class="flex items-center gap-3 mb-3">
        <div
          class={`w-10 h-10 rounded-xl flex items-center justify-center ${
            props.device.connected
              ? isSensor
                ? 'bg-calm-cyan/20'
                : 'bg-dream-purple/20'
              : 'bg-slate-700/50'
          }`}
        >
          {isSensor ? (
            <Activity
              class={`w-5 h-5 ${
                props.device.connected ? 'text-calm-cyan animate-pulse' : 'text-slate-500'
              }`}
            />
          ) : (
            <Activity
              class={`w-5 h-5 ${
                props.device.connected ? 'text-dream-purple' : 'text-slate-500'
              }`}
            />
          )}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">{props.device.name}</p>
          <p class="text-xs text-slate-500">
            {isSensor ? '传感器' : '控制器'}
          </p>
        </div>
        <div
          class={`w-8 h-8 rounded-lg flex items-center justify-center ${
            props.device.connected ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}
        >
          {props.device.connected ? (
            <Wifi class="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff class="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>

      {props.device.metrics && (
        <div class="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
          {Object.entries(props.device.metrics || {}).map(([k, value]) => (
            <div>
              <p class="text-xs text-slate-500 capitalize">{k}</p>
              <p class="text-sm font-mono text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div class="mt-3 pt-3 border-t border-white/5">
        <p class="text-xs text-slate-500">
          最后更新: {new Date(props.device.lastUpdate).toLocaleTimeString('zh-CN')}
        </p>
      </div>
    </div>
  )
}
