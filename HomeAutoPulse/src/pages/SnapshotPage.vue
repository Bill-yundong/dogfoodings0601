<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSnapshotStore } from '@/stores/snapshot'
import { useDeviceStore } from '@/stores/device'
import { Camera, GitCompare, Clock, Trash2, Search } from 'lucide-vue-next'

const snapshotStore = useSnapshotStore()
const deviceStore = useDeviceStore()

const searchQuery = ref('')
const roomFilter = ref('all')
const activeView = ref<'list' | 'compare' | 'timeline'>('list')

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

const filteredSnapshots = computed(() => {
  let list = snapshotStore.latestSnapshots
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s => s.deviceName.toLowerCase().includes(q) || s.room.toLowerCase().includes(q))
  }
  if (roomFilter.value !== 'all') {
    list = list.filter(s => s.room === roomFilter.value)
  }
  return list
})

function createManualSnapshot() {
  deviceStore.devices.forEach(dev => {
    snapshotStore.addSnapshot({
      id: `snap-manual-${Date.now()}-${dev.id}`,
      deviceId: dev.id,
      deviceName: dev.name,
      room: dev.room,
      type: dev.type,
      state: { ...dev.state },
      timestamp: Date.now(),
      triggerEvent: 'manual',
    })
  })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="section-title text-xl text-cyan-glow glow-text">设备快照管理</h2>
      <div class="flex gap-2">
        <button
          @click="createManualSnapshot"
          class="px-3 py-1.5 rounded text-xs bg-cyan-glow/20 text-cyan-glow hover:bg-cyan-glow/30 transition-all flex items-center gap-1.5"
        >
          <Camera class="w-3 h-3" />
          手动快照
        </button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="glass-card p-4 cyber-border">
        <span class="data-label">总快照数</span>
        <div class="data-value text-2xl text-cyan-glow mt-1">{{ snapshotStore.snapshots.length }}</div>
      </div>
      <div class="glass-card p-4 cyber-border">
        <span class="data-label">已选对比</span>
        <div class="data-value text-2xl mt-1" :class="snapshotStore.selectedSnapshotIds.length === 2 ? 'text-emerald-ok' : 'text-[var(--text-muted)]'">
          {{ snapshotStore.selectedSnapshotIds.length }}/2
        </div>
      </div>
      <div class="glass-card p-4 cyber-border">
        <span class="data-label">IndexedDB</span>
        <div class="data-value text-sm text-emerald-ok mt-2">● 已连接</div>
      </div>
    </div>

    <div class="flex gap-2 border-b border-[var(--border-subtle)] pb-0">
      <button
        v-for="v in [{ key: 'list' as const, label: '快照存储库', icon: Camera }, { key: 'compare' as const, label: '快照对比', icon: GitCompare }, { key: 'timeline' as const, label: '状态时间线', icon: Clock }]"
        :key="v.key"
        @click="activeView = v.key"
        class="px-4 py-2 text-sm transition-all border-b-2 -mb-px flex items-center gap-1.5"
        :class="activeView === v.key
          ? 'text-cyan-glow border-cyan-glow'
          : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'"
      >
        <component :is="v.icon" class="w-3.5 h-3.5" />
        {{ v.label }}
      </button>
    </div>

    <div v-if="activeView === 'list'">
      <div class="flex gap-3 mb-4">
        <div class="relative flex-1">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            v-model="searchQuery"
            placeholder="搜索设备名称或房间..."
            class="w-full pl-9 pr-3 py-2 bg-dark-700 border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-active)] outline-none"
          />
        </div>
        <select
          v-model="roomFilter"
          class="bg-dark-700 border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] focus:border-[var(--border-active)] outline-none"
        >
          <option value="all">全部房间</option>
          <option v-for="room in deviceStore.rooms.filter(r => r !== 'all')" :key="room" :value="room">{{ room }}</option>
        </select>
      </div>

      <div class="space-y-2">
        <div
          v-for="snapshot in filteredSnapshots"
          :key="snapshot.id"
          class="glass-card p-3 flex items-center gap-4 cursor-pointer"
          :class="snapshotStore.selectedSnapshotIds.includes(snapshot.id) ? 'border-cyan-glow/40' : ''"
          @click="snapshotStore.toggleSnapshotSelection(snapshot.id)"
        >
          <div class="w-3 h-3 rounded border-2 flex-shrink-0" :class="[
            snapshotStore.selectedSnapshotIds.includes(snapshot.id)
              ? 'bg-cyan-glow border-cyan-glow'
              : 'border-[var(--text-muted)]'
          ]" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium">{{ snapshot.deviceName }}</span>
              <span class="px-1.5 py-0.5 rounded text-[0.55rem] bg-dark-600 text-[var(--text-muted)]">{{ snapshot.room }}</span>
              <span class="px-1.5 py-0.5 rounded text-[0.55rem]" :class="snapshot.type === 'lock' || snapshot.type === 'alarm' || snapshot.type === 'camera' ? 'bg-amber-alert/10 text-amber-alert' : 'bg-cyan-glow/10 text-cyan-glow'">
                {{ snapshot.type }}
              </span>
            </div>
            <div class="text-[0.6rem] font-mono text-[var(--text-muted)] mt-0.5">
              {{ formatTime(snapshot.timestamp) }}
              <span v-if="snapshot.triggerEvent" class="ml-2">触发: {{ snapshot.triggerEvent === 'manual' ? '手动' : snapshot.triggerEvent }}</span>
            </div>
          </div>
          <div class="text-[0.6rem] font-mono text-[var(--text-secondary)] max-w-48 truncate">
            {{ JSON.stringify(snapshot.state) }}
          </div>
          <button
            @click.stop="snapshotStore.removeSnapshot(snapshot.id)"
            class="p-1.5 rounded hover:bg-rose-danger/10 text-[var(--text-muted)] hover:text-rose-danger transition-all"
          >
            <Trash2 class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="activeView === 'compare'">
      <div v-if="snapshotStore.compareSnapshots" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="glass-card p-4">
            <span class="data-label">快照 A</span>
            <div class="text-sm font-medium mt-1">{{ snapshotStore.compareSnapshots.snapshotA.deviceName }}</div>
            <div class="text-[0.6rem] text-[var(--text-muted)]">{{ formatTime(snapshotStore.compareSnapshots.snapshotA.timestamp) }}</div>
            <div class="mt-2 space-y-1">
              <div v-for="(val, key) in snapshotStore.compareSnapshots.snapshotA.state" :key="key" class="flex justify-between text-xs">
                <span class="text-[var(--text-muted)]">{{ key }}</span>
                <span class="data-value text-[var(--text-secondary)]">{{ JSON.stringify(val) }}</span>
              </div>
            </div>
          </div>
          <div class="glass-card p-4">
            <span class="data-label">快照 B</span>
            <div class="text-sm font-medium mt-1">{{ snapshotStore.compareSnapshots.snapshotB.deviceName }}</div>
            <div class="text-[0.6rem] text-[var(--text-muted)]">{{ formatTime(snapshotStore.compareSnapshots.snapshotB.timestamp) }}</div>
            <div class="mt-2 space-y-1">
              <div v-for="(val, key) in snapshotStore.compareSnapshots.snapshotB.state" :key="key" class="flex justify-between text-xs">
                <span class="text-[var(--text-muted)]">{{ key }}</span>
                <span class="data-value text-[var(--text-secondary)]">{{ JSON.stringify(val) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="glass-card p-4">
          <h4 class="section-title text-xs text-cyan-glow mb-3">差异分析</h4>
          <div class="space-y-1.5">
            <div
              v-for="diff in snapshotStore.compareSnapshots.diffs"
              :key="diff.key"
              class="flex items-center gap-3 p-2 rounded text-xs"
              :class="diff.changed ? 'bg-amber-alert/5 border border-amber-alert/20' : 'bg-dark-800/30'"
            >
              <span class="font-mono text-[var(--text-muted)] w-24 flex-shrink-0">{{ diff.key }}</span>
              <span class="flex-1 truncate" :class="diff.changed ? 'text-amber-alert' : 'text-[var(--text-muted)]'">{{ JSON.stringify(diff.valueA) }}</span>
              <span class="text-[var(--text-muted)]">→</span>
              <span class="flex-1 truncate text-right" :class="diff.changed ? 'text-emerald-ok' : 'text-[var(--text-muted)]'">{{ JSON.stringify(diff.valueB) }}</span>
              <span v-if="diff.changed" class="px-1.5 py-0.5 rounded text-[0.55rem] bg-amber-alert/10 text-amber-alert">变更</span>
              <span v-else class="px-1.5 py-0.5 rounded text-[0.55rem] bg-dark-600 text-[var(--text-muted)]">一致</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center text-sm text-[var(--text-muted)] py-12">
        请在快照列表中选择两个快照进行对比（点击快照卡片选中）
      </div>
    </div>

    <div v-else-if="activeView === 'timeline'">
      <div class="glass-card p-4">
        <h4 class="section-title text-xs text-cyan-glow mb-4">状态时间线</h4>
        <div v-if="snapshotStore.latestSnapshots.length > 0" class="relative pl-6 space-y-0">
          <div class="absolute left-2 top-0 bottom-0 w-px bg-[var(--border-subtle)]" />
          <div
            v-for="(snapshot, idx) in snapshotStore.latestSnapshots.slice(0, 20)"
            :key="snapshot.id"
            class="relative pb-4"
          >
            <div
              class="absolute left-[-18px] top-1 w-3 h-3 rounded-full border-2"
              :class="snapshot.triggerEvent === 'manual' ? 'border-cyan-glow bg-cyan-glow/20' : 'border-amber-alert bg-amber-alert/20'"
            />
            <div class="text-xs font-medium">{{ snapshot.deviceName }}</div>
            <div class="text-[0.6rem] text-[var(--text-muted)] font-mono">{{ formatTime(snapshot.timestamp) }}</div>
            <div class="text-[0.6rem] text-[var(--text-secondary)] mt-0.5">
              {{ JSON.stringify(snapshot.state) }}
            </div>
          </div>
        </div>
        <div v-else class="text-center text-sm text-[var(--text-muted)] py-12">
          暂无快照记录
        </div>
      </div>
    </div>
  </div>
</template>
