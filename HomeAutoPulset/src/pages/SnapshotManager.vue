<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Database,
  Cloud,
  CloudOff,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  Search,
  Filter,
  Clock,
  MapPin,
  Cpu,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Zap,
  Calendar,
} from 'lucide-vue-next';
import { useSnapshotStore } from '@/stores/snapshotStore';
import { useDeviceStore } from '@/stores/deviceStore';
import StatusBadge from '@/components/common/StatusBadge.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import MetricCard from '@/components/common/MetricCard.vue';
import { formatDateTime, formatDuration, getTimeAgo } from '@/utils/dateUtils';
import type { DeviceSnapshot, SnapshotQuery, SyncStatus } from '@/types/snapshot';

const snapshotStore = useSnapshotStore();
const deviceStore = useDeviceStore();

const searchQuery = ref('');
const deviceFilter = ref<string>('all');
const syncFilter = ref<string>('all');
const offlineFilter = ref<string>('all');
const expandedSnapshotId = ref<string | null>(null);

const triggerConditions = [
  { value: 'conflict_detected', label: '冲突检测' },
  { value: 'device_state_change', label: '设备状态变化' },
  { value: 'scheduled', label: '定时快照' },
  { value: 'manual', label: '手动创建' },
  { value: 'system_startup', label: '系统启动' },
  { value: 'network_change', label: '网络变化' },
];

const getTriggerText = (trigger: string) => {
  const found = triggerConditions.find(t => t.value === trigger);
  return found?.label || trigger;
};

const getSyncStatusText = (status: SyncStatus) => {
  const map: Record<SyncStatus, string> = {
    pending: '待同步',
    synced: '已同步',
    failed: '同步失败',
  };
  return map[status];
};

const getSyncStatusColor = (status: SyncStatus) => {
  const map: Record<SyncStatus, string> = {
    pending: 'text-alert-orange',
    synced: 'text-success-green',
    failed: 'text-danger-red',
  };
  return map[status];
};

const filteredSnapshots = computed(() => {
  return snapshotStore.snapshots.filter(snapshot => {
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const matchDevice = snapshot.metadata.deviceName.toLowerCase().includes(query);
      const matchLocation = snapshot.metadata.location.toLowerCase().includes(query);
      const matchType = snapshot.metadata.deviceType.toLowerCase().includes(query);
      const matchTrigger = getTriggerText(snapshot.triggerCondition).toLowerCase().includes(query);
      if (!matchDevice && !matchLocation && !matchType && !matchTrigger) return false;
    }
    if (deviceFilter.value !== 'all' && snapshot.deviceId !== deviceFilter.value) return false;
    if (syncFilter.value !== 'all' && snapshot.syncStatus !== syncFilter.value) return false;
    if (offlineFilter.value !== 'all') {
      if (offlineFilter.value === 'online' && snapshot.isOffline) return false;
      if (offlineFilter.value === 'offline' && !snapshot.isOffline) return false;
    }
    return true;
  });
});

const getDeviceName = (id: string) => deviceStore.getDeviceById(id)?.name || id;

const formatStorageSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const createManualSnapshot = () => {
  const onlineDevices = deviceStore.onlineDevices;
  if (onlineDevices.length > 0) {
    const randomDevice = onlineDevices[Math.floor(Math.random() * onlineDevices.length)];
    snapshotStore.createSnapshot(randomDevice, 'manual', false);
  }
};

const syncAllPending = async () => {
  await snapshotStore.syncPendingSnapshots();
};

const cleanupOldData = async () => {
  if (confirm('确定要清理30天前的旧数据吗？此操作不可恢复。')) {
    await snapshotStore.cleanupOldData(30);
  }
};

const exportSnapshot = () => {
  const data = {
    snapshots: snapshotStore.snapshots,
    exportTime: Date.now(),
    version: '1.0.0',
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `snapshots-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const clearFilters = () => {
  searchQuery.value = '';
  deviceFilter.value = 'all';
  syncFilter.value = 'all';
  offlineFilter.value = 'all';
};

const refreshData = async () => {
  await snapshotStore.loadSnapshots();
  await snapshotStore.loadStats();
};

onMounted(async () => {
  await snapshotStore.init();
  await snapshotStore.loadSnapshots({ limit: 50 });
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white flex items-center gap-3">
          <Database class="w-7 h-7 text-cyber-teal" />
          设备快照管理
        </h1>
        <p class="text-slate-light mt-1">
          管理智能设备的离线工况快照，保障复杂场景下全屋智能的逻辑可靠性
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          @click="refreshData"
          :disabled="snapshotStore.isLoading"
          class="btn-secondary text-sm"
        >
          <RefreshCw :class="['w-4 h-4 mr-2', snapshotStore.isLoading ? 'animate-spin' : '']" />
          刷新
        </button>
        <button
          @click="createManualSnapshot"
          class="btn-primary text-sm"
        >
          <Plus class="w-4 h-4 mr-2" />
          创建快照
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="总快照数"
        :value="snapshotStore.stats?.totalSnapshots || 0"
        :icon="Database"
        color="cyan"
      />
      <MetricCard
        title="离线快照"
        :value="snapshotStore.stats?.offlineSnapshots || 0"
        :icon="CloudOff"
        color="orange"
      />
      <MetricCard
        title="待同步"
        :value="snapshotStore.stats?.pendingSync || 0"
        :icon="Upload"
        color="purple"
      />
      <MetricCard
        title="存储占用"
        :value="formatStorageSize(snapshotStore.stats?.storageUsed || 0)"
        :icon="HardDrive"
        color="green"
      />
    </div>

    <div class="glass-card p-4">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex-1 min-w-64">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-light" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索设备名称、位置、类型..."
              class="input-field pl-10"
            />
          </div>
        </div>
        <select v-model="deviceFilter" class="input-field w-auto">
          <option value="all">全部设备</option>
          <option
            v-for="device in deviceStore.devices"
            :key="device.id"
            :value="device.id"
          >
            {{ device.name }}
          </option>
        </select>
        <select v-model="syncFilter" class="input-field w-auto">
          <option value="all">全部同步状态</option>
          <option value="pending">待同步</option>
          <option value="synced">已同步</option>
          <option value="failed">同步失败</option>
        </select>
        <select v-model="offlineFilter" class="input-field w-auto">
          <option value="all">全部网络状态</option>
          <option value="online">在线时创建</option>
          <option value="offline">离线时创建</option>
        </select>
        <button @click="clearFilters" class="btn-secondary text-sm">
          清除筛选
        </button>
      </div>
    </div>

    <div class="flex flex-wrap gap-3">
      <button
        @click="syncAllPending"
        :disabled="snapshotStore.isSyncing || snapshotStore.pendingSyncCount === 0"
        class="btn-success text-sm"
      >
        <Cloud :class="['w-4 h-4 mr-2', snapshotStore.isSyncing ? 'animate-pulse' : '']" />
        同步待同步快照 ({{ snapshotStore.pendingSyncCount }})
      </button>
      <button
        @click="cleanupOldData"
        class="btn-secondary text-sm"
      >
        <Trash2 class="w-4 h-4 mr-2" />
        清理旧数据
      </button>
      <button @click="exportSnapshot" class="btn-secondary text-sm">
        <Download class="w-4 h-4 mr-2" />
        导出快照
      </button>
    </div>

    <div v-if="snapshotStore.isLoading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <RefreshCw class="w-8 h-8 text-neon-purple animate-spin mx-auto mb-3" />
        <div class="text-slate-light">加载快照数据中...</div>
      </div>
    </div>

    <div v-else-if="filteredSnapshots.length === 0">
      <EmptyState
        title="没有找到快照记录"
        description="尝试调整筛选条件或创建新的设备快照"
        :icon="Database"
      >
        <template #actions>
          <button @click="clearFilters" class="btn-secondary mt-4 mr-2">
            清除筛选
          </button>
          <button @click="createManualSnapshot" class="btn-primary mt-4">
            <Plus class="w-4 h-4 mr-2" />
            创建快照
          </button>
        </template>
      </EmptyState>
    </div>

    <div v-else class="space-y-4">
      <div class="flex items-center justify-between text-sm text-slate-light">
        <span>显示 {{ filteredSnapshots.length }} 条快照记录</span>
        <span>按创建时间倒序排列</span>
      </div>

      <div
        v-for="snapshot in filteredSnapshots"
        :key="snapshot.id"
        class="glass-card p-5 hover:border-cyber-teal/50 transition-all duration-200"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <div
              :class="[
                'w-12 h-12 rounded-xl flex items-center justify-center',
                snapshot.isOffline
                  ? 'bg-alert-orange/20 border border-alert-orange/30'
                  : 'bg-cyber-teal/20 border border-cyber-teal/30'
              ]"
            >
              <component
                :is="snapshot.isOffline ? CloudOff : Database"
                :class="['w-6 h-6', snapshot.isOffline ? 'text-alert-orange' : 'text-cyber-teal']"
              />
            </div>
            <div>
              <div class="flex items-center gap-3 mb-1">
                <h3 class="font-medium text-white">{{ snapshot.metadata.deviceName }}</h3>
                <span class="px-2 py-0.5 bg-slate-mid/30 text-slate-light rounded text-xs">
                  {{ snapshot.metadata.deviceType }}
                </span>
                <StatusBadge
                  :status="snapshot.isOffline ? 'offline' : 'online'"
                  type="device"
                  size="sm"
                />
              </div>
              <div class="flex flex-wrap items-center gap-4 text-sm">
                <div class="flex items-center gap-2">
                  <MapPin class="w-4 h-4 text-slate-light" />
                  <span class="text-slate-light">位置:</span>
                  <span class="text-white">{{ snapshot.metadata.location }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Zap class="w-4 h-4 text-slate-light" />
                  <span class="text-slate-light">触发:</span>
                  <span class="text-neon-purple">{{ getTriggerText(snapshot.triggerCondition) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Clock class="w-4 h-4 text-slate-light" />
                  <span class="text-slate-light">创建:</span>
                  <span class="text-white">{{ formatDateTime(snapshot.timestamp) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <component
                    :is="snapshot.syncStatus === 'synced' ? Cloud : snapshot.syncStatus === 'failed' ? AlertCircle : Upload"
                    :class="['w-4 h-4', getSyncStatusColor(snapshot.syncStatus)]"
                  />
                  <span :class="getSyncStatusColor(snapshot.syncStatus)">
                    {{ getSyncStatusText(snapshot.syncStatus) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="expandedSnapshotId = expandedSnapshotId === snapshot.id ? null : snapshot.id"
              class="p-2 rounded-lg hover:bg-slate-dark/50 transition-colors"
            >
              <component
                :is="expandedSnapshotId === snapshot.id ? ChevronUp : ChevronDown"
                class="w-5 h-5 text-slate-light"
              />
            </button>
          </div>
        </div>

        <div v-if="expandedSnapshotId === snapshot.id" class="mt-4 pt-4 border-t border-slate-dark">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div class="text-sm text-slate-light mb-3 flex items-center gap-2">
                <Cpu class="w-4 h-4" />
                设备状态快照
              </div>
              <div class="bg-slate-dark/50 rounded-xl p-4">
                <pre class="text-xs text-cyber-teal font-mono overflow-auto max-h-64">{{ JSON.stringify(snapshot.state, null, 2) }}</pre>
              </div>
            </div>
            <div class="space-y-4">
              <div>
                <div class="text-sm text-slate-light mb-3 flex items-center gap-2">
                  <Calendar class="w-4 h-4" />
                  快照元数据
                </div>
                <div class="bg-slate-dark/50 rounded-xl p-4 space-y-2 text-sm">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-light">快照ID</span>
                    <span class="text-white font-mono text-xs">{{ snapshot.id }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-light">设备ID</span>
                    <span class="text-white font-mono text-xs">{{ snapshot.deviceId }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-light">数据哈希</span>
                    <span class="text-white font-mono text-xs">{{ snapshot.dataHash.slice(0, 16) }}...</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-light">创建时间</span>
                    <span class="text-white">{{ formatDateTime(snapshot.timestamp) }}</span>
                  </div>
                  <div v-if="snapshot.syncedAt" class="flex items-center justify-between">
                    <span class="text-slate-light">同步时间</span>
                    <span class="text-success-green">{{ formatDateTime(snapshot.syncedAt) }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-light">离线创建</span>
                    <span :class="snapshot.isOffline ? 'text-alert-orange' : 'text-success-green'">
                      {{ snapshot.isOffline ? '是' : '否' }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex gap-2">
                <button
                  v-if="snapshot.syncStatus === 'pending' || snapshot.syncStatus === 'failed'"
                  class="btn-success text-xs flex-1"
                >
                  <Upload class="w-3 h-3 mr-1.5" />
                  同步到云端
                </button>
                <button class="btn-secondary text-xs flex-1">
                  <Download class="w-3 h-3 mr-1.5" />
                  恢复设备状态
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="snapshotStore.error" class="glass-card p-4 bg-danger-red/10 border border-danger-red/30">
      <div class="flex items-start gap-3">
        <XCircle class="w-5 h-5 text-danger-red flex-shrink-0 mt-0.5" />
        <div class="flex-1">
          <div class="text-sm text-danger-red font-medium">操作错误</div>
          <div class="text-sm text-white">{{ snapshotStore.error }}</div>
        </div>
        <button
          @click="snapshotStore.clearError()"
          class="text-slate-light hover:text-white"
        >
          <XCircle class="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</template>
