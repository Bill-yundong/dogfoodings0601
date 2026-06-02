<script setup lang="ts">
import DeviceMatrix from '@/components/dashboard/DeviceMatrix.vue'
import HeatMap from '@/components/dashboard/HeatMap.vue'
import SensorChart from '@/components/dashboard/SensorChart.vue'
import AlertTimeline from '@/components/dashboard/AlertTimeline.vue'
import { useDeviceStore } from '@/stores/device'
import { useConflictStore } from '@/stores/conflict'
import { useSensorStore } from '@/stores/sensor'
import { Shield, Home, AlertTriangle, CheckCircle } from 'lucide-vue-next'

const deviceStore = useDeviceStore()
const conflictStore = useConflictStore()
const sensorStore = useSensorStore()
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="section-title text-xl text-cyan-glow glow-text">实时监控仪表盘</h2>
      <span class="data-label">REAL-TIME MONITORING</span>
    </div>

    <div class="grid grid-cols-4 gap-4">
      <div class="glass-card p-4 cyber-border">
        <div class="flex items-center justify-between mb-2">
          <span class="data-label">安防设备</span>
          <Shield class="w-4 h-4 text-amber-alert" />
        </div>
        <div class="data-value text-2xl text-amber-alert">{{ deviceStore.securityDevices.length }}</div>
        <div class="text-xs text-[var(--text-muted)] mt-1">{{ deviceStore.securityDevices.filter(d => d.status === 'online').length }} 在线</div>
      </div>
      <div class="glass-card p-4 cyber-border">
        <div class="flex items-center justify-between mb-2">
          <span class="data-label">家居设备</span>
          <Home class="w-4 h-4 text-cyan-glow" />
        </div>
        <div class="data-value text-2xl text-cyan-glow">{{ deviceStore.homeDevices.length }}</div>
        <div class="text-xs text-[var(--text-muted)] mt-1">{{ deviceStore.homeDevices.filter(d => d.status === 'online').length }} 在线</div>
      </div>
      <div class="glass-card p-4 cyber-border">
        <div class="flex items-center justify-between mb-2">
          <span class="data-label">待解析冲突</span>
          <AlertTriangle class="w-4 h-4 text-amber-alert" />
        </div>
        <div class="data-value text-2xl" :class="conflictStore.pendingCount > 0 ? 'text-amber-alert' : 'text-[var(--text-secondary)]'">{{ conflictStore.pendingCount }}</div>
        <div class="text-xs text-[var(--text-muted)] mt-1">{{ conflictStore.criticalCount }} 紧急</div>
      </div>
      <div class="glass-card p-4 cyber-border">
        <div class="flex items-center justify-between mb-2">
          <span class="data-label">已解析</span>
          <CheckCircle class="w-4 h-4 text-emerald-ok" />
        </div>
        <div class="data-value text-2xl text-emerald-ok">{{ conflictStore.resolvedCount }}</div>
        <div class="text-xs text-[var(--text-muted)] mt-1">总计 {{ conflictStore.totalConflicts }}</div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="col-span-2">
        <DeviceMatrix />
      </div>
      <div>
        <HeatMap />
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="col-span-2">
        <SensorChart />
      </div>
      <div>
        <AlertTimeline />
      </div>
    </div>
  </div>
</template>
