import { Component, JSX } from 'solid-js';

interface GlassCardProps {
  title?: string;
  subtitle?: string;
  children: JSX.Element;
  class?: string;
  glow?: boolean;
  hover?: boolean;
}

export const GlassCard: Component<GlassCardProps> = (props) => {
  return (
    <div
      class={`
        glass-card rounded-lg p-4 relative overflow-hidden
        ${props.glow ? 'neon-border animate-pulse-glow' : ''}
        ${props.hover ? 'glass-card-hover transition-all duration-300 cursor-pointer' : ''}
        ${props.class || ''}
      `}
    >
      {props.title && (
        <div class="mb-3">
          <h3 class="text-lg font-display font-semibold text-white">{props.title}</h3>
          {props.subtitle && (
            <p class="text-xs text-white/50 mt-1 font-mono">{props.subtitle}</p>
          )}
        </div>
      )}
      <div class="relative z-10">{props.children}</div>
    </div>
  );
};
