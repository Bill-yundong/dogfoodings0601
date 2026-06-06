<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  AlertTriangle,
  Shield,
  Home,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertCircle,
  History,
  Settings,
} from 'lucide-vue-next';
import { useConflictStore } from '@/stores/conflictStore';
import { useDeviceStore } from '@/stores/deviceStore';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ProgressBar from '@/components/common/ProgressBar.vue';
import { formatDateTime, formatDuration, getTimeAgo } from '@/utils/dateUtils';
import {
  getConflictTypeText,
  getSeverityTagClass,
  getSeverityColor,
  getStatusTagClass,
  getStatusText,
  getStrategyTypeText,
} from '@/utils/conflictUtils';

const route = useRoute();
const router = useRouter();
const conflictStore = useConflictStore();
const deviceStore = useDeviceStore();

const showResolutionHistory = ref(false);
const selectedStrategy = ref<string>('');

const conflictId = computed(() => route.params.id as string);

const conflict = computed(() =>
  conflictStore.conflicts.find(c => c.id === conflictId.value)
);

const relatedTask = computed(() =>
  [...conflictStore.taskQueue, ...conflictStore.processingTasks, ...conflictStore.completedTasks, ...conflictStore.failedTasks]
    .find(t => t.conflictId === conflictId.value)
);

const sourceDeviceNames = computed(() =>
  conflict.value?.sourceDevices.map(id => deviceStore.getDeviceById(id)?.name || id).join(', ') || ''
);

const targetDeviceNames = computed(() =>
  conflict.value?.targetDevices.map(id => deviceStore.getDeviceById(id)?.name || id).join(', ') || ''
);

const canResolve = computed(() =>
  conflict.value && (conflict.value.status === 'detected' || conflict.value.status === 'pending')
);

const goBack = () => {
  router.push('/conflicts');
};

const handleResolve = async () => {
  if (conflict.value) {
    await conflictStore.resolveConflict(conflict.value.id, selectedStrategy.value || undefined);
  }
};

const handleIgnore = () => {
  if (conflict.value) {
    conflictStore.ignoreConflict(conflict.value.id);
  }
};

const handleRetry = () => {
  if (relatedTask.value) {
    conflictStore.retryTask(relatedTask.value.id);
  }
};

const getDeviceName = (id: string) => deviceStore.getDeviceById(id)?.name || id;

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('zh-CN');

onMounted(() => {
  if (conflict.value) {
    conflictStore.setSelectedConflict(conflict.value);
  }
});
</script>

<template>
  <div v-if="conflict" class="space-y-6">
    <div class="flex items-center gap-4">
      <button @click="goBack" class="btn-secondary text-sm">
        <ArrowLeft class="w-4 h-4 mr-2" />
        返回冲突列表
      </button>
      <div class="flex-1">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold text-white">冲突详情</h1>
          <StatusBadge :status="conflict.severity" type="severity" />
          <StatusBadge :status="conflict.status" type="conflict" />
        </div>
        <div class="text-sm text-slate-light mt-1">
          冲突ID: {{ conflict.id }}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="canResolve"
          @click="handleResolve"
          class="btn-success"
        >
          <CheckCircle class="w-4 h-4 mr-2" />
          解析冲突
        </button>
        <button
          v-if="canResolve"
          @click="handleIgnore"
          class="btn-secondary"
        >
          <XCircle class="w-4 h-4 mr-2" />
          忽略
        </button>
        <button
          v-if="relatedTask?.status === 'failed'"
          @click="handleRetry"
          class="btn-primary"
        >
          <RotateCcw class="w-4 h-4 mr-2" />
          重试
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="glass-card p-6">
          <div class="flex items-start gap-4 mb-6">
            <div
              :class="[
                'w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0',
                getSeverityTagClass(conflict.severity).replace('border-', 'bg-opacity-30 ')
              ]"
            >
              <AlertTriangle :class="['w-8 h-8', getSeverityColor(conflict.severity)]" />
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-semibold text-white mb-2">{{ conflict.description }}</h2>
              <div class="flex flex-wrap items-center gap-4 text-sm">
                <div class="flex items-center gap-2">
                  <Clock class="w-4 h-4 text-slate-light" />
                  <span class="text-slate-light">检测时间:</span>
                  <span class="text-white">{{ formatDateTime(conflict.detectedAt) }}</span>
                </div>
                <div v-if="conflict.resolvedAt" class="flex items-center gap-2">
                  <CheckCircle class="w-4 h-4 text-success-green" />
                  <span class="text-slate-light">解决时间:</span>
                  <span class="text-success-green">{{ formatDateTime(conflict.resolvedAt) }}</span>
                </div>
                <div v-if="conflict.resolvedAt" class="flex items-center gap-2">
                  <Zap class="w-4 h-4 text-neon-purple" />
                  <span class="text-slate-light">耗时:</span>
                  <span class="text-neon-purple">{{ formatDuration(conflict.resolvedAt - conflict.detectedAt) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-slate-dark/50 rounded-xl p-4">
              <div class="text-sm text-slate-light mb-2">冲突类型</div>
              <div class="text-white font-medium">{{ getConflictTypeText(conflict.type) }}</div>
            </div>
            <div class="bg-slate-dark/50 rounded-xl p-4">
              <div class="text-sm text-slate-light mb-2">触发事件</div>
              <div class="text-white font-medium">{{ conflict.triggerEvent }}</div>
            </div>
          </div>

          <div class="mb-6">
            <div class="text-sm text-slate-light mb-2">触发设备</div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="deviceId in conflict.sourceDevices"
                :key="deviceId"
                class="px-3 py-1.5 bg-cyber-teal/10 border border-cyber-teal/30 rounded-lg text-cyber-teal text-sm"
              >
                {{ getDeviceName(deviceId) }}
              </span>
            </div>
          </div>

          <div class="mb-6">
            <div class="text-sm text-slate-light mb-2">受影响设备</div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="deviceId in conflict.targetDevices"
                :key="deviceId"
                class="px-3 py-1.5 bg-alert-orange/10 border border-alert-orange/30 rounded-lg text-alert-orange text-sm"
              >
                {{ getDeviceName(deviceId) }}
              </span>
            </div>
          </div>

          <div class="mb-6">
            <div class="text-sm text-slate-light mb-2">受影响场景</div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="scene in conflict.affectedScenes"
                :key="scene"
                class="px-3 py-1.5 bg-neon-purple/10 border border-neon-purple/30 rounded-lg text-neon-purple text-sm"
              >
                {{ scene }}
              </span>
            </div>
          </div>

          <div class="bg-danger-red/10 border border-danger-red/30 rounded-xl p-4">
            <div class="flex items-start gap-3">
              <AlertCircle class="w-5 h-5 text-danger-red flex-shrink-0 mt-0.5" />
              <div>
                <div class="text-sm font-medium text-danger-red mb-1">潜在风险</div>
                <div class="text-sm text-white">{{ conflict.potentialRisk }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="relatedTask" class="glass-card p-6">
          <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings class="w-5 h-5 text-neon-purple" />
            解析任务状态
          </h3>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="bg-slate-dark/50 rounded-xl p-4">
              <div class="text-sm text-slate-light mb-1">任务ID</div>
              <div class="text-white font-mono text-sm">{{ relatedTask.id }}</div>
            </div>
            <div class="bg-slate-dark/50 rounded-xl p-4">
              <div class="text-sm text-slate-light mb-1">优先级</div>
              <div class="text-white font-medium">{{ relatedTask.priority }}</div>
            </div>
            <div class="bg-slate-dark/50 rounded-xl p-4">
              <div class="text-sm text-slate-light mb-1">重试次数</div>
              <div class="text-white font-medium">{{ relatedTask.retryCount }}</div>
            </div>
            <div class="bg-slate-dark/50 rounded-xl p-4">
              <div class="text-sm text-slate-light mb-1">状态</div>
              <StatusBadge
                :status="relatedTask.status === 'queued' ? 'pending' : relatedTask.status === 'processing' ? 'resolving' : relatedTask.status"
                type="conflict"
                size="sm"
              />
            </div>
          </div>

          <div v-if="relatedTask.status === 'processing'" class="mb-4">
            <div class="flex items-center justify-between text-sm mb-2">
              <span class="text-slate-light">{{ relatedTask.currentStep }}</span>
              <span class="text-white font-medium">{{ relatedTask.progress }}%</span>
            </div>
            <ProgressBar :value="relatedTask.progress" color="purple" animated />
          </div>

          <div v-if="relatedTask.error" class="bg-danger-red/10 border border-danger-red/30 rounded-xl p-4">
            <div class="text-sm text-danger-red">{{ relatedTask.error }}</div>
          </div>
        </div>

        <div v-if="conflict.resolutionStrategy" class="glass-card p-6">
          <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap class="w-5 h-5 text-neon-purple" />
            解析策略
          </h3>

          <div class="bg-slate-dark/50 rounded-xl p-4 mb-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <div class="text-white font-medium">{{ conflict.resolutionStrategy.name }}</div>
                <div class="text-sm text-slate-light mt-0.5">{{ conflict.resolutionStrategy.description }}</div>
              </div>
              <span class="px-3 py-1 bg-neon-purple/20 text-neon-purple rounded-lg text-sm">
                {{ getStrategyTypeText(conflict.resolutionStrategy.type) }}
              </span>
            </div>
            <div class="flex items-center gap-4 text-sm">
              <div class="flex items-center gap-2">
                <span class="text-slate-light">优先级:</span>
                <span class="text-white">{{ conflict.resolutionStrategy.priority }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-slate-light">超时:</span>
                <span class="text-white">{{ conflict.resolutionStrategy.timeout }}s</span>
              </div>
            </div>
          </div>

          <div>
            <div class="text-sm text-slate-light mb-3">执行动作</div>
            <div class="space-y-2">
              <div
                v-for="action in conflict.resolutionStrategy.actions"
                :key="action.id"
                class="flex items-center gap-3 bg-slate-dark/30 rounded-lg p-3"
              >
                <div
                  :class="[
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    action.status === 'completed' ? 'bg-success-green/20' :
                    action.status === 'executing' ? 'bg-neon-purple/20' :
                    action.status === 'failed' ? 'bg-danger-red/20' : 'bg-slate-dark/50'
                  ]"
                >
                  <CheckCircle v-if="action.status === 'completed'" class="w-4 h-4 text-success-green" />
                  <Play v-else-if="action.status === 'executing'" class="w-4 h-4 text-neon-purple animate-pulse" />
                  <XCircle v-else-if="action.status === 'failed'" class="w-4 h-4 text-danger-red" />
                  <Clock v-else class="w-4 h-4 text-slate-light" />
                </div>
                <div class="flex-1">
                  <div class="text-sm text-white">{{ action.actionType }} - {{ getDeviceName(action.deviceId) }}</div>
                  <div class="text-xs text-slate-light mt-0.5">
                    参数: {{ JSON.stringify(action.parameters) }}
                  </div>
                </div>
                <div class="text-xs text-slate-light">
                  {{ action.status === 'completed' ? formatTime(action.executedAt!) : getStatusText(action.status as any) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="conflict.resolutionHistory.length > 0" class="glass-card p-6">
          <button
            @click="showResolutionHistory = !showResolutionHistory"
            class="w-full flex items-center justify-between text-lg font-semibold text-white mb-4"
          >
            <span class="flex items-center gap-2">
              <History class="w-5 h-5 text-neon-purple" />
              解析历史 ({{ conflict.resolutionHistory.length }} 条)
            </span>
            <component :is="showResolutionHistory ? ChevronUp : ChevronDown" class="w-5 h-5 text-slate-light" />
          </button>

          <div v-if="showResolutionHistory" class="space-y-4">
            <div
              v-for="(step, index) in conflict.resolutionHistory"
              :key="step.id"
              class="relative pl-8 pb-4 last:pb-0"
            >
              <div
                v-if="index < conflict.resolutionHistory.length - 1"
                class="absolute left-3 top-6 bottom-0 w-0.5 bg-slate-dark"
              ></div>
              <div class="absolute left-0 top-1 w-6 h-6 rounded-full bg-neon-purple/20 border-2 border-neon-purple flex items-center justify-center">
                <span class="text-xs text-neon-purple font-medium">{{ index + 1 }}</span>
              </div>
              <div class="bg-slate-dark/50 rounded-xl p-4">
                <div class="flex items-start justify-between mb-2">
                  <div class="text-white font-medium">{{ step.action }}</div>
                  <div class="text-xs text-slate-light">{{ formatDateTime(step.timestamp) }}</div>
                </div>
                <div class="text-sm text-slate-light mb-2">{{ step.result }}</div>
                <div class="flex items-center gap-2 text-xs">
                  <User class="w-3 h-3 text-slate-light" />
                  <span class="text-slate-light">操作员: {{ step.operator }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="glass-card p-6">
          <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield class="w-5 h-5 text-cyber-teal" />
            安防系统视角
          </h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-slate-light">布防状态</span>
              <span :class="conflictStore.securityState.armed ? 'text-success-green' : 'text-alert-orange'">
                {{ conflictStore.securityState.armed ? '已布防' : '未布防' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-light">警戒级别</span>
              <span class="text-white">{{ conflictStore.securityState.alertLevel }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-light">门锁状态</span>
              <span :class="conflictStore.securityState.doorsLocked ? 'text-success-green' : 'text-alert-orange'">
                {{ conflictStore.securityState.doorsLocked ? '已锁定' : '未锁定' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-light">摄像头</span>
              <span :class="conflictStore.securityState.camerasActive ? 'text-success-green' : 'text-alert-orange'">
                {{ conflictStore.securityState.camerasActive ? '运行中' : '已停用' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-light">报警触发</span>
              <span :class="conflictStore.securityState.alarmTriggered ? 'text-danger-red animate-pulse' : 'text-success-green'">
                {{ conflictStore.securityState.alarmTriggered ? '已触发' : '正常' }}
              </span>
            </div>
          </div>
        </div>

        <div class="glass-card p-6">
          <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Home class="w-5 h-5 text-alert-orange" />
            智能家居视角
          </h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-slate-light">当前场景</span>
              <span class="text-white">{{ conflictStore.homeControlState.activeScene }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-light">室内温度</span>
              <span class="text-white">{{ conflictStore.homeControlState.temperature }}°C</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-light">空调状态</span>
              <span :class="conflictStore.homeControlState.acOn ? 'text-cyber-teal' : 'text-slate-light'">
                {{ conflictStore.homeControlState.acOn ? '运行中' : '已关闭' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-light">照明状态</span>
              <span :class="conflictStore.homeControlState.lightsOn ? 'text-alert-orange' : 'text-slate-light'">
                {{ conflictStore.homeControlState.lightsOn ? '已开启' : '已关闭' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-light">窗帘状态</span>
              <span class="text-white">{{ conflictStore.homeControlState.curtainsOpen ? '已打开' : '已关闭' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-light">音乐播放</span>
              <span :class="conflictStore.homeControlState.musicPlaying ? 'text-neon-purple' : 'text-slate-light'">
                {{ conflictStore.homeControlState.musicPlaying ? '播放中' : '已停止' }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="canResolve" class="glass-card p-6">
          <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings class="w-5 h-5 text-neon-purple" />
            选择解析策略
          </h3>
          <div class="space-y-3">
            <label
              v-for="strategy in conflictStore.strategies"
              :key="strategy.id"
              :class="[
                'flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border',
                selectedStrategy === strategy.type
                  ? 'bg-neon-purple/20 border-neon-purple/50'
                  : 'bg-slate-dark/30 border-transparent hover:border-neon-purple/30'
              ]"
            >
              <input
                type="radio"
                :value="strategy.type"
                v-model="selectedStrategy"
                class="mt-1 text-neon-purple"
              />
              <div class="flex-1">
                <div class="text-white font-medium">{{ strategy.name }}</div>
                <div class="text-sm text-slate-light mt-1">{{ strategy.description }}</div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="flex items-center justify-center min-h-96">
    <div class="text-center">
      <AlertCircle class="w-16 h-16 text-slate-light mx-auto mb-4" />
      <h2 class="text-xl font-semibold text-white mb-2">未找到冲突记录</h2>
      <p class="text-slate-light mb-4">该冲突可能已被删除或不存在</p>
      <button @click="goBack" class="btn-primary">
        <ArrowLeft class="w-4 h-4 mr-2" />
        返回冲突列表
      </button>
    </div>
  </div>
</template>
