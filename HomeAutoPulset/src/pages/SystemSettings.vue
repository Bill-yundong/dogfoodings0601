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
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
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

const sections = computed(() => [
  { id: 'general', label: t('systemSettings.general'), icon: Settings },
  { id: 'notifications', label: t('systemSettings.notifications'), icon: Bell },
  { id: 'security', label: t('systemSettings.security'), icon: Shield },
  { id: 'appearance', label: t('systemSettings.appearance'), icon: Palette },
  { id: 'system', label: t('systemSettings.system'), icon: Globe },
  { id: 'about', label: t('systemSettings.about'), icon: Info },
]);

const accentColors = computed(() => [
  { value: 'purple', label: t('systemSettings.neonPurple'), color: '#7C4DFF' },
  { value: 'cyan', label: t('systemSettings.cyberTeal'), color: '#00E5FF' },
  { value: 'green', label: t('systemSettings.freshGreen'), color: '#00C853' },
  { value: 'orange', label: t('systemSettings.vibrantOrange'), color: '#FF6B35' },
]);

const languages = computed(() => [
  { value: 'zh-CN', label: t('systemSettings.simplifiedChinese') },
  { value: 'zh-TW', label: t('systemSettings.traditionalChinese') },
  { value: 'en-US', label: t('systemSettings.english') },
  { value: 'ja-JP', label: t('systemSettings.japanese') },
]);

const timezones = computed(() => [
  { value: 'Asia/Shanghai', label: t('systemSettings.chinaTimezone') },
  { value: 'Asia/Tokyo', label: t('systemSettings.tokyoTimezone') },
  { value: 'America/New_York', label: t('systemSettings.newYorkTimezone') },
  { value: 'Europe/London', label: t('systemSettings.londonTimezone') },
]);

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
  return `${days}${t('systemSettings.days')} ${hours}${t('systemSettings.hours')} ${minutes}${t('systemSettings.minutes')} ${secs}${t('systemSettings.seconds')}`;
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
      if (confirm(t('systemSettings.confirmImport'))) {
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
        alert(t('systemSettings.importSuccess'));
      }
    } catch (err) {
      alert(t('systemSettings.importFailed'));
    }
  };
  reader.readAsText(file);
  target.value = '';
};

const resetSystem = () => {
  if (confirm(t('systemSettings.confirmReset'))) {
    if (confirm(t('systemSettings.confirmResetAgain'))) {
      localStorage.clear();
      indexedDB.deleteDatabase('homeautopulse_db');
      alert(t('systemSettings.resetComplete'));
      location.reload();
    }
  }
};

const clearConflictHistory = () => {
  if (confirm(t('systemSettings.confirmClearConflicts'))) {
    conflictStore.conflicts.splice(0, conflictStore.conflicts.length);
  }
};

const clearSnapshots = () => {
  if (confirm(t('systemSettings.confirmClearSnapshots'))) {
    snapshotStore.snapshots.splice(0, snapshotStore.snapshots.length);
  }
};

const generateTestConflict = () => {
  conflictStore.generateTestConflict('high');
};

const runDiagnostics = async () => {
  alert(t('systemSettings.diagnosticsComplete'));
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
              {{ t('systemSettings.title') }}
            </h1>
            <p class="text-slate-light mt-1">
              {{ t('systemSettings.subtitle') }}
            </p>
          </div>
      </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <MetricCard
        :title="t('systemSettings.uptime')"
        :value="formatUptime(systemInfo.uptime)"
        :icon="Clock"
        color="cyan"
      />
      <MetricCard
        :title="t('systemSettings.systemVersion')"
        :value="`v${systemInfo.version}`"
        :icon="Cpu"
        color="purple"
      />
      <MetricCard
        :title="t('systemSettings.deviceCount')"
        :value="deviceStore.devices.length"
        :icon="Cpu"
        color="green"
      />
      <MetricCard
        :title="t('systemSettings.conflictRecords')"
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
              {{ t('systemSettings.general') }}
            </h2>

            <div class="space-y-6">
              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">{{ t('systemSettings.autoResolveConflicts') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.autoResolveConflictsDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.autoCreateSnapshots') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.autoCreateSnapshotsDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.enableOfflineMode') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.enableOfflineModeDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.autoSyncSnapshots') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.autoSyncSnapshotsDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.snapshotInterval') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.snapshotIntervalDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.maxOfflineDays') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.maxOfflineDaysDesc') }}</div>
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
              {{ t('systemSettings.quickActions') }}
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button @click="generateTestConflict" class="btn-secondary text-sm justify-start">
                <AlertTriangle class="w-4 h-4 mr-2 text-alert-orange" />
                {{ t('systemSettings.generateTestConflict') }}
              </button>
              <button @click="runDiagnostics" class="btn-secondary text-sm justify-start">
                <CheckCircle class="w-4 h-4 mr-2 text-success-green" />
                {{ t('systemSettings.runDiagnostics') }}
              </button>
              <button @click="clearConflictHistory" class="btn-secondary text-sm justify-start">
                <Trash2 class="w-4 h-4 mr-2 text-danger-red" />
                {{ t('systemSettings.clearConflictHistory') }}
              </button>
              <button @click="clearSnapshots" class="btn-secondary text-sm justify-start">
                <Database class="w-4 h-4 mr-2 text-cyber-teal" />
                {{ t('systemSettings.clearAllSnapshots') }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="activeSection === 'notifications'" class="space-y-6">
          <div class="glass-card p-6">
            <h2 class="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Bell class="w-5 h-5 text-neon-purple" />
              {{ t('systemSettings.notifications') }}
            </h2>

            <div class="space-y-6">
              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div class="flex items-center gap-3">
                  <Smartphone class="w-5 h-5 text-cyber-teal" />
                  <div>
                    <div class="text-white font-medium">{{ t('systemSettings.pushNotifications') }}</div>
                    <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.pushNotificationsDesc') }}</div>
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
                    <div class="text-white font-medium">{{ t('systemSettings.emailNotifications') }}</div>
                    <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.emailNotificationsDesc') }}</div>
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
                    <div class="text-white font-medium">{{ t('systemSettings.soundAlerts') }}</div>
                    <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.soundAlertsDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.conflictAlert') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.conflictAlertDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.deviceOfflineAlert') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.deviceOfflineAlertDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.systemErrorAlert') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.systemErrorAlertDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.dailyReport') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.dailyReportDesc') }}</div>
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
              {{ t('systemSettings.security') }}
            </h2>

            <div class="space-y-6">
              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">{{ t('systemSettings.twoFactorAuth') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.twoFactorAuthDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.sessionTimeout') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.sessionTimeoutDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.remoteAccess') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.remoteAccessDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.autoLock') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.autoLockDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.loginAlerts') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.loginAlertsDesc') }}</div>
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
              {{ t('systemSettings.appearance') }}
            </h2>

            <div class="space-y-6">
              <div class="py-4 border-b border-slate-dark">
                <div class="text-white font-medium mb-3">{{ t('systemSettings.accentColor') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.animations') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.animationsDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.compactMode') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.compactModeDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.showFPS') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.showFPSDesc') }}</div>
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
              {{ t('systemSettings.system') }}
            </h2>

            <div class="space-y-6">
              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">{{ t('systemSettings.language') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.languageDesc') }}</div>
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
                  <div class="text-white font-medium">{{ t('systemSettings.timezone') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.timezoneDesc') }}</div>
                </div>
                <select v-model="settings.system.timezone" class="input-field w-64">
                  <option v-for="tz in timezones" :key="tz.value" :value="tz.value">
                    {{ tz.label }}
                  </option>
                </select>
              </div>

              <div class="flex items-center justify-between py-4 border-b border-slate-dark">
                <div>
                  <div class="text-white font-medium">{{ t('systemSettings.dateFormat') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.dateFormatDesc') }}</div>
                </div>
                <select v-model="settings.system.dateFormat" class="input-field w-40">
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>

              <div class="flex items-center justify-between py-4">
                <div>
                  <div class="text-white font-medium">{{ t('systemSettings.timeFormat') }}</div>
                  <div class="text-sm text-slate-light mt-0.5">{{ t('systemSettings.timeFormatDesc') }}</div>
                </div>
                <select v-model="settings.system.timeFormat" class="input-field w-40">
                  <option value="24h">{{ t('systemSettings.hour24') }}</option>
                  <option value="12h">{{ t('systemSettings.hour12') }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="glass-card p-6">
            <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Database class="w-5 h-5 text-neon-purple" />
              {{ t('systemSettings.dataManagement') }}
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button @click="exportData" class="btn-secondary text-sm justify-start">
                <Download class="w-4 h-4 mr-2 text-success-green" />
                {{ t('systemSettings.exportAllData') }}
              </button>
              <button @click="importData" class="btn-secondary text-sm justify-start">
                <Upload class="w-4 h-4 mr-2 text-cyber-teal" />
                {{ t('systemSettings.importBackupData') }}
              </button>
            </div>
          </div>

          <div class="glass-card p-6 border-danger-red/50">
            <h2 class="text-lg font-semibold text-danger-red mb-4 flex items-center gap-2">
              <AlertTriangle class="w-5 h-5" />
              {{ t('systemSettings.dangerZone') }}
            </h2>
            <p class="text-sm text-slate-light mb-4">
              {{ t('systemSettings.dangerZoneDesc') }}
            </p>
            <button @click="resetSystem" class="btn-danger text-sm justify-start">
              <RotateCcw class="w-4 h-4 mr-2" />
              {{ t('systemSettings.resetSystem') }}
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
              <p class="text-slate-light">{{ t('systemSettings.homeAutomationPlatform') }}</p>
            </div>

            <div class="space-y-4">
              <div class="flex items-center justify-between py-3 border-b border-slate-dark">
                <span class="text-slate-light">{{ t('systemSettings.systemVersion') }}</span>
                <span class="text-white font-mono">v{{ systemInfo.version }}</span>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-slate-dark">
                <span class="text-slate-light">{{ t('systemSettings.buildTime') }}</span>
                <span class="text-white">{{ systemInfo.buildTime }}</span>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-slate-dark">
                <span class="text-slate-light">{{ t('systemSettings.uptime') }}</span>
                <span class="text-white">{{ formatUptime(systemInfo.uptime) }}</span>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-slate-dark">
                <span class="text-slate-light">{{ t('systemSettings.lastBackup') }}</span>
                <span class="text-white">{{ formatDateTime(systemInfo.lastBackup) }}</span>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-slate-dark">
                <span class="text-slate-light">{{ t('systemSettings.databaseSize') }}</span>
                <span class="text-white">{{ (systemInfo.databaseSize / 1024).toFixed(2) }} KB</span>
              </div>
              <div class="flex items-center justify-between py-3">
                <span class="text-slate-light">{{ t('systemSettings.totalDevicesLabel') }}</span>
                <span class="text-white">{{ deviceStore.devices.length }} {{ t('systemSettings.frontend') === 'Frontend' ? '' : '台' }}</span>
              </div>
            </div>
          </div>

          <div class="glass-card p-6">
            <h3 class="text-lg font-semibold text-white mb-4">{{ t('systemSettings.techStack') }}</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-neon-purple font-medium">Vue 3.4</div>
                <div class="text-xs text-slate-light">{{ t('systemSettings.frontendFramework') }}</div>
              </div>
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-cyber-teal font-medium">TypeScript 5.4</div>
                <div class="text-xs text-slate-light">{{ t('systemSettings.typeSystem') }}</div>
              </div>
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-alert-orange font-medium">Vite 5.2</div>
                <div class="text-xs text-slate-light">{{ t('systemSettings.buildTool') }}</div>
              </div>
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-success-green font-medium">Pinia 2.1</div>
                <div class="text-xs text-slate-light">{{ t('systemSettings.stateManagement') }}</div>
              </div>
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-neon-purple font-medium">TailwindCSS 3.4</div>
                <div class="text-xs text-slate-light">{{ t('systemSettings.styleFramework') }}</div>
              </div>
              <div class="bg-slate-dark/50 rounded-lg p-3 text-center">
                <div class="text-cyber-teal font-medium">IndexedDB</div>
                <div class="text-xs text-slate-light">{{ t('systemSettings.offlineStorage') }}</div>
              </div>
            </div>
          </div>

          <div class="glass-card p-6">
            <h3 class="text-lg font-semibold text-white mb-4">{{ t('systemSettings.coreFeatures') }}</h3>
            <ul class="space-y-2 text-sm text-slate-light">
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                {{ t('systemSettings.semanticAlignmentFeature') }}
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                {{ t('systemSettings.conflictEngineFeature') }}
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                {{ t('systemSettings.snapshotFeature') }}
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                {{ t('systemSettings.dualPerspectiveFeature') }}
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                {{ t('systemSettings.visualizationFeature') }}
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-success-green flex-shrink-0" />
                {{ t('systemSettings.configurableStrategyFeature') }}
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
