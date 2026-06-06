<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from '@/components/common/Sidebar.vue';
import { useDeviceStore } from '@/stores/deviceStore';
import { useConflictStore } from '@/stores/conflictStore';
import { useSemanticStore } from '@/stores/semanticStore';
import { useSnapshotStore } from '@/stores/snapshotStore';
import { useSensorSimulation } from '@/composables/useSensorSimulation';

const route = useRoute();
const deviceStore = useDeviceStore();
const conflictStore = useConflictStore();
const semanticStore = useSemanticStore();
const snapshotStore = useSnapshotStore();

const { sensorDataStream, isRunning, devices, startSimulation, stopSimulation, triggerManualData } = useSensorSimulation();

onMounted(async () => {
  await conflictStore.init();
  await snapshotStore.init();
  conflictStore.setDevices(deviceStore.devices);

  if (conflictStore.conflicts.length === 0) {
    for (let i = 0; i < 3; i++) {
      conflictStore.generateTestConflict();
    }
  }

  startSimulation();
});

watch(sensorDataStream, (newData) => {
  if (newData.length > 0) {
    const latest = newData[0];
    deviceStore.addSensorData(latest);

    const alignmentResult = semanticStore.processSensorData(latest);
    if (alignmentResult.conflictPotential > 0.7) {
      const conflict = conflictStore.detectAndProcess(latest);
      if (conflict && Math.random() > 0.5) {
        snapshotStore.createSnapshot(
          deviceStore.getDeviceById(latest.deviceId) || devices.value[0],
          'conflict_detected',
          false
        );
      }
    }
  }
}, { deep: true });

watch(devices, (newDevices) => {
  deviceStore.devices = newDevices;
}, { deep: true });
</script>

<template>
  <div class="min-h-screen bg-deep-space tech-grid-bg">
    <div class="scan-line fixed inset-0 pointer-events-none z-40 opacity-30"></div>

    <Sidebar />

    <main class="ml-64 min-h-screen">
      <header class="sticky top-0 z-30 bg-deep-space/80 backdrop-blur-xl border-b border-slate-mid/30">
        <div class="px-8 py-4 flex items-center justify-between">
          <div>
            <h1 class="font-display text-xl font-semibold text-white">{{ route.meta.title || '监控仪表盘' }}</h1>
            <p class="text-sm text-slate-light mt-0.5">
              实时监控家庭自动化系统逻辑冲突状态
            </p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2 px-4 py-2 bg-midnight/50 rounded-lg border border-slate-mid/30">
              <div
                :class="[
                  'w-2 h-2 rounded-full',
                  isRunning ? 'bg-success-green animate-pulse' : 'bg-slate-mid'
                ]"
              ></div>
              <span class="text-sm text-slate-light">
                {{ isRunning ? '数据采集中' : '已暂停' }}
              </span>
            </div>
            <button
              @click="triggerManualData()"
              class="btn-secondary text-sm"
            >
              模拟数据
            </button>
            <button
              @click="conflictStore.generateTestConflict()"
              class="btn-primary text-sm"
            >
              模拟冲突
            </button>
          </div>
        </div>
      </header>

      <div class="p-8">
        <router-view v-slot="{ Component }">
          <transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-4"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-4"
            mode="out-in"
          >
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>
