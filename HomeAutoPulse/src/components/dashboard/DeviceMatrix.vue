<script setup lang="ts">
import { useDeviceStore } from '@/stores/device'
import { Shield, Lightbulb, Lock, Thermometer, Camera, Bell, Blinds, Zap, Radio } from 'lucide-vue-next'

const deviceStore = useDeviceStore()

const typeIcons: Record<string, any> = {
  lock: Lock,
  sensor: Radio,
  camera: Camera,
  alarm: Bell,
  light: Lightbulb,
  thermostat: Thermometer,
  curtain: Blinds,
  switch: Zap,
}

function getStatusClass(status: string) {
  return `status-${status}`
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <div class="glass-card p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="section-title text-sm text-cyan-glow">设备状态矩阵</h3>
      <div class="flex gap-2">
        <select
          v-model="deviceStore.selectedRoom"
          class="bg-dark-700 border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-secondary)] focus:border-[var(--border-active)] outline-none"
        >
          <option v-for="room in deviceStore.rooms" :key="room" :value="room">
            {{ room === 'all' ? '全部房间' : room }}
          </option>
        </select>
      </div>
    </div>
    <div class="grid grid-cols-4 gap-3">
      <div
        v-for="device in deviceStore.filteredDevices"
        :key="device.id"
        class="p-3 rounded-lg border transition-all duration-300 cursor-pointer hover:scale-[1.02]"
        :class="[
          device.source === 'security_system'
            ? 'bg-amber-alert/5 border-amber-alert/20 hover:border-amber-alert/40'
            : 'bg-cyan-glow/5 border-cyan-glow/20 hover:border-cyan-glow/40',
          device.status === 'offline' ? 'opacity-50' : ''
        ]"
      >
        <div class="flex items-center justify-between mb-2">
          <component
            :is="typeIcons[device.type] || Radio"
            class="w-4 h-4"
            :class="device.source === 'security_system' ? 'text-amber-alert' : 'text-cyan-glow'"
          />
          <span class="status-dot" :class="getStatusClass(device.status)" />
        </div>
        <div class="text-xs font-medium truncate mb-1">{{ device.name }}</div>
        <div class="text-[0.65rem] text-[var(--text-muted)]">{{ device.room }}</div>
        <div class="mt-2 text-[0.6rem] font-mono text-[var(--text-muted)]">
          {{ formatTime(device.lastUpdate) }}
        </div>
      </div>
    </div>
  </div>
</template>
