import { Component, JSX } from 'solid-js';

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
  showValue?: boolean;
}

export const ProgressRing: Component<ProgressRingProps> = (props) => {
  const size = props.size || 120;
  const strokeWidth = props.strokeWidth || 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const color = props.color || '#00D4FF';

  const progress = Math.min(100, Math.max(0, props.progress));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div class="relative inline-flex items-center justify-center">
      <svg width={size} height={size} class="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          stroke-width={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          stroke-width={strokeWidth}
          stroke-linecap="round"
          stroke-dasharray={circumference.toString()}
          stroke-dashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease',
            filter: `drop-shadow(0 0 6px ${color})`,
          } as unknown as JSX.CSSProperties}
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        {props.showValue !== false && (
          <span class="text-2xl font-display font-bold text-white">{progress.toFixed(0)}%</span>
        )}
        {props.label && (
          <span class="text-xs font-mono text-white/50 mt-1">{props.label}</span>
        )}
      </div>
    </div>
  );
};
