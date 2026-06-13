<script setup lang="ts">
import { Users, Heart, AlertTriangle, Plane, TrendingUp, Activity } from 'lucide-vue-next';
import { useDashboardStore } from '../../stores/dashboard';
import StatCard from '../../components/common/StatCard.vue';
import AlertCard from '../../components/common/AlertCard.vue';
import HeatmapChart from '../../components/charts/HeatmapChart.vue';
import { computed } from 'vue';

const dashboardStore = useDashboardStore();

const pendingAlerts = computed(() => 
  dashboardStore.alerts.filter(a => !a.acknowledged)
);

const riskDistribution = computed(() => {
  if (!dashboardStore.stats) return null;
  return {
    low: dashboardStore.stats.riskDistribution.low,
    medium: dashboardStore.stats.riskDistribution.medium,
    high: dashboardStore.stats.riskDistribution.high,
    critical: dashboardStore.stats.riskDistribution.critical,
  };
});
</script>

<template>
  <div class="p-6">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
      <StatCard
        v-if="dashboardStore.stats"
        title="在岗机组"
        :value="dashboardStore.stats.totalCrew"
        :icon="Users"
        color="blue"
        subtitle="可执行任务"
      />
      <StatCard
        v-if="dashboardStore.stats"
        title="今日航班"
        :value="dashboardStore.stats.todayFlights"
        :icon="Plane"
        color="purple"
        :trend="8"
        subtitle="国际航线占比 62%"
      />
      <StatCard
        v-if="dashboardStore.stats"
        title="高风险预警"
        :value="dashboardStore.stats.criticalAlertCount"
        :icon="AlertTriangle"
        color="red"
        :trend="-12"
        subtitle="需要立即处理"
      />
      <StatCard
        v-if="dashboardStore.stats"
        title="平均疲劳评分"
        :value="dashboardStore.stats.avgFatigueScore.toFixed(1)"
        :icon="Activity"
        color="amber"
        subtitle="安全阈值: 55"
      />
    </div>

    <div v-if="riskDistribution" class="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-slate-400">低风险</span>
          <span class="text-lg font-bold text-green-400">{{ riskDistribution.low }}</span>
        </div>
        <div class="h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            class="h-full bg-green-500 rounded-full"
            :style="{ width: `${(riskDistribution.low / dashboardStore.stats!.totalCrew) * 100}%` }"
          ></div>
        </div>
      </div>
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-slate-400">中风险</span>
          <span class="text-lg font-bold text-amber-400">{{ riskDistribution.medium }}</span>
        </div>
        <div class="h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            class="h-full bg-amber-500 rounded-full"
            :style="{ width: `${(riskDistribution.medium / dashboardStore.stats!.totalCrew) * 100}%` }"
          ></div>
        </div>
      </div>
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-slate-400">高风险</span>
          <span class="text-lg font-bold text-orange-400">{{ riskDistribution.high }}</span>
        </div>
        <div class="h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            class="h-full bg-orange-500 rounded-full"
            :style="{ width: `${(riskDistribution.high / dashboardStore.stats!.totalCrew) * 100}%` }"
          ></div>
        </div>
      </div>
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-slate-400">临界风险</span>
          <span class="text-lg font-bold text-red-400">{{ riskDistribution.critical }}</span>
        </div>
        <div class="h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            class="h-full bg-red-500 rounded-full"
            :style="{ width: `${(riskDistribution.critical / dashboardStore.stats!.totalCrew) * 100}%` }"
          ></div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div class="xl:col-span-2">
        <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold text-slate-100">疲劳度热力图</h3>
              <p class="text-sm text-slate-500">最近30天机组疲劳度分布</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="dashboardStore.loadHeatmap(7)"
                class="px-3 py-1.5 text-xs rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 transition-colors"
              >
                7天
              </button>
              <button
                @click="dashboardStore.loadHeatmap(30)"
                class="px-3 py-1.5 text-xs rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30"
              >
                30天
              </button>
              <button
                @click="dashboardStore.loadHeatmap(90)"
                class="px-3 py-1.5 text-xs rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 transition-colors"
              >
                90天
              </button>
            </div>
          </div>
          <HeatmapChart v-if="dashboardStore.heatmapData.length > 0" :data="dashboardStore.heatmapData" height="500px" />
          <div v-else class="h-[500px] flex items-center justify-center text-slate-500">
            加载中...
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold text-slate-100">待处理预警</h3>
              <p class="text-sm text-slate-500">{{ pendingAlerts.length }} 条需要关注</p>
            </div>
            <span
              v-if="pendingAlerts.length > 0"
              class="px-2 py-1 text-xs rounded-full bg-red-600/20 text-red-400 border border-red-500/30 animate-pulse"
            >
              紧急
            </span>
          </div>
          <div class="space-y-3 max-h-[280px] overflow-y-auto pr-2">
            <AlertCard
              v-for="alert in pendingAlerts.slice(0, 5)"
              :key="alert.id"
              :alert="alert"
              @acknowledge="dashboardStore.acknowledgeAlert($event)"
            />
            <div v-if="pendingAlerts.length === 0" class="text-center py-8 text-slate-500 text-sm">
              暂无待处理预警
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-2xl p-5">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-600/30 flex items-center justify-center flex-shrink-0">
              <TrendingUp class="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 class="font-semibold text-slate-100 mb-1">系统健康度</h4>
              <p class="text-sm text-slate-400 mb-3">航医中心与AOC系统数据同步正常，异步生物节律算法运行稳定</p>
              <div class="flex items-center gap-4 text-xs">
                <div class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span class="text-slate-400">数据同步</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span class="text-slate-400">算法引擎</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span class="text-slate-400">IndexedDB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
