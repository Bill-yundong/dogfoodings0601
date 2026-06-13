<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-vue-next';
import type { MedicalAlert } from '../../types/medical';
import { getRiskColor, getRiskLabel } from '../../types/algorithm';
import dayjs from 'dayjs';

const props = defineProps<{
  alert: MedicalAlert;
}>();

const emit = defineEmits<{
  acknowledge: [id: string];
}>();

const icon = computed(() => {
  if (props.alert.severity === 'critical') return AlertTriangle;
  if (props.alert.severity === 'high') return AlertCircle;
  return Info;
});

const colorClass = computed(() => {
  const colors: Record<string, string> = {
    critical: 'border-red-500/50 bg-red-900/20',
    high: 'border-amber-500/50 bg-amber-900/20',
    medium: 'border-blue-500/50 bg-blue-900/20',
    low: 'border-green-500/50 bg-green-900/20',
  };
  return colors[props.alert.severity] || colors.medium;
});

const iconColor = computed(() => {
  const colors: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-amber-400',
    medium: 'text-blue-400',
    low: 'text-green-400',
  };
  return colors[props.alert.severity] || colors.medium;
});

const statusLabel = computed(() => props.alert.acknowledged ? '已处理' : '待处理');
const statusClass = computed(() => props.alert.acknowledged ? 'bg-slate-600/50 text-slate-400' : 'bg-red-600/20 text-red-400');
</script>

<template>
  <div
    class="border rounded-xl p-4 transition-all hover:shadow-lg"
    :class="colorClass"
  >
    <div class="flex items-start gap-3">
      <component :is="icon" class="w-5 h-5 flex-shrink-0 mt-0.5" :class="iconColor" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-semibold text-slate-100">{{ alert.title }}</span>
          <span
            class="px-2 py-0.5 text-xs rounded-full"
            :style="{ backgroundColor: `${getRiskColor(alert.severity as any)}20`, color: getRiskColor(alert.severity as any) }"
          >
            {{ getRiskLabel(alert.severity as any) }}
          </span>
          <span class="px-2 py-0.5 text-xs rounded-full" :class="statusClass">
            {{ statusLabel }}
          </span>
        </div>
        <p class="text-sm text-slate-400 mb-2">{{ alert.message }}</p>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4 text-xs text-slate-500">
            <span>机组: {{ alert.crewName }}</span>
            <span>时间: {{ dayjs(alert.timestamp).format('MM-DD HH:mm') }}</span>
          </div>
          <div v-if="!alert.acknowledged" class="flex items-center gap-2">
            <button
              @click="emit('acknowledge', alert.id)"
              class="px-3 py-1 text-xs rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 transition-colors"
            >
              确认处理
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
