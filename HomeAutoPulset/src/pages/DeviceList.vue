<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Cpu,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Shield,
  Home,
  Activity,
  Clock,
  ChevronDown,
  ChevronUp,
  Power,
  PowerOff,
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings,
  BarChart3,
  Database,
  Zap,
} from 'lucide-vue-next';
import { useDeviceStore } from '@/stores/deviceStore';
import { useConflictStore } from '@/stores/conflictStore';
import { useSnapshotStore } from '@/stores/snapshotStore';
import StatusBadge from '@/components/common/StatusBadge.vue';
import MetricCard from '@/components/common/MetricCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { formatDateTime, getTimeAgo } from '@/utils/dateUtils';
import type { Device, DeviceStatus, SystemAffiliation, DeviceType } from '@/types/device';

const deviceStore = useDeviceStore();
const conflictStore = useConflictStore();
const snapshotStore = useSnapshotStore();

const searchQuery = ref('');
const statusFilter = ref<string>('all');
const typeFilter = ref<string>('all');
const affiliationFilter = ref<string>('all');
const locationFilter = ref<string>('all');
const viewMode = ref<'grid' | 'list'>('grid');
const expandedDeviceId = ref<string | null>(null);
const isRefreshing = ref(false);

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'online', label: '在线' },
  { value: 'offline', label: '离线' },
  { value: 'error', label: '异常' },
  { value: 'syncing', label: '同步中' },
];

const typeOptions = [
  { value: 'all', label: '全部类型' },
  { value: 'security', label: '安防设备' },
  { value: 'comfort', label: '舒适设备' },
  { value: 'entertainment', label: '娱乐设备' },
  { value: 'energy', label: '能源设备' },
];

const affiliationOptions = [
  { value: 'all', label: '全部系统' },
  { value: 'security', label: '仅安防系统' },
  { value: 'homeControl', label: '仅家居控制' },
  { value: 'both', label: '双系统' },
];

const locations = computed(() => {
  const locs = new Set(deviceStore.devices.map(d => d.location));
  return Array.from(locs);
});

const getTypeText = (type: DeviceType) => {
  const map: Record<DeviceType, string> = {
    security: '安防设备',
    comfort: '舒适设备',
    entertainment: '娱乐设备',
    energy: '能源设备',
  };
  return map[type];
};

const getAffiliationText = (affiliation: SystemAffiliation) => {
  const map: Record<SystemAffiliation, string> = {
    security: '安防系统',
    homeControl: '家居控制',
    both: '双系统',
  };
  return map[affiliation];
};

const getTypeIcon = (type: DeviceType) => {
  const map: Record<DeviceType, any> = {
    security: Shield,
    comfort: Home,
    entertainment: Zap,
    energy: Activity,
  };
  return map[type];
};

const getTypeColor = (type: DeviceType) => {
  const map: Record<DeviceType, string> = {
    security: 'text-cyber-teal',
    comfort: 'text-alert-orange',
    entertainment: 'text-neon-purple',
    energy: 'text-success-green',
  };
  return map[type];
};

const getTypeBgColor = (type: DeviceType) => {
  const map: Record<DeviceType, string> = {
    security: 'bg-cyber-teal/20 border-cyber-teal/30',
    comfort: 'bg-alert-orange/20 border-alert-orange/30',
    entertainment: 'bg-neon-purple/20 border-neon-purple/30',
    energy: 'bg-success-green/20 border-success-green/30',
  };
  return map[type];
};

const filteredDevices = computed(() => {
  return deviceStore.devices.filter(device => {
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const matchName = device.name.toLowerCase().includes(query);
      const matchLocation = device.location.toLowerCase().includes(query);
      const matchCategory = device.category.toLowerCase().includes(query);
      if (!matchName && !matchLocation && !matchCategory) return false;
    }
    if (statusFilter.value !== 'all' && device.status !== statusFilter.value) return false;
    if (typeFilter.value !== 'all' && device.type !== typeFilter.value) return false;
    if (affiliationFilter.value !== 'all' && device.systemAffiliation !== affiliationFilter.value) return false;
    if (locationFilter.value !== 'all' && device.location !== locationFilter.value) return false;
    return true;
  });
});

const getDeviceConflicts = (deviceId: string) => {
  return conflictStore.conflicts.filter(c =>
    c.sourceDevices.includes(deviceId) || c.targetDevices.includes(deviceId)
  );
};

const getDeviceSnapshots = (deviceId: string) => {
  return snapshotStore.snapshots.filter(s => s.deviceId === deviceId);
};

const createDeviceSnapshot = (device: Device) => {
  snapshotStore.createSnapshot(device, 'manual', false);
};

const toggleDevice = (device: Device) => {
  if (device.status === 'online') {
    deviceStore.updateDeviceStatus(device.id, 'offline');
  } else if (device.status === 'offline') {
    deviceStore.updateDeviceStatus(device.id, 'online');
  }
};

const clearFilters = () => {
  searchQuery.value = '';
  statusFilter.value = 'all';
  typeFilter.value = 'all';
  affiliationFilter.value = 'all';
  locationFilter.value = 'all';
};

const refreshDevices = async () => {
  isRefreshing.value = true;
  await new Promise(resolve => setTimeout(resolve, 1000));
  isRefreshing.value = false;
};

const getLatestSensorValue = (deviceId: string, sensorType: string) => {
  const data = deviceStore.getLatestSensorData(deviceId, sensorType);
  return data?.value ?? '--';
};

const formatSensorValue = (value: any, sensorType: string) => {
  if (value === '--') return '--';
  const units: Record<string, string> = {
    temperature: '°C',
    humidity: '%',
    light: 'lux',
    motion: '',
    door: '',
    window: '',
    smoke: '',
    gas: '',
    water: '',
  };
  const unit = units[sensorType] || '';
  if (typeof value === 'boolean') {
    return value ? '触发' : '正常';
  }
  return `${value}${unit}`;
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white flex items-center gap-3">
          <Cpu class="w-7 h-7 text-cyber-teal" />
          设备列表
        </h1>
        <p class="text-slate-light mt-1">
          管理所有已接入的智能设备，查看实时状态和控制选项
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex border border-slate-mid/30 rounded-lg overflow-hidden">
          <button
            @click="viewMode = 'grid'"
            :class="[
              'px-3 py-2 text-sm transition-colors',
              viewMode === 'grid' ? 'bg-neon-purple/20 text-neon-purple' : 'text-slate-light hover:text-white'
            ]"
          >
            <BarChart3 class="w-4 h-4" />
          </button>
          <button
            @click="viewMode = 'list'"
            :class="[
              'px-3 py-2 text-sm transition-colors',
              viewMode === 'list' ? 'bg-neon-purple/20 text-neon-purple' : 'text-slate-light hover:text-white'
            ]"
          >
            <Database class="w-4 h-4" />
          </button>
        </div>
        <button
          @click="refreshDevices"
          :disabled="isRefreshing"
          class="btn-secondary text-sm"
        >
          <RefreshCw :class="['w-4 h-4 mr-2', isRefreshing ? 'animate-spin' : '']" />
          刷新
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="总设备数"
        :value="deviceStore.devices.length"
        :icon="Cpu"
        color="cyan"
      />
      <MetricCard
        title="在线设备"
        :value="deviceStore.onlineDevices.length"
        :icon="Wifi"
        color="green"
      />
      <MetricCard
        title="离线设备"
        :value="deviceStore.offlineDevices.length"
        :icon="WifiOff"
        color="orange"
      />
      <MetricCard
        title="异常设备"
        :value="deviceStore.errorDevices.length"
        :icon="AlertTriangle"
        color="red"
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
        <select v-model="statusFilter" class="input-field w-auto">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="typeFilter" class="input-field w-auto">
          <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="affiliationFilter" class="input-field w-auto">
          <option v-for="opt in affiliationOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="locationFilter" class="input-field w-auto">
          <option value="all">全部位置</option>
          <option v-for="loc in locations" :key="loc" :value="loc">
            {{ loc }}
          </option>
        </select>
        <button @click="clearFilters" class="btn-secondary text-sm">
          清除筛选
        </button>
      </div>
    </div>

    <div v-if="filteredDevices.length === 0">
      <EmptyState
        title="没有找到设备"
        description="尝试调整筛选条件或清除筛选器查看所有设备"
        :icon="Cpu"
      >
        <template #actions>
          <button @click="clearFilters" class="btn-primary mt-4">
            清除筛选
          </button>
        </template>
      </EmptyState>
    </div>

    <div v-else-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="device in filteredDevices"
        :key="device.id"
        class="glass-card p-5 hover:border-neon-purple/50 transition-all duration-200"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-start gap-3">
            <div
              :class="[
                'w-12 h-12 rounded-xl flex items-center justify-center border',
                getTypeBgColor(device.type)
              ]"
            >
              <component :is="getTypeIcon(device.type)" :class="['w-6 h-6', getTypeColor(device.type)]" />
            </div>
            <div>
              <h3 class="font-medium text-white">{{ device.name }}</h3>
              <div class="text-xs text-slate-light mt-0.5">{{ device.category }}</div>
            </div>
          </div>
          <StatusBadge :status="device.status" type="device" />
        </div>

        <div class="space-y-2 mb-4 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-slate-light flex items-center gap-2">
              <MapPin class="w-4 h-4" />
              位置
            </span>
            <span class="text-white">{{ device.location }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-light flex items-center gap-2">
              <Cpu class="w-4 h-4" />
              类型
            </span>
            <span :class="getTypeColor(device.type)">{{ getTypeText(device.type) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-light flex items-center gap-2">
              <Shield class="w-4 h-4" />
              系统
            </span>
            <span class="text-white">{{ getAffiliationText(device.systemAffiliation) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-light flex items-center gap-2">
              <Clock class="w-4 h-4" />
              活跃
            </span>
            <span class="text-white">{{ getTimeAgo(device.lastActivity).text }}</span>
          </div>
        </div>

        <div v-if="device.sensorTypes && device.sensorTypes.length > 0" class="mb-4">
          <div class="text-xs text-slate-light mb-2">传感器数据</div>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="sensor in device.sensorTypes"
              :key="sensor"
              class="bg-slate-dark/50 rounded-lg p-2 text-center"
            >
              <div class="text-xs text-slate-light mb-1">{{ sensor }}</div>
              <div class="text-sm text-white font-medium">
                {{ formatSensorValue(getLatestSensorValue(device.id, sensor), sensor) }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="expandedDeviceId === device.id" class="mb-4 pt-4 border-t border-slate-dark">
          <div class="text-xs text-slate-light mb-2">设备状态</div>
          <div class="bg-slate-dark/50 rounded-xl p-3 mb-3">
            <pre class="text-xs text-cyber-teal font-mono overflow-auto max-h-32">{{ JSON.stringify(device.currentState, null, 2) }}</pre>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-light mb-2">
            <span>相关冲突: {{ getDeviceConflicts(device.id).length }} 条</span>
            <span>设备快照: {{ getDeviceSnapshots(device.id).length }} 条</span>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <button
            @click="expandedDeviceId = expandedDeviceId === device.id ? null : device.id"
            class="text-xs text-slate-light hover:text-white flex items-center gap-1"
          >
            <component :is="expandedDeviceId === device.id ? ChevronUp : ChevronDown" class="w-3 h-3" />
            {{ expandedDeviceId === device.id ? '收起详情' : '查看详情' }}
          </button>
          <div class="flex items-center gap-2">
            <button
              @click="createDeviceSnapshot(device)"
              class="p-2 rounded-lg hover:bg-cyber-teal/20 text-slate-light hover:text-cyber-teal transition-colors"
              title="创建快照"
            >
              <Database class="w-4 h-4" />
            </button>
            <button
              @click="toggleDevice(device)"
              :class="[
                'p-2 rounded-lg transition-colors',
                device.status === 'online'
                  ? 'hover:bg-danger-red/20 text-slate-light hover:text-danger-red'
                  : 'hover:bg-success-green/20 text-slate-light hover:text-success-green'
              ]"
              :title="device.status === 'online' ? '关闭设备' : '开启设备'"
            >
              <component :is="device.status === 'online' ? PowerOff : Power" class="w-4 h-4" />
            </button>
            <button
              class="p-2 rounded-lg hover:bg-slate-dark/50 text-slate-light hover:text-white transition-colors"
              title="设置"
            >
              <Settings class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="device in filteredDevices"
        :key="device.id"
        class="glass-card p-4 hover:border-neon-purple/50 transition-all duration-200"
      >
        <div class="flex items-center gap-4">
          <div
            :class="[
              'w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0',
              getTypeBgColor(device.type)
            ]"
          >
            <component :is="getTypeIcon(device.type)" :class="['w-5 h-5', getTypeColor(device.type)]" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3">
              <h3 class="font-medium text-white truncate">{{ device.name }}</h3>
              <StatusBadge :status="device.status" type="device" size="sm" />
              <span class="text-xs text-slate-light">{{ device.category }}</span>
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-light mt-1">
              <span class="flex items-center gap-1">
                <MapPin class="w-3 h-3" />
                {{ device.location }}
              </span>
              <span :class="getTypeColor(device.type)">{{ getTypeText(device.type) }}</span>
              <span>{{ getAffiliationText(device.systemAffiliation) }}</span>
              <span class="flex items-center gap-1">
                <Clock class="w-3 h-3" />
                {{ getTimeAgo(device.lastActivity).text }}
              </span>
            </div>
          </div>

          <div v-if="device.sensorTypes && device.sensorTypes.length > 0" class="hidden md:flex items-center gap-2">
            <div
              v-for="sensor in device.sensorTypes.slice(0, 3)"
              :key="sensor"
              class="bg-slate-dark/50 rounded-lg px-2 py-1 text-center min-w-16"
            >
              <div class="text-xs text-slate-light">{{ sensor }}</div>
              <div class="text-xs text-white font-medium">
                {{ formatSensorValue(getLatestSensorValue(device.id, sensor), sensor) }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <button
              @click="createDeviceSnapshot(device)"
              class="p-1.5 rounded-lg hover:bg-cyber-teal/20 text-slate-light hover:text-cyber-teal transition-colors"
              title="创建快照"
            >
              <Database class="w-4 h-4" />
            </button>
            <button
              @click="toggleDevice(device)"
              :class="[
                'p-1.5 rounded-lg transition-colors',
                device.status === 'online'
                  ? 'hover:bg-danger-red/20 text-slate-light hover:text-danger-red'
                  : 'hover:bg-success-green/20 text-slate-light hover:text-success-green'
              ]"
              :title="device.status === 'online' ? '关闭设备' : '开启设备'"
            >
              <component :is="device.status === 'online' ? PowerOff : Power" class="w-4 h-4" />
            </button>
            <button
              class="p-1.5 rounded-lg hover:bg-slate-dark/50 text-slate-light hover:text-white transition-colors"
              title="设置"
            >
              <Settings class="w-4 h-4" />
            </button>
            <button
              @click="expandedDeviceId = expandedDeviceId === device.id ? null : device.id"
              class="p-1.5 rounded-lg hover:bg-slate-dark/50 transition-colors"
            >
              <component
                :is="expandedDeviceId === device.id ? ChevronUp : ChevronDown"
                class="w-4 h-4 text-slate-light"
              />
            </button>
          </div>
        </div>

        <div v-if="expandedDeviceId === device.id" class="mt-4 pt-4 border-t border-slate-dark">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-slate-light mb-2">设备状态详情</div>
              <div class="bg-slate-dark/50 rounded-xl p-3">
                <pre class="text-xs text-cyber-teal font-mono overflow-auto max-h-32">{{ JSON.stringify(device.currentState, null, 2) }}</pre>
              </div>
            </div>
            <div>
              <div class="text-xs text-slate-light mb-2">设备信息</div>
              <div class="bg-slate-dark/50 rounded-xl p-3 space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-slate-light">设备ID</span>
                  <span class="text-white font-mono text-xs">{{ device.id }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-light">最后活跃</span>
                  <span class="text-white">{{ formatDateTime(device.lastActivity) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-light">传感器类型</span>
                  <span class="text-white">{{ device.sensorTypes?.join(', ') || '无' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-light">相关冲突</span>
                  <span class="text-danger-red">{{ getDeviceConflicts(device.id).length }} 条</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-light">设备快照</span>
                  <span class="text-cyber-teal">{{ getDeviceSnapshots(device.id).length }} 条</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
