<script setup lang="ts">
import { computed } from 'vue';
import { TrendingUp, TrendingDown, Minus } from 'lucide-vue-next';

const props = defineProps<{
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: any;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan' | 'green' | 'orange' | 'red';
  subtitle?: string;
}>();

const colorClasses = computed(() => {
  const colors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    default: {
      bg: 'from-slate-mid/20 to-slate-dark/20',
      border: 'border-slate-mid/30',
      text: 'text-white',
      glow: '',
    },
    success: {
      bg: 'from-success-green/10 to-success-green/5',
      border: 'border-success-green/30',
      text: 'text-success-green',
      glow: 'shadow-success-green/10',
    },
    warning: {
      bg: 'from-warning-amber/10 to-warning-amber/5',
      border: 'border-warning-amber/30',
      text: 'text-warning-amber',
      glow: 'shadow-warning-amber/10',
    },
    danger: {
      bg: 'from-danger-red/10 to-danger-red/5',
      border: 'border-danger-red/30',
      text: 'text-danger-red',
      glow: 'shadow-danger-red/10',
    },
    info: {
      bg: 'from-info-blue/10 to-info-blue/5',
      border: 'border-info-blue/30',
      text: 'text-info-blue',
      glow: 'shadow-info-blue/10',
    },
    purple: {
      bg: 'from-neon-purple/10 to-neon-purple/5',
      border: 'border-neon-purple/30',
      text: 'text-neon-purple',
      glow: 'shadow-neon-purple/10',
    },
    cyan: {
      bg: 'from-cyber-teal/10 to-cyber-teal/5',
      border: 'border-cyber-teal/30',
      text: 'text-cyber-teal',
      glow: 'shadow-cyber-teal/10',
    },
    green: {
      bg: 'from-success-green/10 to-success-green/5',
      border: 'border-success-green/30',
      text: 'text-success-green',
      glow: 'shadow-success-green/10',
    },
    orange: {
      bg: 'from-alert-orange/10 to-alert-orange/5',
      border: 'border-alert-orange/30',
      text: 'text-alert-orange',
      glow: 'shadow-alert-orange/10',
    },
    red: {
      bg: 'from-danger-red/10 to-danger-red/5',
      border: 'border-danger-red/30',
      text: 'text-danger-red',
      glow: 'shadow-danger-red/10',
    },
  };
  return colors[props.color || 'default'];
});

const trendIcon = computed(() => {
  if (props.trend === 'up') return TrendingUp;
  if (props.trend === 'down') return TrendingDown;
  return Minus;
});

const trendColor = computed(() => {
  if (props.trend === 'up') return 'text-success-green';
  if (props.trend === 'down') return 'text-danger-red';
  return 'text-slate-light';
});
</script>

<template>
  <div
    :class="[
      'relative overflow-hidden rounded-xl p-5 border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]',
      'bg-gradient-to-br',
      colorClasses.bg,
      colorClasses.border,
      colorClasses.glow ? `shadow-lg ${colorClasses.glow}` : ''
    ]"
  >
    <div class="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-purple/50 to-transparent"></div>

    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center gap-3">
        <div
          v-if="icon"
          :class="[
            'w-10 h-10 rounded-lg flex items-center justify-center bg-white/10',
            colorClasses.text
          ]"
        >
          <component :is="icon" class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-medium text-slate-light">{{ title }}</h3>
          <p v-if="subtitle" class="text-xs text-slate-mid">{{ subtitle }}</p>
        </div>
      </div>
      <div
        v-if="trendValue"
        :class="['flex items-center gap-1 text-xs font-medium', trendColor]"
      >
        <component :is="trendIcon" class="w-3.5 h-3.5" />
        <span>{{ trendValue }}</span>
      </div>
    </div>

    <div class="flex items-baseline gap-2">
      <span :class="['font-display text-3xl font-bold', colorClasses.text]">{{ value }}</span>
      <span v-if="unit" class="text-sm text-slate-light">{{ unit }}</span>
    </div>
  </div>
</template>
