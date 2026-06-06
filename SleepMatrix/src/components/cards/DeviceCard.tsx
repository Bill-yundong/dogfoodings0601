import { Component } from 'solid-js';
import { Motion } from '@motionone/solid';
import { Wifi, WifiOff, Battery, Cpu, RefreshCw, Settings } from 'lucide-solid';
import type { Device } from '@/types/device';
import { DEVICE_STATUS_LABELS, DEVICE_STATUS_COLORS } from '@/types/device';
import { cn } from '@/lib/utils';

interface DeviceCardProps {
  device: Device;
  selected?: boolean;
  onSelect?: (device: Device) => void;
  onRefresh?: (deviceId: string) => void;
  onConfigure?: (device: Device) => void;
  class?: string;
}

const DEVICE_TYPE_ICONS: Record<string, string> = {
  sensor: '📡',
  controller: '🎛️',
  hybrid: '🔄',
};

const DEVICE_TYPE_LABELS: Record<string, string> = {
  sensor: '传感器',
  controller: '控制器',
  hybrid: '混合设备',
};

export const DeviceCard: Component<DeviceCardProps> = (props) => {
  const statusColor = () => DEVICE_STATUS_COLORS[props.device.status];
  const statusLabel = () => DEVICE_STATUS_LABELS[props.device.status];
  const isOnline = () => props.device.status === 'online';

  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      class={cn(
        'relative bg-midnight-900/60 backdrop-blur-xl border rounded-2xl p-5 overflow-hidden group cursor-pointer transition-all duration-300',
        props.selected
          ? 'border-moon-500/50 shadow-lg shadow-moon-500/10'
          : 'border-midnight-700/50 hover:border-moon-500/30',
        props.class
      )}
      onClick={() => props.onSelect?.(props.device)}
    >
      <div
        class="absolute top-0 right-0 w-20 h-20 opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"
        style={{ 'background-color': statusColor() }}
      />

      <div class="relative">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="text-3xl">{DEVICE_TYPE_ICONS[props.device.type]}</div>
            <div>
              <h4 class="font-semibold text-white">{props.device.name}</h4>
              <p class="text-xs text-midnight-400">{DEVICE_TYPE_LABELS[props.device.type]}</p>
            </div>
          </div>

          <div class="flex items-center gap-1">
            {isOnline() ? (
              <Wifi class="w-4 h-4 text-mint-400" />
            ) : (
              <WifiOff class="w-4 h-4 text-midnight-500" />
            )}
          </div>
        </div>

        <div class="space-y-3 mb-4">
          <div class="flex items-center justify-between text-sm">
            <span class="text-midnight-400">状态</span>
            <span
              class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ 'background-color': `${statusColor()}20`, color: statusColor() }}
            >
              <span class="w-1.5 h-1.5 rounded-full animate-pulse" style={{ 'background-color': statusColor() }} />
              {statusLabel()}
            </span>
          </div>

          <div class="flex items-center justify-between text-sm">
            <span class="text-midnight-400">信号</span>
            <div class="flex items-center gap-2">
              <div class="w-16 h-1.5 bg-midnight-700/50 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${props.device.signalStrength}%`,
                    'background-color': statusColor(),
                  }}
                />
              </div>
              <span class="text-xs text-midnight-300 font-mono w-8 text-right">
                {props.device.signalStrength}%
              </span>
            </div>
          </div>

          {props.device.batteryLevel !== undefined && (
            <div class="flex items-center justify-between text-sm">
              <span class="text-midnight-400">电量</span>
              <div class="flex items-center gap-2">
                <Battery class={cn(
                  'w-4 h-4',
                  props.device.batteryLevel > 20 ? 'text-mint-400' : 'text-amber-400'
                )} />
                <span class="text-xs text-midnight-300 font-mono">
                  {props.device.batteryLevel}%
                </span>
              </div>
            </div>
          )}

          <div class="flex items-center justify-between text-sm">
            <span class="text-midnight-400">固件</span>
            <span class="text-xs text-midnight-300 font-mono">{props.device.firmware}</span>
          </div>
        </div>

        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            class={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all',
              'bg-midnight-800/60 hover:bg-midnight-700/60 text-midnight-300 hover:text-white'
            )}
            onClick={(e) => {
              e.stopPropagation();
              props.onRefresh?.(props.device.id);
            }}
          >
            <RefreshCw class="w-3.5 h-3.5" />
            刷新
          </button>
          <button
            class={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all',
              'bg-moon-500/20 hover:bg-moon-500/30 text-moon-400'
            )}
            onClick={(e) => {
              e.stopPropagation();
              props.onConfigure?.(props.device);
            }}
          >
            <Settings class="w-3.5 h-3.5" />
            配置
          </button>
        </div>

        <div class="mt-3 pt-3 border-t border-midnight-700/30 flex items-center justify-between">
          <span class="text-[10px] text-midnight-500 font-mono">{props.device.model}</span>
          <span class="text-[10px] text-midnight-500">{props.device.manufacturer}</span>
        </div>
      </div>
    </Motion.div>
  );
};
