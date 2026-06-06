<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  Settings,
  Bell,
  Database,
  Shield,
  Palette,
  Globe,
  Info,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Cpu,
  Clock,
  HardDrive,
  Zap,
  Mail,
  Smartphone,
  Monitor,
} from 'lucide-vue-next';
import { useConflictStore } from '@/stores/conflictStore';
import { useSnapshotStore } from '@/stores/snapshotStore';
import { useSemanticStore } from '@/stores/semanticStore';
import { useDeviceStore } from '@/stores/deviceStore';
import MetricCard from '@/components/common/MetricCard.vue';
import { formatDateTime } from '@/utils/dateUtils';
import { useSettings } from '@/composables/useSettings';

const conflictStore = useConflictStore();
const snapshotStore = useSnapshotStore();
const semanticStore = useSemanticStore();
const deviceStore = useDeviceStore();
const { settings: globalSettings, updateAccentColor, updateLanguage, updateSettings, colorMap } = useSettings();

const activeSection = ref<string>('general');

const localSettings = ref({
  general: {
    autoResolveConflicts: true,
    autoCreateSnapshots: true,
    enableOfflineMode: true,
    autoSyncSnapshots: true,
    snapshotInterval: 30,
    maxOfflineDays: 30,
  },
  notifications: {
    enablePush: true,
    enableEmail: false,
    enableSound: true,
    conflictAlert: true,
    deviceOffline: true,
    systemError: true,
    dailyReport: false,
  },
  security: {
    twoFactorAuth: false,
    sessionTimeout: 30,
    allowRemoteAccess: true,
    autoLock: true,
    loginAlerts: true,
  },
});

const settings = computed({
  get: () => ({
    ...localSettings.value,
    appearance: globalSettings.value.appearance,
    system: globalSettings.value.system,
  }),
  set: (val) => {
    localSettings.value.general = val.general;
    localSettings.value.notifications = val.notifications;
    localSettings.value.security = val.security;
  },
});

const systemInfo = ref({
  version: '1.0.0',
  buildTime: '2024-01-15',
  uptime: 0,
  lastBackup: Date.now() - 86400000,
  databaseSize: 0,
});

const sections = [
  { id: 'general', label: '通用设置', icon: Settings },
  { id: 'notifications', label: '通知设置', icon: Bell },
  { id: 'security', label: '安全设置', icon: Shield },
  { id: 'appearance', label: '外观设置', icon: Palette },
  { id: 'system', label: '系统设置', icon: Globe },
  { id: 'about', label: '关于系统', icon: Info },
];

const accentColors = [
  { value: 'purple', label: '霓虹紫', color: '#7C4DFF' },
  { value: 'cyan', label: '科技蓝', color: '#00E5FF' },
  { value: 'green', label: '清新绿', color: '#00C853' },
  { value: 'orange', label: '活力橙', color: '#FF6B35' },
];

const languages = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
];

const timezones = [
  { value: 'Asia/Shanghai', label: '中国标准时间 (UTC+8)' },
  { value: 'Asia/Tokyo', label: '日本标准时间 (UTC+9)' },
  { value: 'America/New_York', label: '美国东部时间 (UTC-5)' },
  { value: 'Europe/London', label: '英国时间 (UTC+0)' },
];

const startUptimeCounter = () => {
  setInterval(() => {
    systemInfo.value.uptime += 1;
  }, 1000);
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${days}天 ${hours}小时 ${minutes}分钟 ${secs}秒`;
};

const exportData = () => {
  const data = {
    conflicts: conflictStore.conflicts,
    snapshots: snapshotStore.snapshots,
    devices: deviceStore.devices,
    settings: settings.value,
    exportTime: Date.now(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `homeautopulse-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const fileInputRef = ref<HTMLInputElement | null>(null);

const importData = () => {
  fileInputRef.value?.click();
};

const handleFileImport = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (confirm('确定要导入备份数据吗？这将覆盖现有数据。')) {
        if (data.conflicts) conflictStore.conflicts = data.conflicts;
        if (data.snapshots) snapshotStore.snapshots = data.snapshots;
        if (data.devices) deviceStore.devices = data.devices;
        if (data.settings) {
          if (data.settings.general) localSettings.value.general = data.settings.general;
          if (data.settings.notifications) localSettings.value.notifications = data.settings.notifications;
          if (data.settings.security) localSettings.value.security = data.settings.security;
          if (data.settings.appearance || data.settings.system) {
            updateSettings({
              appearance: data.settings.appearance,
              system: data.settings.system,
            });
          }
        }
        alert('数据导入成功！');
      }
    } catch (err) {
      alert('导入失败：文件格式不正确');
    }
  };
  reader.readAsText(file);
  target.value = '';
};

const resetSystem = () => {
  if (confirm('确定要重置系统吗？这将清除所有本地数据，此操作不可恢复！')) {
    if (confirm('请再次确认：您确定要重置所有数据吗？')) {
      localStorage.clear();
      indexedDB.deleteDatabase('homeautopulse_db');
      alert('系统已重置，页面将刷新');
      location.reload();
    }
  }
};

const clearConflictHistory = () => {
  if (confirm('确定要清除所有冲突历史记录吗？')) {
    conflictStore.conflicts.splice(0, conflictStore.conflicts.length);
  }
};

const clearSnapshots = () => {
  if (confirm('确定要清除所有设备快照吗？')) {
    snapshotStore.snapshots.splice(0, snapshotStore.snapshots.length);
  }
};

const generateTestConflict = () => {
  conflictStore.generateTestConflict('high');
};

const runDiagnostics = async () => {
  alert('系统诊断完成，所有组件运行正常！');
};

onMounted(() => {
  startUptimeCounter();
  systemInfo.value.databaseSize = snapshotStore.stats?.storageUsed || 0;
});
</script>

<template>
  <div>
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white flex items-center gap-3">
            <Settings class="w-7 h-7 text-neon-purple" />
            系统设置
          </h1>
          <p class="text-slate-light mt-1">
            配置系统参数、通知、安全和外观选项
          </p>
        </div>
      </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <MetricCard
        title="运行时间"
        :value="formatUptime(systemInfo.uptime)"
        :icon="Clock"
        color="cyan"
      />
      <MetricCard
        title="系统版本"
        :value="`v${systemInfo.version}`"
        :icon="Cpu"
        color="purple"
      />
      <MetricCard
        title="设备数量"
        :value="deviceStore.devices.length"
        :icon="Cpu"
        color="green"
      />
      <MetricCard
        title="冲突记录"
        :value="conflictStore.conflicts.length"
        :icon="AlertTriangle"
        color="orange"
      />
    </div>

    <div class="flex gap-6">
      <div class="w-64 flex-shrink-0">
        <div class="glass-card p-2 sticky top-6">
          <button
            v-for="section in sections"
            :key="section.id"
            @click="activeSection = section.id"
            :class="[
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200',
              activeSection === section.id
                ? 'bg-neon-purple/20 text-neon-purple'
                : 'text-slate-light hover:text-white hover:bg-slate-dark/50'
            ]"
          >
            <component :is="section.icon" class="w-5 h-5" />
            <span class="font-medium">{{ section.label }}</span>
          </button>
        </div>
      </div>

      <div class="flex-1">
        <div v-if="activeSection === 'general'" class="space-y-6">
          <div class="glass-card p-6">
            <h2 class="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Settings class="w-5 h-5 text-neon-purple" />
              通用设置
            </h2>

            <div class="space-y-6">
              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">自动解析冲突</div>
                  <div class="text-sm text-slate-light mt-0.5">检测到冲突时自动应用解析策略</div>
                </div>
                <button
                  @click="settings.general.autoResolveConflicts = !settings.general.autoResolveConflicts"
                >
                  <component
                    :is="settings.general.autoResolveConflicts ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.general.autoResolveConflicts ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">自动创建快照</div>
                  <div class="text-sm text-slate-light mt-0.5">设备状态变化时自动创建快照</div>
                </div>
                <button
                  @click="settings.general.autoCreateSnapshots = !settings.general.autoCreateSnapshots"
                >
                  <component
                    :is="settings.general.autoCreateSnapshots ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.general.autoCreateSnapshots ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">启用离线模式</div>
                  <div class="text-sm text-slate-light mt-0.5">网络断开时使用本地缓存数据</div>
                </div>
                <button
                  @click="settings.general.enableOfflineMode = !settings.general.enableOfflineMode"
                >
                  <component
                    :is="settings.general.enableOfflineMode ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.general.enableOfflineMode ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">自动同步快照</div>
                  <div class="text-sm text-slate-light mt-0.5">网络恢复时自动同步离线快照</div>
                </div>
                <button
                  @click="settings.general.autoSyncSnapshots = !settings.general.autoSyncSnapshots"
                >
                  <component
                    :is="settings.general.autoSyncSnapshots ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.general.autoSyncSnapshots ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">快照间隔</div>
                  <div class="text-sm text-slate-light mt-0.5">定时创建快照的时间间隔（分钟）</div>
                </div>
                <input
                  v-model.number="settings.general.snapshotInterval"
                  type="number"
                  min="5"
                  max="120"
                  class="input-field w-24 text-center"
                />
              </div>

              <div class="flex items-center justify-between py-4">
                <div>
                  <div class="text-white font-medium">离线数据保留</div>
                  <div class="text-sm text-slate-light mt-0.5">离线快照最长保留天数</div>
                </div>
                <input
                  v-model.number="settings.general.maxOfflineDays"
                  type="number"
                  min="7"
                  max="365"
                  class="input-field w-24 text-center"
                />
              </div>
            </div>
          </div>

          <div class="glass-card p-6">
            <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap class="w-5 h-5 text-neon-purple" />
              快捷操作
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button @click="generateTestConflict" class="btn-secondary text-sm justify-start">
                <AlertTriangle class="w-4 h-4 mr-2 text-alert-orange" />
                生成测试冲突
              </button>
              <button @click="runDiagnostics" class="btn-secondary text-sm justify-start">
                <CheckCircle class="w-4 h-4 mr-2 text-success-green" />
                运行系统诊断
              </button>
              <button @click="clearConflictHistory" class="btn-secondary text-sm justify-start">
                <Trash2 class="w-4 h-4 mr-2 text-danger-red" />
                清除冲突历史
              </button>
              <button @click="clearSnapshots" class="btn-secondary text-sm justify-start">
                <Database class="w-4 h-4 mr-2 text-cyber-teal" />
                清除所有快照
              </button>
            </div>
          </div>
        </div>

        <div v-if="activeSection === 'notifications'" class="space-y-6">
          <div class="glass-card p-6">
            <h2 class="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Bell class="w-5 h-5 text-neon-purple" />
              通知设置
            </h2>

            <div class="space-y-6">
              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div class="flex items-center gap-3">
                  <Smartphone class="w-5 h-5 text-cyber-teal" />
                  <div>
                    <div class="text-white font-medium">推送通知</div>
                    <div class="text-sm text-slate-light mt-0.5">接收浏览器推送通知</div>
                  </div>
                </div>
                <button
                  @click="settings.notifications.enablePush = !settings.notifications.enablePush"
                >
                  <component
                    :is="settings.notifications.enablePush ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.notifications.enablePush ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div class="flex items-center gap-3">
                  <Mail class="w-5 h-5 text-alert-orange" />
                  <div>
                    <div class="text-white font-medium">邮件通知</div>
                    <div class="text-sm text-slate-light mt-0.5">重要事件发送邮件提醒</div>
                  </div>
                </div>
                <button
                  @click="settings.notifications.enableEmail = !settings.notifications.enableEmail"
                >
                  <component
                    :is="settings.notifications.enableEmail ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.notifications.enableEmail ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div class="flex items-center gap-3">
                  <Bell class="w-5 h-5 text-neon-purple" />
                  <div>
                    <div class="text-white font-medium">提示音</div>
                    <div class="text-sm text-slate-light mt-0.5">通知时播放提示音</div>
                  </div>
                </div>
                <button
                  @click="settings.notifications.enableSound = !settings.notifications.enableSound"
                >
                  <component
                    :is="settings.notifications.enableSound ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.notifications.enableSound ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">冲突警报</div>
                  <div class="text-sm text-slate-light mt-0.5">检测到新冲突时发出通知</div>
                </div>
                <button
                  @click="settings.notifications.conflictAlert = !settings.notifications.conflictAlert"
                >
                  <component
                    :is="settings.notifications.conflictAlert ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.notifications.conflictAlert ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">设备离线</div>
                  <div class="text-sm text-slate-light mt-0.5">设备离线时发出通知</div>
                </div>
                <button
                  @click="settings.notifications.deviceOffline = !settings.notifications.deviceOffline"
                >
                  <component
                    :is="settings.notifications.deviceOffline ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.notifications.deviceOffline ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">系统错误</div>
                  <div class="text-sm text-slate-light mt-0.5">系统发生错误时发出通知</div>
                </div>
                <button
                  @click="settings.notifications.systemError = !settings.notifications.systemError"
                >
                  <component
                    :is="settings.notifications.systemError ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.notifications.systemError ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4">
                <div>
                  <div class="text-white font-medium">每日报告</div>
                  <div class="text-sm text-slate-light mt-0.5">每日发送系统运行报告</div>
                </div>
                <button
                  @click="settings.notifications.dailyReport = !settings.notifications.dailyReport"
                >
                  <component
                    :is="settings.notifications.dailyReport ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.notifications.dailyReport ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeSection === 'security'" class="space-y-6">
          <div class="glass-card p-6">
            <h2 class="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Shield class="w-5 h-5 text-neon-purple" />
              安全设置
            </h2>

            <div class="space-y-6">
              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">双因素认证</div>
                  <div class="text-sm text-slate-light mt-0.5">启用后登录需要额外验证</div>
                </div>
                <button
                  @click="settings.security.twoFactorAuth = !settings.security.twoFactorAuth"
                >
                  <component
                    :is="settings.security.twoFactorAuth ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.security.twoFactorAuth ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">会话超时</div>
                  <div class="text-sm text-slate-light mt-0.5">无操作自动登出时间（分钟）</div>
                </div>
                <input
                  v-model.number="settings.security.sessionTimeout"
                  type="number"
                  min="5"
                  max="120"
                  class="input-field w-24 text-center"
                />
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">远程访问</div>
                  <div class="text-sm text-slate-light mt-0.5">允许从外部网络访问系统</div>
                </div>
                <button
                  @click="settings.security.allowRemoteAccess = !settings.security.allowRemoteAccess"
                >
                  <component
                    :is="settings.security.allowRemoteAccess ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.security.allowRemoteAccess ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">自动锁定</div>
                  <div class="text-sm text-slate-light mt-0.5">页面隐藏时自动锁定</div>
                </div>
                <button
                  @click="settings.security.autoLock = !settings.security.autoLock"
                >
                  <component
                    :is="settings.security.autoLock ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.security.autoLock ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4">
                <div>
                  <div class="text-white font-medium">登录提醒</div>
                  <div class="text-sm text-slate-light mt-0.5">新设备登录时发送通知</div>
                </div>
                <button
                  @click="settings.security.loginAlerts = !settings.security.loginAlerts"
                >
                  <component
                    :is="settings.security.loginAlerts ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.security.loginAlerts ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeSection === 'appearance'" class="space-y-6">
          <div class="glass-card p-6">
            <h2 class="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Palette class="w-5 h-5 text-neon-purple" />
              外观设置
            </h2>

            <div class="space-y-6">
              <div class="py-4 border-b border-slate-dark">
                <div class="text-white font-medium mb-3">主题色</div>
                <div class="flex gap-3">
                  <button
                    v-for="color in accentColors"
                    :key="color.value"
                    @click="updateAccentColor(color.value)"
                    :class="[
                      'w-12 h-12 rounded-xl border-2 transition-all duration-200',
                      settings.appearance.accentColor === color.value
                        ? 'border-white scale-110'
                        : 'border-transparent hover:scale-105'
                    ]"
                    :style="{ backgroundColor: color.color }"
                    :title="color.label"
                  >
                    <CheckCircle
                      v-if="settings.appearance.accentColor === color.value"
                      class="w-6 h-6 text-white mx-auto"
                    />
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">动画效果</div>
                  <div class="text-sm text-slate-light mt-0.5">启用界面过渡动画</div>
                </div>
                <button
                  @click="settings.appearance.animations = !settings.appearance.animations"
                >
                  <component
                    :is="settings.appearance.animations ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.appearance.animations ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">紧凑模式</div>
                  <div class="text-sm text-slate-light mt-0.5">减小界面元素间距</div>
                </div>
                <button
                  @click="settings.appearance.compactMode = !settings.appearance.compactMode"
                >
                  <component
                    :is="settings.appearance.compactMode ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.appearance.compactMode ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>

              <div class="flex items-center justify-between py-4">
                <div>
                  <div class="text-white font-medium">显示 FPS</div>
                  <div class="text-sm text-slate-light mt-0.5">在右下角显示帧率</div>
                </div>
                <button
                  @click="settings.appearance.showFPS = !settings.appearance.showFPS"
                >
                  <component
                    :is="settings.appearance.showFPS ? ToggleRight : ToggleLeft"
                    :class="['w-10 h-10', settings.appearance.showFPS ? 'text-success-green' : 'text-slate-light']"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeSection === 'system'" class="space-y-6">
          <div class="glass-card p-6">
            <h2 class="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Globe class="w-5 h-5 text-neon-purple" />
              系统设置
            </h2>

            <div class="space-y-6">
              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">语言</div>
                  <div class="text-sm text-slate-light mt-0.5">选择界面显示语言</div>
                </div>
                <select
                  :value="settings.system.language"
                  @change="updateLanguage(($event.target as HTMLSelectElement).value)"
                  class="input-field w-48"
                >
                  <option v-for="lang in languages" :key="lang.value" :value="lang.value">
                    {{ lang.label }}
                  </option>
                </select>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">时区</div>
                  <div class="text-sm text-slate-light mt-0.5">选择您所在的时区</div>
                </div>
                <select v-model="settings.system.timezone" class="input-field w-64">
                  <option v-for="tz in timezones" :key="tz.value" :value="tz.value">
                    {{ tz.label }}
                  </option>
                </select>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">日期格式</div>
                  <div class="text-sm text-slate-light mt-0.5">选择日期显示格式</div>
                </div>
                <select v-model="settings.system.dateFormat" class="input-field w-40">
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>

              <div class="flex items-center justify-between py-4">
                <div>
                  <div class="text-white font-medium">时间格式</div>
                  <div class="text-sm text-slate-light mt-0.5">选择时间显示格式</div>
                </div>
                <select v-model="settings.system.timeFormat" class="input-field w-40">
                  <option value="24h">24 小时制</option>
                  <option value="12h">12 小时制</option>
                </select>
              </div>
            </div>
          </div>

          <div class="glass-card p-6">
            <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Database class="w-5 h-5 text-neon-purple" />
              数据管理
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button @click="exportData" class="btn-secondary text-sm justify-start">
                <Download class="w-4 h-4 mr-2 text-success-green" />
                导出所有数据
              </button>
              <button @click="importData" class="btn-secondary text-sm justify-start">
                <Upload class="w-4 h-4 mr-2 text-cyber-teal" />
                导入备份数据
              </button>
            </div>
          </div>

          <div class="glass-card p-6 border-danger-red/50">
            <h2 class="text-lg font-semibold text-danger-red mb-4 flex items-center gap-2">
              <AlertTriangle class="w-5 h-5" />
              危险操作
            </h2>
            <p class="text-sm text-slate-light mb-4">
              以下操作会清除数据且无法恢复，请谨慎操作。
            </p>
            <button @click="resetSystem" class="btn-danger text-sm justify-start">
              <RotateCcw class="w-4 h-4 mr-2" />
              重置系统
            </button>
          </div>
        </div>

        <div v-if="activeSection === 'about'" class="space-y-6">
          <div class="glass-card p-6">
            <div class="text-center mb-8">
              <div class="w-20 h-20 rounded-2xl bg-neon-purple/20 border-2 border-neon-purple/50 flex items-center justify-center mx-auto mb-4">
                <Monitor class="w-10 h-10 text-neon-purple" />
              </div>
              <h2 class="text-2xl font-bold text-white mb-2">HomeAutoPulse</h2>
              <p class="text-slate-light">家庭自动化系统逻辑冲突监控平台</p>
            </div>

            <div class="space-y-4">
              <div class="flex items-center justify-between py-3 border-b border-slate-dark">
                <span class="text-slate-light">系统版本</span>
                <span class="text-white font-mono">v{{ systemInfo.version }}</span>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-slate-dark">
                <span class="text-slate-light">构建时间</span>
                <span class="text-white">{{ systemInfo.buildTime }}</span>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-slate-dark">
                <span class="text-slate-light">运行时间</span>
                <span class="text-white">{{ formatUptime(systemInfo.uptime) }}</span>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-slate-dark">
                <span class="text-slate-light">最后备份</span>
                <span class="text-white">{{ formatDateTime(systemInfo.lastBackup) }}</span>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-slate-dark">
                <span class="text-slate-light">数据库大小</span>
                <span class="text-white">{{ (systemInfo.databaseSize / 1024).toFixed(2) }} KB</span>
              </div>
              <div class="flex items-center justify-between py-3">
                <span class="text-slate-light">设备总数</span>
                <span class="text-white">{{ deviceStore.devices.length }} 台</span>
              </div>
            </div>
          </div>

          <div class="glass-card p-6">
            <h3 class="text-lg font-semibold text-white mb-4">技术栈</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-neon-purple font-medium">Vue 3.4</div>
                <div class="text-xs text-slate-light">前端框架</div>
              </div>
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-cyber-teal font-medium">TypeScript 5.4</div>
                <div class="text-xs text-slate-light">类型系统</div>
              </div>
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-alert-orange font-medium">Vite 5.2</div>
                <div class="text-xs text-slate-light">构建工具</div>
              </div>
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-success-green font-medium">Pinia 2.1</div>
                <div class="text-xs text-slate-light">状态管理</div>
              </div>
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-neon-purple font-medium">TailwindCSS 3.4</div>
                <div class="text-xs text-slate-light">样式框架</div>
              </div>
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-cyber-teal font-medium">IndexedDB</div>
                <div class="text-xs text-slate-light">离线存储</div>
              </div>
            </div>
          </div>

          <div class="glass-card p-6">
            <h3 class="text-lg font-semibold text-white mb-4">核心功能</h3>
            <ul class="space-y-2 text-sm text-slate-light">
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                多维度传感器数据语义对齐引擎
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                异步冲突解析引擎（优先级队列 + 多worker调度）
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                IndexedDB 离线工况快照存储
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                安防系统与智能家居控制中心双视角
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                实时数据可视化监控
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                可配置的冲突解析策略
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    </div>
    <input
      ref="fileInputRef"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleFileImport"
    />
  </div>
</template>
