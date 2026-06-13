<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';

const props = withDefaults(defineProps<{
  title: string;
  value: string | number;
  icon: Component;
  trend?: number;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  subtitle?: string;
}>(), {
  color: 'blue',
  trend: 0,
});

const colorClasses = computed(() => {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-cyan-500 text-blue-400 bg-blue-600/10 border-blue-500/30',
    green: 'from-green-500 to-emerald-500 text-green-400 bg-green-600/10 border-green-500/30',
    amber: 'from-amber-500 to-orange-500 text-amber-400 bg-amber-600/10 border-amber-500/30',
    red: 'from-red-500 to-rose-500 text-red-400 bg-red-600/10 border-red-500/30',
    purple: 'from-purple-500 to-fuchsia-500 text-purple-400 bg-purple-600/10 border-purple-500/30',
  };
  return colors[props.color];
});

const bgGradient = computed(() => {
  const gradients: Record<string, string> = {
    blue: 'from-blue-500 to-cyan-400',
    green: 'from-green-500 to-emerald-400',
    amber: 'from-amber-500 to-orange-400',
    red: 'from-red-500 to-rose-400',
    purple: 'from-purple-500 to-fuchsia-400',
  };
  return gradients[props.color];
});
</script>

<template>
  <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600/50 transition-all hover:shadow-lg hover:shadow-slate-900/50">
    <div class="flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-400 mb-1">{{ title }}</div>
        <div class="text-3xl font-bold text-slate-100 mb-2">{{ value }}</div>
        <div v-if="subtitle" class="text-xs text-slate-500">{{ subtitle }}</div>
        <div v-if="trend !== 0" class="flex items-center gap-1 mt-2">
          <span
            class="text-xs font-medium"
            :class="trend > 0 ? 'text-green-400' : 'text-red-400'"
          >
            {{ trend > 0 ? '↑' : '↓' }} {{ Math.abs(trend) }}%
          </span>
          <span class="text-xs text-slate-500">较昨日</span>
        </div>
      </div>
      <div
        class="w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center"
        :class="[bgGradient, 'bg-opacity-20']"
      >
        <component :is="icon" class="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
</template>
