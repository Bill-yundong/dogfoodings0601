<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  AlertTriangle,
  Filter,
  Search,
  Play,
  Pause,
  RotateCcw,
  Clock,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-vue-next';
import { useConflictStore } from '@/stores/conflictStore';
import { useDeviceStore } from '@/stores/deviceStore';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ProgressBar from '@/components/common/ProgressBar.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { formatDateTime, formatDuration, getTimeAgo, formatTime } from '@/utils/dateUtils';
import {
  getConflictTypeText,
  getSeverityTagClass,
  getSeverityColor,
  getStatusTagClass,
  getStatusText,
} from '@/utils/conflictUtils';

const router = useRouter();
const conflictStore = useConflictStore();
const deviceStore = useDeviceStore();

const searchQuery = ref('');
const typeFilter = ref<string>('all');
const severityFilter = ref<string>('all');
const statusFilter = ref<string>('all');
const selectedTab = ref<'list' | 'queue'>('list');

const conflictTypes = [
  { value: 'all', label: '全部类型' },
  { value: 'security_vs_comfort', label: '安防 vs 舒适' },
  { value: 'energy_vs_comfort', label: '节能 vs 舒适' },
  { value: 'scene_conflict', label: '场景冲突' },
  { value: 'rule_contradiction', label: '规则矛盾' },
];

const severityLevels = [
  { value: 'all', label: '全部级别' },
  { value: 'critical', label: '严重' },
  { value: 'high', label: '高危' },
  { value: 'medium', label: '中等' },
  { value: 'low', label: '轻微' },
];

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'detected', label: '已检测' },
  { value: 'pending', label: '待处理' },
  { value: 'resolving', label: '解析中' },
  { value: 'resolved', label: '已解决' },
  { value: 'ignored', label: '已忽略' },
];

const filteredConflicts = computed(() => {
  return conflictStore.conflicts.filter(conflict => {
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const matchDescription = conflict.description.toLowerCase().includes(query);
      const matchDevice = conflict.sourceDevices.some(id =>
        deviceStore.getDeviceById(id)?.name.toLowerCase().includes(query)
      );
      if (!matchDescription && !matchDevice) return false;
    }
    if (typeFilter.value !== 'all' && conflict.type !== typeFilter.value) return false;
    if (severityFilter.value !== 'all' && conflict.severity !== severityFilter.value) return false;
    if (statusFilter.value !== 'all' && conflict.status !== statusFilter.value) return false;
    return true;
  });
});

const allTasks = computed(() => [
  ...conflictStore.taskQueue,
  ...conflictStore.processingTasks,
  ...conflictStore.completedTasks,
  ...conflictStore.failedTasks,
].sort((a, b) => b.createdAt - a.createdAt));

const goToDetail = (id: string) => {
  router.push(`/conflicts/${id}`);
};

const handleResolve = async (id: string) => {
  await conflictStore.resolveConflict(id);
};

const handleIgnore = (id: string) => {
  conflictStore.ignoreConflict(id);
};

const handleRetry = (taskId: string) => {
  conflictStore.retryTask(taskId);
};

const toggleQueue = () => {
  if (conflictStore.isPaused) {
    conflictStore.resumeResolution();
  } else {
    conflictStore.pauseResolution();
  }
};

const clearFilters = () => {
  searchQuery.value = '';
  typeFilter.value = 'all';
  severityFilter.value = 'all';
  statusFilter.value = 'all';
};

const getDeviceName = (id: string) => {
  return deviceStore.getDeviceById(id)?.name || id;
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-4">
      <div class="flex-1 min-w-64">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-light" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索冲突描述或设备名称..."
            class="input-field pl-10"
          />
        </div>
      </div>
      <select v-model="typeFilter" class="input-field w-auto">
        <option v-for="opt in conflictTypes" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <select v-model="severityFilter" class="input-field w-auto">
        <option v-for="opt in severityLevels" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <select v-model="statusFilter" class="input-field w-auto">
        <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <button @click="clearFilters" class="btn-secondary text-sm">
        清除筛选
      </button>
    </div>

    <div class="flex gap-2">
      <button
        @click="selectedTab = 'list'"
        :class="[
          'px-6 py-2 rounded-lg font-medium transition-all duration-200',
          selectedTab === 'list'
            ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
            : 'text-slate-light hover:text-white hover:bg-midnight/50'
        ]"
      >
        <span class="flex items-center gap-2">
          <AlertTriangle class="w-4 h-4" />
          冲突列表
          <span class="px-2 py-0.5 text-xs rounded-full bg-slate-mid/30">
            {{ filteredConflicts.length }}
          </span>
        </span>
      </button>
      <button
        @click="selectedTab = 'queue'"
        :class="[
          'px-6 py-2 rounded-lg font-medium transition-all duration-200',
          selectedTab === 'queue'
            ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
            : 'text-slate-light hover:text-white hover:bg-midnight/50'
        ]"
      >
        <span class="flex items-center gap-2">
          <Clock class="w-4 h-4" />
          解析队列
          <span class="px-2 py-0.5 text-xs rounded-full bg-slate-mid/30">
            {{ allTasks.length }}
          </span>
        </span>
      </button>
    </div>

    <div v-if="selectedTab === 'list'" class="space-y-4">
      <div v-if="filteredConflicts.length === 0">
        <EmptyState
          title="没有找到冲突记录"
          description="尝试调整筛选条件或清除筛选器查看所有冲突"
          :icon="AlertCircle"
        >
          <template #actions>
            <button @click="clearFilters" class="btn-primary mt-4">
              清除筛选
            </button>
          </template>
        </EmptyState>
      </div>

      <div
        v-for="conflict in filteredConflicts"
        :key="conflict.id"
        class="glass-card p-5 hover:border-neon-purple/50 transition-all duration-200 cursor-pointer"
        @click="goToDetail(conflict.id)"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-12 h-12 rounded-xl flex items-center justify-center',
                getSeverityTagClass(conflict.severity).replace('border-', 'bg-opacity-50 ')
              ]"
            >
              <AlertTriangle :class="['w-6 h-6', getSeverityColor(conflict.severity)]" />
            </div>
            <div>
              <h3 class="font-medium text-white">{{ conflict.description }}</h3>
              <div class="flex items-center gap-2 mt-1">
                <StatusBadge :status="conflict.severity" type="severity" size="sm" />
                <StatusBadge :status="conflict.status" type="conflict" size="sm" />
                <span class="text-xs text-slate-light">
                  {{ getConflictTypeText(conflict.type) }}
                </span>
              </div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm text-slate-light">{{ formatDateTime(conflict.detectedAt) }}</div>
            <div v-if="conflict.resolvedAt" class="text-xs text-success-green mt-1">
              耗时: {{ formatDuration(conflict.resolvedAt - conflict.detectedAt) }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4 mb-4 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-slate-light">触发设备:</span>
            <span class="text-white">{{ conflict.sourceDevices.map(getDeviceName).join(', ') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-slate-light">影响设备:</span>
            <span class="text-white">{{ conflict.targetDevices.length }} 台</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-slate-light">场景:</span>
            <span class="text-white">{{ conflict.affectedScenes.join(', ') }}</span>
          </div>
        </div>

        <div class="bg-slate-dark/50 rounded-lg p-3 mb-4">
          <div class="text-xs text-slate-light mb-1">潜在风险</div>
          <div class="text-sm text-warning-amber">{{ conflict.potentialRisk }}</div>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-light">
              {{ getTimeAgo(conflict.detectedAt).text }}
            </span>
          </div>
          <div class="flex items-center gap-2" @click.stop>
            <button
              v-if="conflict.status === 'detected' || conflict.status === 'pending'"
              @click="handleResolve(conflict.id)"
              class="btn-success text-xs px-3 py-1.5"
            >
              <CheckCircle class="w-3.5 h-3.5 mr-1" />
              解析
            </button>
            <button
              v-if="conflict.status === 'detected' || conflict.status === 'pending'"
              @click="handleIgnore(conflict.id)"
              class="btn-secondary text-xs px-3 py-1.5"
            >
              <XCircle class="w-3.5 h-3.5 mr-1" />
              忽略
            </button>
            <ChevronRight class="w-5 h-5 text-slate-light" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="space-y-4">
      <div class="glass-card p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-success-green animate-pulse"></div>
              <span class="text-sm text-slate-light">队列状态:</span>
              <span class="text-white font-medium">
                {{ conflictStore.isPaused ? '已暂停' : '运行中' }}
              </span>
            </div>
            <div class="text-sm text-slate-light">
              等待: <span class="text-white">{{ conflictStore.pendingCount }}</span>
            </div>
            <div class="text-sm text-slate-light">
              处理中: <span class="text-neon-purple">{{ conflictStore.processingCount }}</span>
            </div>
            <div class="text-sm text-slate-light">
              已完成: <span class="text-success-green">{{ conflictStore.completedTasks.length }}</span>
            </div>
            <div class="text-sm text-slate-light">
              失败: <span class="text-danger-red">{{ conflictStore.failedTasks.length }}</span>
            </div>
          </div>
          <button
            @click="toggleQueue"
            :class="conflictStore.isPaused ? 'btn-success' : 'btn-secondary'"
            class="text-sm"
          >
            <component :is="conflictStore.isPaused ? Play : Pause" class="w-4 h-4 mr-1.5" />
            {{ conflictStore.isPaused ? '继续' : '暂停' }}
          </button>
        </div>
      </div>

      <div v-if="allTasks.length === 0">
        <EmptyState
          title="暂无解析任务"
          description="当检测到冲突时，系统会自动创建解析任务并加入队列"
          :icon="Clock"
        />
      </div>

      <div
        v-for="task in allTasks"
        :key="task.id"
        class="glass-card p-4"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-10 h-10 rounded-lg flex items-center justify-center',
                task.status === 'completed' ? 'bg-success-green/20' :
                task.status === 'processing' ? 'bg-neon-purple/20' :
                task.status === 'failed' ? 'bg-danger-red/20' : 'bg-slate-dark/50'
              ]"
            >
              <CheckCircle v-if="task.status === 'completed'" class="w-5 h-5 text-success-green" />
              <AlertCircle v-else-if="task.status === 'failed'" class="w-5 h-5 text-danger-red" />
              <Clock v-else-if="task.status === 'processing'" class="w-5 h-5 text-neon-purple animate-spin" />
              <Clock v-else class="w-5 h-5 text-slate-light" />
            </div>
            <div>
              <div class="text-sm font-medium text-white">任务 #{{ task.id.slice(-8) }}</div>
              <div class="text-xs text-slate-light mt-0.5">
                冲突ID: {{ task.conflictId.slice(-8) }}
              </div>
            </div>
          </div>
          <div class="text-right">
            <StatusBadge
              :status="task.status === 'queued' ? 'pending' : task.status === 'processing' ? 'resolving' : task.status"
              type="conflict"
              size="sm"
            />
            <div class="text-xs text-slate-light mt-1">
              优先级: {{ task.priority }}
            </div>
          </div>
        </div>

        <div v-if="task.status === 'processing'" class="mb-3">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-slate-light">{{ task.currentStep }}</span>
            <span class="text-white">{{ task.progress }}%</span>
          </div>
          <ProgressBar :value="task.progress" color="purple" animated />
        </div>

        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-4 text-slate-light">
            <span>创建: {{ getTimeAgo(task.createdAt).text }}</span>
            <span v-if="task.startedAt">开始: {{ formatTime(task.startedAt) }}</span>
            <span v-if="task.completedAt">完成: {{ formatTime(task.completedAt) }}</span>
          </div>
          <div class="flex items-center gap-2" v-if="task.status === 'failed'">
            <span class="text-danger-red">{{ task.error }}</span>
            <button @click="handleRetry(task.id)" class="text-neon-purple hover:text-neon-purple/80 flex items-center gap-1">
              <RotateCcw class="w-3 h-3" />
              重试
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
