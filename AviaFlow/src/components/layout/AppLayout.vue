<script setup lang="ts">
import { ref, onMounted } from 'vue';
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
} from 'lucide-vue-next';
import { useSyncStore } from '../../stores/sync';
import { checkAndInitializeData } from '../../utils/mock';

const route = useRoute();
const router = useRouter();
const syncStore = useSyncStore();

const sidebarCollapsed = ref(false);
const isSyncing = ref(false);

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

onMounted(async () => {
  await syncStore.loadStats();
  await syncStore.loadMessages();
});
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
      <header class="h-16 bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 flex items-center px-6">
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
          <button class="p-2 rounded-lg hover:bg-slate-700/50 transition-colors relative">
            <Bell class="w-5 h-5 text-slate-400" />
            <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button class="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
            <Settings class="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-auto">
        <slot></slot>
      </main>
    </div>
  </div>
</template>
