<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  value: number;
  max?: number;
  color?: 'success' | 'warning' | 'danger' | 'info' | 'purple';
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}>();

const max = props.max || 100;
const percentage = computed(() => Math.min(100, Math.max(0, (props.value / max) * 100)));

const colorClasses = computed(() => {
  const colors: Record<string, string> = {
    success: 'from-success-green to-success-green/70',
    warning: 'from-warning-amber to-warning-amber/70',
    danger: 'from-danger-red to-danger-red/70',
    info: 'from-info-blue to-info-blue/70',
    purple: 'from-neon-purple to-neon-purple/70',
  };
  return colors[props.color || 'info'];
});

const heightClasses = computed(() => ({
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
}));
</script>

<template>
  <div class="w-full">
    <div v-if="showLabel" class="flex justify-between items-center mb-1">
      <slot name="label">
        <span class="text-xs text-slate-light">{{ value }}/{{ max }}</span>
      </slot>
      <span class="text-xs text-slate-light">{{ Math.round(percentage) }}%</span>
    </div>
    <div
      :class="[
        'w-full rounded-full bg-slate-dark overflow-hidden',
        heightClasses[height || 'md']
      ]"
    >
      <div
        :class="[
          'h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out',
          colorClasses,
          animated ? 'animate-pulse' : ''
        ]"
        :style="{ width: percentage + '%' }"
      >
        <div class="w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      </div>
    </div>
  </div>
</template>
