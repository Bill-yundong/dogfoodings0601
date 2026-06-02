<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDeviceStore } from '@/stores/device'
import { useConflictStore } from '@/stores/conflict'
import { useSensorStore } from '@/stores/sensor'
import { useSnapshotStore } from '@/stores/snapshot'
import { SensorSimulator, ConflictDetector, AsyncConflictQueue } from '@/engine/ConflictEngine'
import { semanticAligner } from '@/engine/SemanticAligner'
import type { SensorEvent } from '@/types'
import { saveSensorEvent } from '@/db'
import {
  LayoutDashboard,
  ShieldAlert,
  Camera,
  Settings2,
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  Zap,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const deviceStore = useDeviceStore()
const conflictStore = useConflictStore()
const sensorStore = useSensorStore()
const snapshotStore = useSnapshotStore()

const simulator = new SensorSimulator()
const detector = new ConflictDetector(semanticAligner)
const queue = new AsyncConflictQueue()

const currentTime = ref(new Date())
const isSimulating = ref(true)

let timeInterval: ReturnType<typeof setInterval> | null = null

queue.setOnResolved((conflict, trace) => {
  conflictStore.updateConflict(conflict.id, conflict)
  conflictStore.addTrace(trace)
  const snapshotDeviceIds = new Set<string>()
  conflict.events.forEach((evt) => {
    const dev = deviceStore.devices.find((d) => d.id === evt.sensorId || d.id === `dev-${evt.sensorId.replace('sec-', '').replace('home-', '')}`)
    if (dev) {
      snapshotDeviceIds.add(dev.id)
    }
  })
  snapshotDeviceIds.forEach((devId) => {
    const dev = deviceStore.devices.find((d) => d.id === devId)
    if (dev) {
      snapshotStore.addSnapshot({
        id: `snap-${Date.now()}-${devId}`,
        deviceId: dev.id,
        deviceName: dev.name,
        room: dev.room,
        type: dev.type,
        state: { ...dev.state },
        timestamp: Date.now(),
        triggerEvent: conflict.id,
      })
    }
  })
})

const navItems = [
  { path: '/dashboard', label: '实时监控', icon: LayoutDashboard },
  { path: '/conflict', label: '冲突解析', icon: ShieldAlert },
  { path: '/snapshot', label: '设备快照', icon: Camera },
  { path: '/rules', label: '规则引擎', icon: Settings2 },
]

function handleSensorEvent(event: SensorEvent) {
  sensorStore.addEvent(event)
  saveSensorEvent(event)
  const conflict = detector.ingest(event)
  if (conflict) {
    conflictStore.addConflict(conflict)
    queue.enqueue(conflict)
  }
}

function toggleSimulation() {
  if (isSimulating.value) {
    simulator.stop()
    isSimulating.value = false
  } else {
    simulator.start(handleSensorEvent as any, 3000)
    isSimulating.value = true
  }
}

onMounted(() => {
  snapshotStore.loadSnapshots()
  simulator.start(handleSensorEvent as any, 3000)
  timeInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  simulator.stop()
  if (timeInterval) clearInterval(timeInterval)
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-dark-900">
    <aside class="w-60 flex-shrink-0 border-r border-[var(--border-subtle)] bg-dark-800 flex flex-col">
      <div class="p-5 border-b border-[var(--border-subtle)]">
        <div class="flex items-center gap-2">
          <Zap class="w-6 h-6 text-cyan-glow" />
          <h1 class="font-display text-lg font-bold text-cyan-glow glow-text tracking-wider">HAP</h1>
        </div>
        <p class="text-[0.65rem] text-[var(--text-muted)] mt-1 font-mono tracking-widest">HOME AUTO PULSE</p>
      </div>

      <nav class="flex-1 py-4 px-3 space-y-1">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200"
          :class="route.path === item.path
            ? 'bg-[var(--bg-card)] text-cyan-glow border border-[var(--border-active)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'"
        >
          <component :is="item.icon" class="w-4 h-4" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="p-4 border-t border-[var(--border-subtle)]">
        <div class="glass-card p-3 space-y-2">
          <div class="flex items-center justify-between">
            <span class="data-label">系统状态</span>
            <span class="flex items-center gap-1.5 text-xs">
              <span class="status-dot" :class="isSimulating ? 'status-online' : 'status-offline'" />
              <span :class="isSimulating ? 'text-emerald-ok' : 'text-[var(--text-muted)]'">
                {{ isSimulating ? '运行中' : '已暂停' }}
              </span>
            </span>
          </div>
          <button
            @click="toggleSimulation"
            class="w-full py-1.5 rounded text-xs font-mono tracking-wider transition-all"
            :class="isSimulating
              ? 'bg-dark-600 text-[var(--text-secondary)] hover:bg-dark-500'
              : 'bg-cyan-glow/20 text-cyan-glow hover:bg-cyan-glow/30'"
          >
            {{ isSimulating ? '暂停模拟' : '恢复模拟' }}
          </button>
        </div>
      </div>
    </aside>

    <div class="flex-1 flex flex-col overflow-hidden">
      <header class="h-12 flex-shrink-0 border-b border-[var(--border-subtle)] bg-dark-800/50 flex items-center justify-between px-6">
        <div class="flex items-center gap-4">
          <span class="font-display text-xs tracking-wider text-[var(--text-muted)]">
            {{ currentTime.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) }}
          </span>
          <span class="font-mono text-xs text-cyan-glow">
            {{ currentTime.toLocaleTimeString('zh-CN') }}
          </span>
        </div>
        <div class="flex items-center gap-5 text-xs">
          <span class="flex items-center gap-1.5">
            <Wifi class="w-3.5 h-3.5 text-emerald-ok" />
            <span class="data-label">在线</span>
            <span class="data-value text-emerald-ok">{{ deviceStore.onlineCount }}</span>
          </span>
          <span class="flex items-center gap-1.5">
            <WifiOff class="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span class="data-label">离线</span>
            <span class="data-value text-[var(--text-muted)]">{{ deviceStore.offlineCount }}</span>
          </span>
          <span class="flex items-center gap-1.5">
            <AlertTriangle class="w-3.5 h-3.5 text-amber-alert" />
            <span class="data-label">冲突</span>
            <span class="data-value" :class="conflictStore.pendingCount > 0 ? 'text-amber-alert' : 'text-[var(--text-secondary)]'">{{ conflictStore.pendingCount }}</span>
          </span>
          <span class="flex items-center gap-1.5">
            <CheckCircle class="w-3.5 h-3.5 text-emerald-ok" />
            <span class="data-label">已解析</span>
            <span class="data-value text-emerald-ok">{{ conflictStore.resolvedCount }}</span>
          </span>
          <span class="flex items-center gap-1.5">
            <Activity class="w-3.5 h-3.5 text-cyan-glow" />
            <span class="data-label">事件</span>
            <span class="data-value text-cyan-glow">{{ sensorStore.events.length }}</span>
          </span>
        </div>
      </header>

      <main class="flex-1 overflow-auto p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>
