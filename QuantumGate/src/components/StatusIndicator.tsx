import { Component } from 'solid-js';

type StatusType = 'online' | 'offline' | 'warning' | 'syncing';

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  showDot?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<StatusType, { color: string; label: string; animate?: string }> = {
  online: { color: 'bg-quantum-green', label: '在线', animate: 'animate-pulse' },
  offline: { color: 'bg-red-500', label: '离线' },
  warning: { color: 'bg-quantum-orange', label: '警告', animate: 'animate-pulse' },
  syncing: { color: 'bg-quantum-cyan', label: '同步中', animate: 'animate-pulse' },
};

export const StatusIndicator: Component<StatusIndicatorProps> = (props) => {
  const config = statusConfig[props.status];
  const sizeClass = props.size === 'lg' ? 'w-3 h-3' : props.size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <div class="flex items-center gap-2">
      {props.showDot !== false && (
        <span class={`${sizeClass} rounded-full ${config.color} ${config.animate || ''} shadow-lg`} 
          style={config.animate ? { 'box-shadow': '0 0 10px currentColor' } : {}} />
      )}
      {props.label && <span class="text-xs text-white/70 font-mono">{props.label || config.label}</span>}
    </div>
  );
};
