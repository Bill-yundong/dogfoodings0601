<script setup lang="ts">
import { computed } from 'vue';
import type { DeviceStatus, SyncStatus } from '@/types/device';
import type { ConflictStatus } from '@/types/conflict';

const props = defineProps<{
  status: string;
  type?: 'device' | 'conflict' | 'sync' | 'severity';
  size?: 'sm' | 'md';
  showPulse?: boolean;
}>();

const sizeClasses = computed(() => ({
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
}));

const statusConfig = computed(() => {
  const configs: Record<string, Record<string, { class: string; text: string; dotBg: string; pulseBg: string }>> = {
    device: {
      online: { class: 'bg-success-green/20 text-success-green border-success-green/30', text: '在线', dotBg: 'bg-success-green', pulseBg: 'bg-success-green/40' },
      offline: { class: 'bg-slate-mid/50 text-slate-light border-slate-mid/30', text: '离线', dotBg: 'bg-slate-light', pulseBg: 'bg-slate-light/40' },
      error: { class: 'bg-danger-red/20 text-danger-red border-danger-red/30', text: '错误', dotBg: 'bg-danger-red', pulseBg: 'bg-danger-red/40' },
      syncing: { class: 'bg-neon-purple/20 text-neon-purple border-neon-purple/30', text: '同步中', dotBg: 'bg-neon-purple', pulseBg: 'bg-neon-purple/40' },
    },
    conflict: {
      detected: { class: 'bg-danger-red/20 text-danger-red border-danger-red/30', text: '已检测', dotBg: 'bg-danger-red', pulseBg: 'bg-danger-red/40' },
      pending: { class: 'bg-warning-amber/20 text-warning-amber border-warning-amber/30', text: '待处理', dotBg: 'bg-warning-amber', pulseBg: 'bg-warning-amber/40' },
      resolving: { class: 'bg-neon-purple/20 text-neon-purple border-neon-purple/30', text: '解析中', dotBg: 'bg-neon-purple', pulseBg: 'bg-neon-purple/40' },
      resolved: { class: 'bg-success-green/20 text-success-green border-success-green/30', text: '已解决', dotBg: 'bg-success-green', pulseBg: 'bg-success-green/40' },
      ignored: { class: 'bg-slate-mid/50 text-slate-light border-slate-mid/30', text: '已忽略', dotBg: 'bg-slate-light', pulseBg: 'bg-slate-light/40' },
    },
    sync: {
      pending: { class: 'bg-warning-amber/20 text-warning-amber border-warning-amber/30', text: '待同步', dotBg: 'bg-warning-amber', pulseBg: 'bg-warning-amber/40' },
      synced: { class: 'bg-success-green/20 text-success-green border-success-green/30', text: '已同步', dotBg: 'bg-success-green', pulseBg: 'bg-success-green/40' },
      failed: { class: 'bg-danger-red/20 text-danger-red border-danger-red/30', text: '同步失败', dotBg: 'bg-danger-red', pulseBg: 'bg-danger-red/40' },
    },
    severity: {
      critical: { class: 'bg-danger-red/20 text-danger-red border-danger-red/30', text: '严重', dotBg: 'bg-danger-red', pulseBg: 'bg-danger-red/40' },
      high: { class: 'bg-alert-orange/20 text-alert-orange border-alert-orange/30', text: '高危', dotBg: 'bg-alert-orange', pulseBg: 'bg-alert-orange/40' },
      medium: { class: 'bg-warning-amber/20 text-warning-amber border-warning-amber/30', text: '中等', dotBg: 'bg-warning-amber', pulseBg: 'bg-warning-amber/40' },
      low: { class: 'bg-info-blue/20 text-info-blue border-info-blue/30', text: '轻微', dotBg: 'bg-info-blue', pulseBg: 'bg-info-blue/40' },
    },
  };

  const type = props.type || 'device';
  return configs[type]?.[props.status] || { class: 'bg-slate-mid/50 text-slate-light border-slate-mid/30', text: props.status, dotBg: 'bg-slate-light', pulseBg: 'bg-slate-light/40' };
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      sizeClasses[size || 'md'],
      statusConfig.class
    ]"
  >
    <span
      v-if="showPulse"
      class="relative flex w-2 h-2"
    >
      <span class="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping" :class="statusConfig.pulseBg"></span>
      <span class="relative inline-flex rounded-full w-2 h-2" :class="statusConfig.dotBg"></span>
    </span>
    <span>{{ statusConfig.text }}</span>
  </span>
</template>
