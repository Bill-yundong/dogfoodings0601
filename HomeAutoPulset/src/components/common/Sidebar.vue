<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  LayoutDashboard,
  AlertTriangle,
  GitMerge,
  Database,
  Settings2,
  Cpu,
  Settings,
  Activity,
  Shield,
  Home,
} from 'lucide-vue-next';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const navItems = computed(() => [
  { path: '/', name: t('sidebar.dashboard'), icon: LayoutDashboard },
  { path: '/conflicts', name: t('sidebar.conflictCenter'), icon: AlertTriangle },
  { path: '/semantic', name: t('sidebar.semanticAlignment'), icon: GitMerge },
  { path: '/snapshots', name: t('sidebar.snapshotManager'), icon: Database },
  { path: '/rules', name: t('sidebar.ruleEngine'), icon: Settings2 },
  { path: '/devices', name: t('sidebar.deviceList'), icon: Cpu },
  { path: '/settings', name: t('sidebar.systemSettings'), icon: Settings },
]);

const isActive = (path: string) => {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
};

const navigate = (path: string) => {
  router.push(path);
};

const systemStatus = computed(() => ({
  online: true,
  lastSync: Date.now(),
}));
</script>

<template>
  <aside class="fixed left-0 top-0 h-full w-64 bg-deep-space border-r border-slate-mid/30 flex flex-col z-50">
    <div class="p-6 border-b border-slate-mid/30">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-purple to-cyber-teal flex items-center justify-center shadow-lg shadow-neon-purple/20">
          <Activity class="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 class="font-display text-lg font-bold text-white">HomeAutoPulse</h1>
          <p class="text-xs text-slate-light">{{ t('sidebar.smartHomeControl') }}</p>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto py-4">
      <div class="px-4 mb-4">
        <div class="flex items-center gap-2 px-3 py-2 bg-midnight/50 rounded-lg border border-success-green/20">
          <div class="relative">
            <div class="w-2 h-2 rounded-full bg-success-green"></div>
            <div class="absolute inset-0 rounded-full bg-success-green animate-ping opacity-75"></div>
          </div>
          <span class="text-xs text-success-green">{{ t('sidebar.systemStatus') }}</span>
        </div>
      </div>

      <nav class="space-y-1 px-3">
        <button
          v-for="item in navItems"
          :key="item.path"
          @click="navigate(item.path)"
          :class="[
            'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
            isActive(item.path)
              ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30 shadow-lg shadow-neon-purple/10'
              : 'text-slate-light hover:text-white hover:bg-midnight/50 border border-transparent'
          ]"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span>{{ item.name }}</span>
        </button>
      </nav>

      <div class="mt-8 px-6">
        <h3 class="text-xs font-semibold text-slate-light uppercase tracking-wider mb-3">{{ t('sidebar.quickScenes') }}</h3>
        <div class="space-y-2">
          <div class="flex items-center gap-3 px-3 py-2 bg-midnight/30 rounded-lg hover:bg-midnight/50 cursor-pointer transition-colors">
            <Shield class="w-4 h-4 text-alert-orange" />
            <span class="text-sm text-slate-light">{{ t('sidebar.securityMode') }}</span>
          </div>
          <div class="flex items-center gap-3 px-3 py-2 bg-midnight/30 rounded-lg hover:bg-midnight/50 cursor-pointer transition-colors">
            <Home class="w-4 h-4 text-info-blue" />
            <span class="text-sm text-slate-light">{{ t('sidebar.homeMode') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-slate-mid/30">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-neon-purple to-info-blue flex items-center justify-center">
          <span class="text-white font-semibold text-sm">管</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">{{ t('sidebar.admin') }}</p>
          <p class="text-xs text-slate-light truncate">admin@homeauto.local</p>
        </div>
      </div>
    </div>
  </aside>
</template>
