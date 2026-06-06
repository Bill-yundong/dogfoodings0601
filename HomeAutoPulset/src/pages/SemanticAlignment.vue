<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  GitMerge,
  Shield,
  Home,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Zap,
  Clock,
  Activity,
  Settings,
  ArrowRight,
} from 'lucide-vue-next';
import { useSemanticStore } from '@/stores/semanticStore';
import { useDeviceStore } from '@/stores/deviceStore';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ProgressBar from '@/components/common/ProgressBar.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { formatDateTime, getTimeAgo } from '@/utils/dateUtils';
import type { SemanticMapping, Scene, PriorityMode } from '@/types/semantic';

const semanticStore = useSemanticStore();
const deviceStore = useDeviceStore();

const selectedTab = ref<'mappings' | 'scenes' | 'results'>('mappings');
const showAddMapping = ref(false);
const showAddScene = ref(false);
const expandedMappingId = ref<string | null>(null);
const expandedSceneId = ref<string | null>(null);

const newMapping = ref<Partial<SemanticMapping>>({
  sensorType: '',
  securityContext: '',
  homeControlContext: '',
  priority: 'context_aware',
  description: '',
  enabled: true,
  rules: [],
});

const newScene = ref<Partial<Scene>>({
  name: '',
  type: 'home',
  description: '',
  activeConditions: [],
  securitySettings: {},
  homeControlSettings: {},
  conflictHandling: 'context_aware',
  enabled: true,
});

const sensorTypes = [
  { value: 'motion', label: '运动传感器' },
  { value: 'door', label: '门磁传感器' },
  { value: 'window', label: '窗磁传感器' },
  { value: 'temperature', label: '温度传感器' },
  { value: 'humidity', label: '湿度传感器' },
  { value: 'light', label: '光照传感器' },
  { value: 'smoke', label: '烟雾传感器' },
  { value: 'gas', label: '燃气传感器' },
  { value: 'water', label: '水浸传感器' },
  { value: 'lock', label: '门锁传感器' },
];

const priorityModes = [
  { value: 'security', label: '安防优先' },
  { value: 'homeControl', label: '舒适优先' },
  { value: 'context_aware', label: '上下文感知' },
];

const sceneTypes = [
  { value: 'home', label: '在家模式' },
  { value: 'away', label: '离家模式' },
  { value: 'sleep', label: '睡眠模式' },
  { value: 'security', label: '安防模式' },
  { value: 'movie', label: '影院模式' },
  { value: 'dinner', label: '用餐模式' },
  { value: 'morning', label: '晨起模式' },
  { value: 'evening', label: '晚间模式' },
];

const getPriorityText = (mode: PriorityMode) => {
  const map: Record<PriorityMode, string> = {
    security: '安防优先',
    homeControl: '舒适优先',
    context_aware: '上下文感知',
  };
  return map[mode];
};

const getSceneTypeText = (type: string) => {
  const found = sceneTypes.find(s => s.value === type);
  return found?.label || type;
};

const toggleMapping = (mapping: SemanticMapping) => {
  semanticStore.updateMapping(mapping.id, { enabled: !mapping.enabled });
};

const toggleScene = (scene: Scene) => {
  semanticStore.updateScene(scene.id, { enabled: !scene.enabled });
};

const deleteMapping = (id: string) => {
  if (confirm('确定要删除这个语义映射吗？')) {
    semanticStore.deleteMapping(id);
  }
};

const addMapping = () => {
  if (newMapping.value.sensorType && newMapping.value.securityContext && newMapping.value.homeControlContext) {
    semanticStore.addMapping(newMapping.value as SemanticMapping);
    showAddMapping.value = false;
    newMapping.value = {
      sensorType: '',
      securityContext: '',
      homeControlContext: '',
      priority: 'context_aware',
      description: '',
      enabled: true,
      rules: [],
    };
  }
};

const addScene = () => {
  if (newScene.value.name && newScene.value.type) {
    semanticStore.addScene(newScene.value as Scene);
    showAddScene.value = false;
    newScene.value = {
      name: '',
      type: 'home',
      description: '',
      activeConditions: [],
      securitySettings: {},
      homeControlSettings: {},
      conflictHandling: 'context_aware',
      enabled: true,
    };
  }
};

const switchToScene = (scene: Scene) => {
  semanticStore.switchScene(scene.id);
};

const getDeviceName = (id: string) => deviceStore.getDeviceById(id)?.name || id;

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'text-success-green';
  if (confidence >= 0.5) return 'text-alert-orange';
  return 'text-danger-red';
};

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('zh-CN');

onMounted(() => {
  // 初始化时生成一些测试对齐结果
  if (semanticStore.alignmentResults.length === 0) {
    const devices = deviceStore.devices.slice(0, 5);
    devices.forEach((device, index) => {
      const sensorTypes: Array<'motion' | 'temperature' | 'light' | 'door' | 'humidity'> = ['motion', 'temperature', 'light', 'door', 'humidity'];
      semanticStore.processSensorData({
        id: `sensor_data_${Date.now()}_${index}`,
        deviceId: device.id,
        sensorType: sensorTypes[index],
        value: Math.random() * 100,
        unit: index % 2 === 0 ? '°C' : '%',
        timestamp: Date.now() - index * 30000,
        location: device.location,
        semanticTags: [],
      });
    });
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white flex items-center gap-3">
          <GitMerge class="w-7 h-7 text-neon-purple" />
          语义对齐配置
        </h1>
        <p class="text-slate-light mt-1">
          配置传感器数据在安防系统与智能家居控制中心间的语义映射规则
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right">
          <div class="text-sm text-slate-light">活跃映射</div>
          <div class="text-xl font-bold text-white">{{ semanticStore.enabledMappings.length }}</div>
        </div>
        <div class="text-right">
          <div class="text-sm text-slate-light">活跃场景</div>
          <div class="text-xl font-bold text-white">{{ semanticStore.enabledScenes.length }}</div>
        </div>
      </div>
    </div>

    <div class="flex gap-2">
      <button
        @click="selectedTab = 'mappings'"
        :class="[
          'px-6 py-2 rounded-lg font-medium transition-all duration-200',
          selectedTab === 'mappings'
            ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
            : 'text-slate-light hover:text-white hover:bg-midnight/50'
        ]"
      >
        <span class="flex items-center gap-2">
          <GitMerge class="w-4 h-4" />
          语义映射
        </span>
      </button>
      <button
        @click="selectedTab = 'scenes'"
        :class="[
          'px-6 py-2 rounded-lg font-medium transition-all duration-200',
          selectedTab === 'scenes'
            ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
            : 'text-slate-light hover:text-white hover:bg-midnight/50'
        ]"
      >
        <span class="flex items-center gap-2">
          <Home class="w-4 h-4" />
          场景管理
        </span>
      </button>
      <button
        @click="selectedTab = 'results'"
        :class="[
          'px-6 py-2 rounded-lg font-medium transition-all duration-200',
          selectedTab === 'results'
            ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
            : 'text-slate-light hover:text-white hover:bg-midnight/50'
        ]"
      >
        <span class="flex items-center gap-2">
          <Activity class="w-4 h-4" />
          对齐结果
          <span class="px-2 py-0.5 text-xs rounded-full bg-slate-mid/30">
            {{ semanticStore.alignmentResults.length }}
          </span>
        </span>
      </button>
    </div>

    <div v-if="selectedTab === 'mappings'" class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-sm text-slate-light">
          共 {{ semanticStore.mappings.length }} 个映射规则
        </div>
        <button
          @click="showAddMapping = !showAddMapping"
          class="btn-primary text-sm"
        >
          <Plus class="w-4 h-4 mr-2" />
          添加映射
        </button>
      </div>

      <div v-if="showAddMapping" class="glass-card p-6">
        <h3 class="text-lg font-semibold text-white mb-4">添加语义映射</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm text-slate-light mb-2">传感器类型</label>
            <select v-model="newMapping.sensorType" class="input-field w-full">
              <option value="">请选择传感器类型</option>
              <option v-for="type in sensorTypes" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-slate-light mb-2">优先级模式</label>
            <select v-model="newMapping.priority" class="input-field w-full">
              <option v-for="mode in priorityModes" :key="mode.value" :value="mode.value">
                {{ mode.label }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-slate-light mb-2">安防语义</label>
            <input
              v-model="newMapping.securityContext"
              type="text"
              placeholder="例如：入侵检测"
              class="input-field w-full"
            />
          </div>
          <div>
            <label class="block text-sm text-slate-light mb-2">家居语义</label>
            <input
              v-model="newMapping.homeControlContext"
              type="text"
              placeholder="例如：有人进入"
              class="input-field w-full"
            />
          </div>
        </div>
        <div class="mb-4">
          <label class="block text-sm text-slate-light mb-2">描述</label>
          <textarea
            v-model="newMapping.description"
            placeholder="描述这个语义映射的用途..."
            class="input-field w-full h-24 resize-none"
          ></textarea>
        </div>
        <div class="flex items-center justify-end gap-3">
          <button @click="showAddMapping = false" class="btn-secondary text-sm">
            取消
          </button>
          <button @click="addMapping" class="btn-primary text-sm">
            <CheckCircle class="w-4 h-4 mr-2" />
            确认添加
          </button>
        </div>
      </div>

      <div v-if="semanticStore.mappings.length === 0">
        <EmptyState
          title="暂无语义映射"
          description="添加语义映射规则来定义传感器数据在不同系统间的语义解释"
          :icon="GitMerge"
        >
          <template #actions>
            <button @click="showAddMapping = true" class="btn-primary mt-4">
              <Plus class="w-4 h-4 mr-2" />
              添加第一个映射
            </button>
          </template>
        </EmptyState>
      </div>

      <div
        v-for="mapping in semanticStore.mappings"
        :key="mapping.id"
        class="glass-card p-5 hover:border-neon-purple/50 transition-all duration-200"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl bg-cyber-teal/20 border border-cyber-teal/30 flex items-center justify-center">
              <GitMerge class="w-6 h-6 text-cyber-teal" />
            </div>
            <div>
              <div class="flex items-center gap-3 mb-1">
                <h3 class="font-medium text-white">
                  {{ sensorTypes.find(s => s.value === mapping.sensorType)?.label || mapping.sensorType }}
                </h3>
                <StatusBadge
                  :status="mapping.enabled ? 'online' : 'offline'"
                  type="device"
                  size="sm"
                />
                <span class="px-2 py-0.5 bg-neon-purple/20 text-neon-purple rounded text-xs">
                  {{ getPriorityText(mapping.priority) }}
                </span>
              </div>
              <div v-if="mapping.description" class="text-sm text-slate-light mb-2">
                {{ mapping.description }}
              </div>
              <div class="flex items-center gap-3 text-sm">
                <div class="flex items-center gap-2">
                  <Shield class="w-4 h-4 text-cyber-teal" />
                  <span class="text-slate-light">安防:</span>
                  <span class="text-cyber-teal">{{ mapping.securityContext }}</span>
                </div>
                <ArrowRight class="w-4 h-4 text-slate-mid" />
                <div class="flex items-center gap-2">
                  <Home class="w-4 h-4 text-alert-orange" />
                  <span class="text-slate-light">家居:</span>
                  <span class="text-alert-orange">{{ mapping.homeControlContext }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="toggleMapping(mapping)"
              class="p-2 rounded-lg hover:bg-slate-dark/50 transition-colors"
            >
              <component
                :is="mapping.enabled ? ToggleRight : ToggleLeft"
                :class="['w-5 h-5', mapping.enabled ? 'text-success-green' : 'text-slate-light']"
              />
            </button>
            <button class="p-2 rounded-lg hover:bg-slate-dark/50 transition-colors text-slate-light hover:text-white">
              <Edit2 class="w-5 h-5" />
            </button>
            <button
              @click="deleteMapping(mapping.id)"
              class="p-2 rounded-lg hover:bg-danger-red/20 transition-colors text-slate-light hover:text-danger-red"
            >
              <Trash2 class="w-5 h-5" />
            </button>
            <button
              @click="expandedMappingId = expandedMappingId === mapping.id ? null : mapping.id"
              class="p-2 rounded-lg hover:bg-slate-dark/50 transition-colors"
            >
              <component
                :is="expandedMappingId === mapping.id ? ChevronUp : ChevronDown"
                class="w-5 h-5 text-slate-light"
              />
            </button>
          </div>
        </div>

        <div v-if="expandedMappingId === mapping.id && mapping.rules.length > 0" class="mt-4 pt-4 border-t border-slate-dark">
          <div class="text-sm text-slate-light mb-3">关联规则 ({{ mapping.rules.length }})</div>
          <div class="space-y-2">
            <div
              v-for="rule in mapping.rules"
              :key="rule.id"
              class="bg-slate-dark/50 rounded-lg p-3"
            >
              <div class="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div class="text-slate-light mb-1">触发条件</div>
                  <div class="text-white">{{ rule.condition }}</div>
                </div>
                <div>
                  <div class="text-slate-light mb-1">安防动作</div>
                  <div class="text-cyber-teal">{{ rule.securityAction }}</div>
                </div>
                <div>
                  <div class="text-slate-light mb-1">家居动作</div>
                  <div class="text-alert-orange">{{ rule.homeControlAction }}</div>
                </div>
              </div>
              <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-dark/50">
                <div class="text-xs text-slate-light">
                  冲突解决: {{ rule.conflictResolution }} | 权重: {{ rule.weight }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedTab === 'scenes'" class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-sm text-slate-light">
          共 {{ semanticStore.scenes.length }} 个场景
        </div>
        <button
          @click="showAddScene = !showAddScene"
          class="btn-primary text-sm"
        >
          <Plus class="w-4 h-4 mr-2" />
          添加场景
        </button>
      </div>

      <div v-if="showAddScene" class="glass-card p-6">
        <h3 class="text-lg font-semibold text-white mb-4">添加场景</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm text-slate-light mb-2">场景名称</label>
            <input
              v-model="newScene.name"
              type="text"
              placeholder="例如：影音模式"
              class="input-field w-full"
            />
          </div>
          <div>
            <label class="block text-sm text-slate-light mb-2">场景类型</label>
            <select v-model="newScene.type" class="input-field w-full">
              <option v-for="type in sceneTypes" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm text-slate-light mb-2">冲突处理策略</label>
            <select v-model="newScene.conflictHandling" class="input-field w-full">
              <option v-for="mode in priorityModes" :key="mode.value" :value="mode.value">
                {{ mode.label }}
              </option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm text-slate-light mb-2">描述</label>
            <textarea
              v-model="newScene.description"
              placeholder="描述这个场景的用途..."
              class="input-field w-full h-24 resize-none"
            ></textarea>
          </div>
        </div>
        <div class="flex items-center justify-end gap-3">
          <button @click="showAddScene = false" class="btn-secondary text-sm">
            取消
          </button>
          <button @click="addScene" class="btn-primary text-sm">
            <CheckCircle class="w-4 h-4 mr-2" />
            确认添加
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="scene in semanticStore.scenes"
          :key="scene.id"
          :class="[
            'glass-card p-5 hover:border-neon-purple/50 transition-all duration-200',
            semanticStore.activeScene?.id === scene.id ? 'border-neon-purple/50 ring-2 ring-neon-purple/20' : ''
          ]"
        >
          <div class="flex items-start justify-between mb-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h3 class="font-medium text-white">{{ scene.name }}</h3>
                <span class="px-2 py-0.5 bg-slate-mid/30 text-slate-light rounded text-xs">
                  {{ getSceneTypeText(scene.type) }}
                </span>
              </div>
              <div class="text-sm text-slate-light">{{ scene.description }}</div>
            </div>
            <button
              @click="toggleScene(scene)"
              class="p-1.5 rounded-lg hover:bg-slate-dark/50 transition-colors"
            >
              <component
                :is="scene.enabled ? ToggleRight : ToggleLeft"
                :class="['w-5 h-5', scene.enabled ? 'text-success-green' : 'text-slate-light']"
              />
            </button>
          </div>

          <div class="space-y-2 mb-4 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-slate-light">冲突处理</span>
              <span class="text-neon-purple">{{ getPriorityText(scene.conflictHandling) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-light">触发条件</span>
              <span class="text-white">{{ scene.activeConditions.length }} 个</span>
            </div>
          </div>

          <div v-if="expandedSceneId === scene.id" class="mb-4 pt-4 border-t border-slate-dark">
            <div class="text-sm text-slate-light mb-2">安防设置</div>
            <div class="bg-slate-dark/50 rounded-lg p-3 mb-3">
              <pre class="text-xs text-cyber-teal font-mono">{{ JSON.stringify(scene.securitySettings, null, 2) }}</pre>
            </div>
            <div class="text-sm text-slate-light mb-2">家居设置</div>
            <div class="bg-slate-dark/50 rounded-lg p-3">
              <pre class="text-xs text-alert-orange font-mono">{{ JSON.stringify(scene.homeControlSettings, null, 2) }}</pre>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <button
              @click="expandedSceneId = expandedSceneId === scene.id ? null : scene.id"
              class="text-xs text-slate-light hover:text-white flex items-center gap-1"
            >
              <component :is="expandedSceneId === scene.id ? ChevronUp : ChevronDown" class="w-3 h-3" />
              {{ expandedSceneId === scene.id ? '收起详情' : '查看详情' }}
            </button>
            <button
              v-if="semanticStore.activeScene?.id !== scene.id"
              @click="switchToScene(scene)"
              class="btn-primary text-xs px-3 py-1.5"
            >
              <Zap class="w-3 h-3 mr-1" />
              激活场景
            </button>
            <span
              v-else
              class="text-xs text-success-green flex items-center gap-1"
            >
              <CheckCircle class="w-3 h-3" />
              当前场景
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedTab === 'results'" class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-sm text-slate-light">
          最近 {{ semanticStore.alignmentResults.length }} 条对齐结果
        </div>
      </div>

      <div v-if="semanticStore.alignmentResults.length === 0">
        <EmptyState
          title="暂无对齐结果"
          description="当传感器数据到来时，系统会自动进行语义对齐并显示结果"
          :icon="Activity"
        />
      </div>

      <div
        v-for="result in semanticStore.alignmentResults"
        :key="result.sensorId + result.timestamp"
        class="glass-card p-5"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-start gap-4">
            <div
              :class="[
                'w-12 h-12 rounded-xl flex items-center justify-center',
                result.conflictPotential > 0.7 ? 'bg-danger-red/20 border border-danger-red/30' :
                result.conflictPotential > 0.4 ? 'bg-alert-orange/20 border border-alert-orange/30' :
                'bg-success-green/20 border border-success-green/30'
              ]"
            >
              <component
                :is="result.conflictPotential > 0.7 ? AlertTriangle : result.conflictPotential > 0.4 ? AlertTriangle : CheckCircle"
                :class="[
                  'w-6 h-6',
                  result.conflictPotential > 0.7 ? 'text-danger-red' :
                  result.conflictPotential > 0.4 ? 'text-alert-orange' : 'text-success-green'
                ]"
              />
            </div>
            <div>
              <div class="flex items-center gap-3 mb-1">
                <h3 class="font-medium text-white">
                  {{ getDeviceName(result.sensorId) }}
                </h3>
                <span class="text-sm text-slate-light">
                  {{ sensorTypes.find(s => s.value === result.sensorId.split('_').pop())?.label || '传感器' }}
                </span>
              </div>
              <div class="flex items-center gap-4 text-sm">
                <div class="flex items-center gap-2">
                  <Clock class="w-4 h-4 text-slate-light" />
                  <span class="text-slate-light">{{ formatDateTime(result.timestamp) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Activity class="w-4 h-4 text-slate-light" />
                  <span class="text-slate-light">对齐值:</span>
                  <span class="text-white font-mono">{{ result.alignedValue.toFixed(2) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Home class="w-4 h-4 text-slate-light" />
                  <span class="text-slate-light">场景:</span>
                  <span class="text-neon-purple">{{ result.activeScene }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm text-slate-light mb-1">冲突可能性</div>
            <div :class="['text-xl font-bold', getConfidenceColor(1 - result.conflictPotential)]">
              {{ (result.conflictPotential * 100).toFixed(0) }}%
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="bg-slate-dark/50 rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <Shield class="w-4 h-4 text-cyber-teal" />
              <span class="text-sm text-cyber-teal font-medium">安防系统标签</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="tag in result.securityTags"
                :key="tag"
                class="px-2 py-1 bg-cyber-teal/10 border border-cyber-teal/30 rounded text-cyber-teal text-xs"
              >
                {{ tag }}
              </span>
            </div>
          </div>
          <div class="bg-slate-dark/50 rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <Home class="w-4 h-4 text-alert-orange" />
              <span class="text-sm text-alert-orange font-medium">智能家居标签</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="tag in result.homeControlTags"
                :key="tag"
                class="px-2 py-1 bg-alert-orange/10 border border-alert-orange/30 rounded text-alert-orange text-xs"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="result.recommendations.length > 0" class="bg-neon-purple/10 border border-neon-purple/30 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <Zap class="w-4 h-4 text-neon-purple" />
            <span class="text-sm text-neon-purple font-medium">系统建议</span>
          </div>
          <ul class="space-y-1">
            <li
              v-for="(rec, index) in result.recommendations"
              :key="index"
              class="text-sm text-white flex items-start gap-2"
            >
              <span class="text-neon-purple mt-0.5">•</span>
              {{ rec }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
