<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  Heart,
  Plane,
  Activity,
  Database,
  ChevronLeft,
  ChevronRight,
  Bell,
  Settings,
  RefreshCw,
  X,
  UserCog,
  BellRing,
  HardDrive,
  Info,
  ExternalLink,
} from 'lucide-vue-next';
import { useSyncStore } from '../../stores/sync';
import { useMedicalStore } from '../../stores/medical';
import { checkAndInitializeData } from '../../utils/mock';

const route = useRoute();
const router = useRouter();
const syncStore = useSyncStore();
const medicalStore = useMedicalStore();

const sidebarCollapsed = ref(false);
const isSyncing = ref(false);
const showNotifications = ref(false);
const showSettings = ref(false);
const bellBtnRef = ref<HTMLElement | null>(null);
const settingsBtnRef = ref<HTMLElement | null>(null);
const notifPanelStyle = ref<Record<string, string>>({});
const settingsPanelStyle = ref<Record<string, string>>({});

const menuItems = [
  { path: '/dashboard', label: '综合驾驶舱', icon: LayoutDashboard, submenu: [
    { path: '/dashboard/overview', label: '总览' },
    { path: '/dashboard/trends', label: '趋势分析' },
  ]},
  { path: '/medical', label: '航医中心', icon: Heart, submenu: [
    { path: '/medical/monitoring', label: '生理监测' },
    { path: '/medical/records', label: '健康档案' },
  ]},
  { path: '/aoc', label: 'AOC运行控制', icon: Plane, submenu: [
    { path: '/aoc/schedule', label: '排班计划' },
    { path: '/aoc/network', label: '航线网络' },
  ]},
  { path: '/algorithm', label: '算法中心', icon: Activity, submenu: [
    { path: '/algorithm/biorhythm', label: '生物节律' },
    { path: '/algorithm/fatigue', label: '疲劳评估' },
  ]},
  { path: '/database', label: '工效学图谱', icon: Database },
];

const isActive = (path: string) => route.path.startsWith(path);

const updatePanelPosition = (btnRef: HTMLElement | null, styleRef: typeof notifPanelStyle) => {
  if (!btnRef) return;
  const rect = btnRef.getBoundingClientRect();
  styleRef.value = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    right: `${window.innerWidth - rect.right}px`,
    zIndex: '9999',
  };
};

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
  showSettings.value = false;
  if (showNotifications.value) {
    nextTick(() => updatePanelPosition(bellBtnRef.value, notifPanelStyle));
  }
};

const toggleSettings = () => {
  showSettings.value = !showSettings.value;
  showNotifications.value = false;
  if (showSettings.value) {
    nextTick(() => updatePanelPosition(settingsBtnRef.value, settingsPanelStyle));
  }
};

const closeAllPanels = () => {
  showNotifications.value = false;
  showSettings.value = false;
};

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.avia-panel') && !target.closest('.avia-trigger')) {
    closeAllPanels();
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') closeAllPanels();
};

onMounted(async () => {
  await syncStore.loadStats();
  await syncStore.loadMessages();
  document.addEventListener('click', handleClickOutside, true);
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true);
  document.removeEventListener('keydown', handleKeydown);
});

const triggerSync = async () => {
  isSyncing.value = true;
  await syncStore.syncAll();
  setTimeout(() => {
    isSyncing.value = false;
  }, 1000);
};

const reloadData = async () => {
  isSyncing.value = true;
  await checkAndInitializeData();
  setTimeout(() => {
    isSyncing.value = false;
    window.location.reload();
  }, 1000);
};

const settingsMenuItems = [
  { label: '个人偏好设置', icon: UserCog, action: () => { closeAllPanels(); } },
  { label: '通知设置', icon: BellRing, action: () => { closeAllPanels(); } },
  { label: '数据备份与恢复', icon: HardDrive, action: () => { closeAllPanels(); router.push('/database'); } },
  { label: '关于系统', icon: Info, action: () => { closeAllPanels(); } },
];

const unreadAlertCount = ref(3);

const viewAllNotifications = () => {
  closeAllPanels();
  router.push('/medical/monitoring');
};
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 flex">
    <aside
      class="bg-slate-800/90 backdrop-blur-xl border-r border-slate-700/50 transition-all duration-300 flex flex-col"
      :class="sidebarCollapsed ? 'w-20' : 'w-64'"
    >
      <div class="h-16 flex items-center px-4 border-b border-slate-700/50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Plane class="w-5 h-5 text-white" />
          </div>
          <div v-if="!sidebarCollapsed" class="flex-1">
            <div class="font-bold text-lg bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              AviaFlow
            </div>
            <div class="text-xs text-slate-500">民航机组疲劳管理系统</div>
          </div>
        </div>
        <button
          @click="sidebarCollapsed = !sidebarCollapsed"
          class="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors ml-auto"
        >
          <ChevronLeft v-if="!sidebarCollapsed" class="w-4 h-4" />
          <ChevronRight v-else class="w-4 h-4" />
        </button>
      </div>

      <nav class="flex-1 py-4 overflow-y-auto">
        <div
          v-for="item in menuItems"
          :key="item.path"
          class="px-3 mb-1"
        >
          <div
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
            :class="isActive(item.path) ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'"
            @click="item.submenu ? null : router.push(item.path)"
          >
            <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
            <span v-if="!sidebarCollapsed" class="text-sm font-medium">{{ item.label }}</span>
          </div>
          <div v-if="item.submenu && !sidebarCollapsed" class="ml-2 mt-1 space-y-0.5">
            <div
              v-for="sub in item.submenu"
              :key="sub.path"
              class="flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-all text-sm"
              :class="route.path === sub.path ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/20'"
              @click="router.push(sub.path)"
            >
              {{ sub.label }}
            </div>
          </div>
        </div>
      </nav>

      <div class="p-3 border-t border-slate-700/50">
        <div
          class="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-700/30 text-slate-300"
        >
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-xs font-bold">
            管
          </div>
          <div v-if="!sidebarCollapsed" class="flex-1">
            <div class="text-sm font-medium">系统管理员</div>
            <div class="text-xs text-slate-500">admin@aviaflow.com</div>
          </div>
        </div>
      </div>
    </aside>

    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 flex items-center px-6 relative z-10">
        <div class="flex items-center gap-4">
          <h1 class="text-lg font-semibold text-slate-200">
            {{ menuItems.find(m => isActive(m.path))?.label || '综合驾驶舱' }}
          </h1>
          <span class="px-2 py-0.5 text-xs rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30">
            v1.0.0
          </span>
        </div>

        <div class="flex items-center gap-3 ml-auto">
          <div v-if="syncStore.stats" class="hidden md:flex items-center gap-3 mr-4">
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/30 text-xs">
              <div
                class="w-2 h-2 rounded-full animate-pulse"
                :class="syncStore.stats.pendingCount > 0 ? 'bg-amber-500' : 'bg-green-500'"
              ></div>
              <span class="text-slate-400">待同步:</span>
              <span class="text-slate-200 font-medium">{{ syncStore.stats.pendingCount }}</span>
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/30 text-xs">
              <span class="text-slate-400">今日同步:</span>
              <span class="text-slate-200 font-medium">{{ syncStore.stats.todaySuccessCount }}</span>
            </div>
          </div>

          <button
            @click="triggerSync"
            class="p-2 rounded-lg hover:bg-slate-700/50 transition-colors relative"
            :class="{ 'animate-spin': isSyncing }"
            title="立即同步"
          >
            <RefreshCw class="w-5 h-5 text-slate-400" />
          </button>
          <button
            @click="reloadData"
            class="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            title="重置数据"
          >
            <Database class="w-5 h-5 text-slate-400" />
          </button>
          <button
            ref="bellBtnRef"
            @click.stop="toggleNotifications"
            class="avia-trigger p-2 rounded-lg hover:bg-slate-700/50 transition-colors relative"
            :class="{ 'bg-slate-700/50': showNotifications }"
          >
            <Bell class="w-5 h-5 text-slate-400" />
            <span v-if="unreadAlertCount > 0" class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button
            ref="settingsBtnRef"
            @click.stop="toggleSettings"
            class="avia-trigger p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            :class="{ 'bg-slate-700/50': showSettings }"
          >
            <Settings class="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-auto">
        <slot></slot>
      </main>
    </div>

    <Teleport to="body">
      <div
        v-if="showNotifications"
        class="avia-panel"
        :style="notifPanelStyle"
      >
        <div class="w-80 bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <div class="flex items-center gap-2">
              <Bell class="w-4 h-4 text-blue-400" />
              <h3 class="font-semibold text-slate-200">消息通知</h3>
              <span v-if="unreadAlertCount > 0" class="px-1.5 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">{{ unreadAlertCount }}</span>
            </div>
            <button @click.stop="closeAllPanels" class="p-1 hover:bg-slate-700/50 rounded transition-colors">
              <X class="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div class="max-h-80 overflow-y-auto">
            <div
              v-for="msg in syncStore.messages.slice(0, 5)"
              :key="msg.id"
              class="px-4 py-3 border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors cursor-pointer"
              @click.stop
            >
              <div class="flex items-start gap-3">
                <div class="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                  :class="msg.status === 'processed' ? 'bg-green-500' : msg.status === 'delivered' ? 'bg-yellow-500' : 'bg-blue-500'"
                ></div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-slate-200">{{ msg.type }}</div>
                  <div class="text-xs text-slate-500 mt-0.5">{{ msg.timestamp }}</div>
                </div>
              </div>
            </div>
            <div v-if="syncStore.messages.length === 0" class="px-4 py-8 text-center text-slate-500 text-sm">
              暂无通知消息
            </div>
          </div>
          <div class="px-4 py-2 border-t border-slate-700/50">
            <button
              @click.stop="viewAllNotifications"
              class="w-full py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1"
            >
              查看全部通知
              <ExternalLink class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showSettings"
        class="avia-panel"
        :style="settingsPanelStyle"
      >
        <div class="w-64 bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <div class="flex items-center gap-2">
              <Settings class="w-4 h-4 text-slate-400" />
              <h3 class="font-semibold text-slate-200">系统设置</h3>
            </div>
            <button @click.stop="closeAllPanels" class="p-1 hover:bg-slate-700/50 rounded transition-colors">
              <X class="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div class="p-2">
            <button
              v-for="(item, idx) in settingsMenuItems"
              :key="idx"
              @click.stop="item.action()"
              class="w-full px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors flex items-center gap-3"
            >
              <component :is="item.icon" class="w-4 h-4 text-slate-500" />
              {{ item.label }}
            </button>
          </div>
          <div class="px-4 py-3 border-t border-slate-700/50">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-xs font-bold text-white">
                管
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-slate-200">系统管理员</div>
                <div class="text-xs text-slate-500">admin@aviaflow.com</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
