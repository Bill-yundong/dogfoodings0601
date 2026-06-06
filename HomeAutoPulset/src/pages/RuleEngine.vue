<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Settings2,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Shield,
  Home,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  Gauge,
  List,
  Play,
  XCircle,
  Eye,
} from 'lucide-vue-next';
import { useConflictStore } from '@/stores/conflictStore';
import { useDeviceStore } from '@/stores/deviceStore';
import StatusBadge from '@/components/common/StatusBadge.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { formatDateTime } from '@/utils/dateUtils';
import { getStrategyTypeText, getConflictTypeText, getActionTypeText } from '@/utils/conflictUtils';
import type { ResolutionStrategy, ResolutionAction, StrategyType, ActionType } from '@/types/conflict';

const conflictStore = useConflictStore();
const deviceStore = useDeviceStore();

const showAddStrategy = ref(false);
const showAddAction = ref(false);
const expandedStrategyId = ref<string | null>(null);
const selectedStrategyType = ref<StrategyType | 'all'>('security_first');
const editingStrategy = ref<ResolutionStrategy | null>(null);

const newStrategy = ref<Partial<ResolutionStrategy>>({
  name: '',
  description: '',
  priority: 1,
  type: 'security_first',
  timeout: 30,
  actions: [],
});

const formData = ref<Partial<ResolutionStrategy>>({ ...newStrategy.value });

const actionParametersJson = ref('{}');

const newAction = ref<Partial<ResolutionAction>>({
  deviceId: '',
  actionType: 'set_state',
  parameters: {},
  status: 'pending',
});

const strategyTypes = [
  { value: 'all', label: '全部类型' },
  { value: 'security_first', label: '安防优先' },
  { value: 'comfort_first', label: '舒适优先' },
  { value: 'energy_first', label: '节能优先' },
  { value: 'balanced', label: '平衡策略' },
  { value: 'user_override', label: '用户手动' },
];

const actionTypes = [
  { value: 'set_state', label: '设置状态' },
  { value: 'delay', label: '延迟执行' },
  { value: 'notify', label: '发送通知' },
  { value: 'pause_rule', label: '暂停规则' },
];

const getStrategyColor = (type: StrategyType) => {
  const map: Record<StrategyType, string> = {
    security_first: 'text-cyber-teal',
    comfort_first: 'text-success-green',
    energy_first: 'text-neon-purple',
    balanced: 'text-warning-amber',
    user_override: 'text-alert-orange',
  };
  return map[type];
};

const getStrategyBgColor = (type: StrategyType) => {
  const map: Record<StrategyType, string> = {
    security_first: 'bg-cyber-teal/20 border-cyber-teal/30',
    comfort_first: 'bg-success-green/20 border-success-green/30',
    energy_first: 'bg-neon-purple/20 border-neon-purple/30',
    balanced: 'bg-warning-amber/20 border-warning-amber/30',
    user_override: 'bg-alert-orange/20 border-alert-orange/30',
  };
  return map[type];
};

const filteredStrategies = computed(() => {
  if (selectedStrategyType.value === 'all') {
    return conflictStore.strategies;
  }
  return conflictStore.strategies.filter(s => s.type === selectedStrategyType.value);
});

const getDeviceName = (id: string) => deviceStore.getDeviceById(id)?.name || id;

const addActionToStrategy = () => {
  if (newAction.value.deviceId && newAction.value.actionType) {
    let parameters: Record<string, any> = {};
    try {
      parameters = JSON.parse(actionParametersJson.value);
    } catch (e) {
      console.error('Invalid JSON parameters');
    }

    const action: ResolutionAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deviceId: newAction.value.deviceId,
      actionType: newAction.value.actionType as ActionType,
      parameters,
      status: 'pending',
    };
    
    if (!formData.value.actions) {
      formData.value.actions = [];
    }
    formData.value.actions.push(action);
    
    showAddAction.value = false;
    actionParametersJson.value = '{}';
    newAction.value = {
      deviceId: '',
      actionType: 'set_state',
      parameters: {},
      status: 'pending',
    };
  }
};

const removeActionFromStrategy = (actionId: string) => {
  if (formData.value.actions) {
    const index = formData.value.actions.findIndex(a => a.id === actionId);
    if (index !== -1) {
      formData.value.actions.splice(index, 1);
    }
  }
};

const saveStrategy = () => {
  if (formData.value.name && formData.value.type) {
    if (editingStrategy.value) {
      const updated = { ...editingStrategy.value, ...formData.value };
      conflictStore.updateStrategy(editingStrategy.value.id, updated);
      editingStrategy.value = null;
    } else {
      conflictStore.addStrategy(formData.value as Omit<ResolutionStrategy, 'id'>);
    }
    showAddStrategy.value = false;
    resetForm();
  }
};

const editStrategy = (strategy: ResolutionStrategy) => {
  editingStrategy.value = { ...strategy, actions: [...strategy.actions] };
  formData.value = { ...strategy, actions: [...strategy.actions] };
  showAddStrategy.value = true;
};

const deleteStrategy = (id: string) => {
  if (confirm('确定要删除这个解析策略吗？')) {
    const index = conflictStore.strategies.findIndex(s => s.id === id);
    if (index !== -1) {
      conflictStore.strategies.splice(index, 1);
    }
  }
};

const resetForm = () => {
  newStrategy.value = {
    name: '',
    description: '',
    priority: 1,
    type: 'security_first',
    timeout: 30,
    actions: [],
  };
  formData.value = { ...newStrategy.value };
  editingStrategy.value = null;
};

const cancelEdit = () => {
  showAddStrategy.value = false;
  editingStrategy.value = null;
  resetForm();
};

const getActionIcon = (actionType: ActionType) => {
  const map: Record<ActionType, any> = {
    set_state: Zap,
    delay: Clock,
    notify: AlertTriangle,
    pause_rule: XCircle,
  };
  return map[actionType];
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white flex items-center gap-3">
          <Settings2 class="w-7 h-7 text-neon-purple" />
          规则引擎配置
        </h1>
        <p class="text-slate-light mt-1">
          配置冲突解析策略和自动化规则，优化联动闭环
        </p>
      </div>
      <button
        @click="showAddStrategy = !showAddStrategy; editingStrategy = null; resetForm()"
        class="btn-primary text-sm"
      >
        <Plus class="w-4 h-4 mr-2" />
        添加策略
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div
        v-for="type in strategyTypes"
        :key="type.value"
        @click="selectedStrategyType = type.value as (StrategyType | 'all')"
        :class="[
          'glass-card p-4 cursor-pointer transition-all duration-200',
          selectedStrategyType === type.value
            ? 'border-neon-purple/50 ring-2 ring-neon-purple/20'
            : 'hover:border-neon-purple/30'
        ]"
      >
        <div class="text-sm text-slate-light mb-1">{{ type.label }}</div>
        <div class="text-2xl font-bold text-white">
          {{ type.value === 'all' ? conflictStore.strategies.length : conflictStore.strategies.filter(s => s.type === type.value).length }}
        </div>
      </div>
    </div>

    <div v-if="showAddStrategy" class="glass-card p-6">
      <h3 class="text-lg font-semibold text-white mb-6">
        {{ editingStrategy ? '编辑解析策略' : '添加解析策略' }}
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-sm text-slate-light mb-2">策略名称</label>
          <input
            v-model="formData.name"
            type="text"
            placeholder="例如：夜间入侵安防优先"
            class="input-field w-full"
          />
        </div>
        <div>
          <label class="block text-sm text-slate-light mb-2">策略类型</label>
          <select
            v-model="formData.type"
            class="input-field w-full"
          >
            <option v-for="type in strategyTypes.filter(t => t.value !== 'all')" :key="type.value" :value="type.value">
              {{ type.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-slate-light mb-2">优先级 (1-10)</label>
          <input
            v-model.number="formData.priority"
            type="number"
            min="1"
            max="10"
            class="input-field w-full"
          />
        </div>
        <div>
          <label class="block text-sm text-slate-light mb-2">超时时间 (秒)</label>
          <input
            v-model.number="formData.timeout"
            type="number"
            min="5"
            max="300"
            class="input-field w-full"
          />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm text-slate-light mb-2">策略描述</label>
          <textarea
            v-model="formData.description"
            placeholder="描述这个策略的用途和适用场景..."
            class="input-field w-full h-24 resize-none"
          ></textarea>
        </div>
      </div>

      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="text-sm font-medium text-white">执行动作</div>
          <button
            @click="showAddAction = !showAddAction"
            class="btn-secondary text-xs"
          >
            <Plus class="w-3 h-3 mr-1" />
            添加动作
          </button>
        </div>

        <div v-if="showAddAction" class="bg-slate-dark/50 rounded-xl p-4 mb-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
          <label class="block text-sm text-slate-light mb-2">目标设备</label>
          <select v-model="newAction.deviceId" class="input-field w-full">
            <option value="">选择设备</option>
            <option v-for="device in deviceStore.devices" :key="device.id" :value="device.id">
              {{ device.name }}
            </option>
          </select>
        </div>
            <div>
              <label class="block text-sm text-slate-light mb-2">动作类型</label>
              <select v-model="newAction.actionType" class="input-field w-full">
                <option v-for="action in actionTypes" :key="action.value" :value="action.value">
                  {{ action.label }}
                </option>
              </select>
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm text-slate-light mb-2">参数 (JSON)</label>
              <textarea
                v-model="actionParametersJson"
                placeholder='例如：{"state": "on", "target": "security"}'
                class="input-field w-full h-20 resize-none font-mono text-xs"
              ></textarea>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button @click="showAddAction = false" class="btn-secondary text-xs">
              取消
            </button>
            <button @click="addActionToStrategy" class="btn-primary text-xs">
              <CheckCircle class="w-3 h-3 mr-1" />
              确认添加
            </button>
          </div>
        </div>

        <div v-if="!formData.actions || formData.actions.length === 0" class="text-center py-8 text-slate-light">
          <List class="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div>暂无执行动作</div>
          <div class="text-sm mt-1">点击上方按钮添加动作</div>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="action in formData.actions"
            :key="action.id"
            class="bg-slate-dark/30 rounded-lg p-4 flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-neon-purple/20 flex items-center justify-center">
                <component :is="getActionIcon(action.actionType)" class="w-4 h-4 text-neon-purple" />
              </div>
              <div>
                <div class="text-sm text-white">{{ getActionTypeText(action.actionType) }} - {{ getDeviceName(action.deviceId) }}</div>
                <div class="text-xs text-slate-light mt-0.5 font-mono">
                  {{ JSON.stringify(action.parameters) }}
                </div>
              </div>
            </div>
            <button
              @click="removeActionFromStrategy(action.id)"
              class="p-1.5 rounded-lg hover:bg-danger-red/20 text-slate-light hover:text-danger-red transition-colors"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3">
        <button @click="cancelEdit" class="btn-secondary text-sm">
          取消
        </button>
        <button @click="saveStrategy" class="btn-primary text-sm">
          <CheckCircle class="w-4 h-4 mr-2" />
          {{ editingStrategy ? '保存修改' : '创建策略' }}
        </button>
      </div>
    </div>

    <div v-if="filteredStrategies.length === 0">
      <EmptyState
        title="暂无解析策略"
        description="添加解析策略来定义冲突发生时的处理规则"
        :icon="Settings2"
      >
        <template #actions>
          <button @click="showAddStrategy = true" class="btn-primary mt-4">
            <Plus class="w-4 h-4 mr-2" />
            添加第一个策略
          </button>
        </template>
      </EmptyState>
    </div>

    <div v-else class="space-y-4">
      <div class="flex items-center justify-between text-sm text-slate-light">
        <span>共 {{ filteredStrategies.length }} 条策略</span>
      </div>

      <div
        v-for="strategy in filteredStrategies"
        :key="strategy.id"
        class="glass-card p-5 hover:border-neon-purple/50 transition-all duration-200"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <div
              :class="['w-12 h-12 rounded-xl flex items-center justify-center border', getStrategyBgColor(strategy.type)]">
              <component
                :is="strategy.type === 'security_first' ? Shield : strategy.type === 'comfort_first' ? Home : Gauge"
                :class="['w-6 h-6', getStrategyColor(strategy.type)]"
              />
            </div>
            <div>
              <div class="flex items-center gap-3 mb-1">
                <h3 class="font-medium text-white">{{ strategy.name }}</h3>
                <span :class="['px-2 py-0.5 rounded text-xs', getStrategyBgColor(strategy.type)]">
                  {{ getStrategyTypeText(strategy.type) }}
                </span>
              </div>
              <div v-if="strategy.description" class="text-sm text-slate-light mb-2">
                {{ strategy.description }}
              </div>
              <div class="flex flex-wrap items-center gap-4 text-sm">
                <div class="flex items-center gap-2">
                  <Gauge class="w-4 h-4 text-slate-light" />
                  <span class="text-slate-light">优先级:</span>
                  <span class="text-white font-semibold">{{ strategy.priority }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Clock class="w-4 h-4 text-slate-light" />
                  <span class="text-slate-light">超时:</span>
                  <span class="text-white">{{ strategy.timeout }}s</span>
                </div>
                <div class="flex items-center gap-2">
                  <List class="w-4 h-4 text-slate-light" />
                  <span class="text-slate-light">动作:</span>
                  <span class="text-white">{{ strategy.actions.length }} 个</span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="expandedStrategyId = expandedStrategyId === strategy.id ? null : strategy.id"
              class="p-2 rounded-lg hover:bg-slate-dark/50 transition-colors"
            >
              <component
                :is="expandedStrategyId === strategy.id ? ChevronUp : ChevronDown"
                class="w-5 h-5 text-slate-light"
              />
            </button>
            <button
              @click="editStrategy(strategy)"
              class="p-2 rounded-lg hover:bg-slate-dark/50 transition-colors text-slate-light hover:text-white"
            >
              <Edit2 class="w-5 h-5" />
            </button>
            <button
              @click="deleteStrategy(strategy.id)"
              class="p-2 rounded-lg hover:bg-danger-red/20 transition-colors text-slate-light hover:text-danger-red"
            >
              <Trash2 class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div v-if="expandedStrategyId === strategy.id" class="mt-4 pt-4 border-t border-slate-dark">
          <div class="text-sm text-slate-light mb-3">执行动作列表</div>
          <div class="space-y-2">
            <div
              v-for="(action, index) in strategy.actions"
              :key="action.id"
              class="bg-slate-dark/50 rounded-lg p-3 flex items-center gap-3"
            >
              <div class="w-8 h-8 rounded-lg bg-neon-purple/20 flex items-center justify-center flex-shrink-0">
                <span class="text-sm text-neon-purple font-medium">{{ index + 1 }}</span>
              </div>
              <div class="flex-1">
                <div class="text-sm text-white">
                  <span class="text-neon-purple">{{ getActionTypeText(action.actionType) }}</span>
                  <span class="text-slate-light mx-2">→</span>
                  <span>{{ getDeviceName(action.deviceId) }}</span>
                </div>
                <div class="text-xs text-slate-light mt-0.5 font-mono">
                  参数: {{ JSON.stringify(action.parameters) }}
                </div>
              </div>
              <StatusBadge :status="action.status" type="conflict" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
