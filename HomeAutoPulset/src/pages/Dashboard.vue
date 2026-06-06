<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import * as echarts from 'echarts';
import {
  AlertTriangle,
  Shield,
  Home,
  Cpu,
  Activity,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Database,
  CheckCircle,
} from 'lucide-vue-next';
import { useConflictStore } from '@/stores/conflictStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { useSnapshotStore } from '@/stores/snapshotStore';
import { useSemanticStore } from '@/stores/semanticStore';
import MetricCard from '@/components/common/MetricCard.vue';
import HealthScoreGauge from '@/components/common/HealthScoreGauge.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ProgressBar from '@/components/common/ProgressBar.vue';
import { formatDateTime, formatDuration, getTimeAgo, formatTime } from '@/utils/dateUtils';
import { getConflictTypeText, getSeverityTagClass } from '@/utils/conflictUtils';
import { generateConflictTrendData } from '@/utils/mockData';

const { t, locale } = useI18n();
const router = useRouter();
const conflictStore = useConflictStore();
const deviceStore = useDeviceStore();
const snapshotStore = useSnapshotStore();
const semanticStore = useSemanticStore();

const trendChartRef = ref<HTMLDivElement | null>(null);
const typeChartRef = ref<HTMLDivElement | null>(null);
let trendChart: echarts.ECharts | null = null;
let typeChart: echarts.ECharts | null = null;

const trendData = ref(generateConflictTrendData(7));

const recentConflicts = computed(() =>
  conflictStore.conflicts.slice(0, 5)
);

const recentSensorData = computed(() =>
  deviceStore.sensorDataHistory.slice(0, 8)
);

const initCharts = () => {
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value);
    trendChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 33, 55, 0.9)',
        borderColor: 'rgba(51, 65, 85, 0.5)',
        textStyle: { color: '#E2E8F0' },
      },
      legend: {
        data: [t('dashboard.totalConflicts'), t('dashboard.resolvedConflicts')],
        textStyle: { color: '#94A3B8' },
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: trendData.value.map(d => d.date),
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#64748B' },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#64748B' },
        splitLine: { lineStyle: { color: 'rgba(51, 65, 85, 0.3)' } },
      },
      series: [
        {
          name: t('dashboard.totalConflicts'),
          type: 'line',
          smooth: true,
          data: trendData.value.map(d => d.count),
          lineStyle: { color: '#FF6B35', width: 2 },
          itemStyle: { color: '#FF6B35' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(255, 107, 53, 0.3)' },
              { offset: 1, color: 'rgba(255, 107, 53, 0)' },
            ]),
          },
        },
        {
          name: t('dashboard.resolvedConflicts'),
          type: 'line',
          smooth: true,
          data: trendData.value.map(d => d.resolved),
          lineStyle: { color: '#00C853', width: 2 },
          itemStyle: { color: '#00C853' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0, 200, 83, 0.3)' },
              { offset: 1, color: 'rgba(0, 200, 83, 0)' },
            ]),
          },
        },
      ],
    });
  }

  if (typeChartRef.value) {
    typeChart = echarts.init(typeChartRef.value);
    typeChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 33, 55, 0.9)',
        borderColor: 'rgba(51, 65, 85, 0.5)',
        textStyle: { color: '#E2E8F0' },
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: '#94A3B8', fontSize: 12 },
        itemGap: 12,
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#0F2137',
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#fff',
            },
          },
          data: [
            { value: conflictStore.stats.critical, name: t('conflictCenter.critical'), itemStyle: { color: '#FF5252' } },
            { value: conflictStore.stats.high, name: t('conflictCenter.high'), itemStyle: { color: '#FF6B35' } },
            { value: conflictStore.stats.medium, name: t('conflictCenter.medium'), itemStyle: { color: '#FFD740' } },
            { value: conflictStore.stats.low, name: t('conflictCenter.low'), itemStyle: { color: '#2196F3' } },
          ],
        },
      ],
    });
  }
};

const handleResize = () => {
  trendChart?.resize();
  typeChart?.resize();
};

const goToConflictDetail = (id: string) => {
  router.push(`/conflicts/${id}`);
};

onMounted(() => {
  initCharts();
  window.addEventListener('resize', handleResize);
  snapshotStore.loadStats();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  trendChart?.dispose();
  typeChart?.dispose();
});

watch(locale, () => {
  trendChart?.dispose();
  typeChart?.dispose();
  initCharts();
});
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        :title="t('dashboard.activeConflicts')"
        :value="conflictStore.activeCount"
        :icon="AlertTriangle"
        color="danger"
        :trend="conflictStore.activeCount > 0 ? 'up' : 'neutral'"
        :trendValue="conflictStore.activeCount > 0 ? `+2 ${t('common.success')}` : t('common.normal')"
      />
      <MetricCard
        :title="t('dashboard.onlineDevices')"
        :value="deviceStore.onlineDevices.length"
        :unit="`/ ${deviceStore.devices.length}`"
        :icon="Cpu"
        color="success"
        trend="up"
        trendValue="+1"
      />
      <MetricCard
        :title="t('dashboard.resolvedConflicts')"
        :value="conflictStore.resolvedCount"
        :icon="CheckCircle"
        color="info"
        trend="up"
        trendValue="+5"
      />
      <MetricCard
        :title="t('dashboard.pendingSnapshots')"
        :value="snapshotStore.offlineSnapshotCount"
        :icon="Database"
        color="warning"
        :trend="snapshotStore.pendingSyncCount > 0 ? 'neutral' : 'down'"
        :trendValue="snapshotStore.pendingSyncCount > 0 ? `${snapshotStore.pendingSyncCount} ${t('snapshotManager.pendingSync')}` : t('snapshotManager.synced')"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 glass-card p-6">
        <h2 class="section-title">
          <Activity class="w-5 h-5 text-neon-purple" />
          {{ t('dashboard.conflictTrend') }}
        </h2>
        <div ref="trendChartRef" class="w-full h-72"></div>
      </div>

      <div class="glass-card p-6">
        <h2 class="section-title">
          <Shield class="w-5 h-5 text-alert-orange" />
          {{ t('dashboard.systemLoad') }}
        </h2>
        <div class="flex flex-col items-center justify-center py-4">
          <HealthScoreGauge :score="conflictStore.healthScore" :size="160" />
        </div>
        <div class="mt-6 space-y-4">
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-slate-light">{{ t('dashboard.securitySystem') }}</span>
              <span class="text-success-green">{{ t('dashboard.normal') }}</span>
            </div>
            <ProgressBar :value="95" color="success" height="sm" />
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-slate-light">{{ t('dashboard.homeControl') }}</span>
              <span class="text-success-green">{{ t('dashboard.normal') }}</span>
            </div>
            <ProgressBar :value="88" color="success" height="sm" />
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-slate-light">{{ t('dashboard.semanticAlignment') }}</span>
              <span class="text-warning-amber">{{ t('dashboard.good') }}</span>
            </div>
            <ProgressBar :value="82" color="warning" height="sm" />
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="glass-card p-6">
        <h2 class="section-title">
          <AlertTriangle class="w-5 h-5 text-alert-orange" />
          {{ t('dashboard.recentConflicts') }}
        </h2>
        <div class="space-y-3">
          <div
            v-for="conflict in recentConflicts"
            :key="conflict.id"
            @click="goToConflictDetail(conflict.id)"
            class="p-3 bg-slate-dark/50 rounded-lg border border-slate-mid/30 hover:border-neon-purple/50 cursor-pointer transition-all duration-200"
          >
            <div class="flex items-start justify-between mb-2">
              <span class="text-sm font-medium text-white line-clamp-1">{{ conflict.description }}</span>
              <StatusBadge :status="conflict.severity" type="severity" size="sm" />
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-light">{{ getConflictTypeText(conflict.type) }}</span>
              <span :class="getTimeAgo(conflict.detectedAt).color">{{ getTimeAgo(conflict.detectedAt).text }}</span>
            </div>
          </div>
          <div v-if="recentConflicts.length === 0" class="text-center py-8 text-slate-light">
            {{ t('dashboard.noConflicts') }}
          </div>
        </div>
        <button
          @click="router.push('/conflicts')"
          class="w-full mt-4 btn-secondary text-sm"
        >
          {{ t('dashboard.viewAll') }}
        </button>
      </div>

      <div class="glass-card p-6">
        <h2 class="section-title">
          <Zap class="w-5 h-5 text-warning-amber" />
          {{ t('dashboard.severityDistribution') }}
        </h2>
        <div ref="typeChartRef" class="w-full h-64"></div>
        <div class="grid grid-cols-2 gap-3 mt-4">
          <div class="p-3 bg-danger-red/10 rounded-lg border border-danger-red/20">
            <div class="text-2xl font-bold text-danger-red">{{ conflictStore.stats.critical }}</div>
            <div class="text-xs text-slate-light">{{ t('dashboard.critical') }}</div>
          </div>
          <div class="p-3 bg-alert-orange/10 rounded-lg border border-alert-orange/20">
            <div class="text-2xl font-bold text-alert-orange">{{ conflictStore.stats.high }}</div>
            <div class="text-xs text-slate-light">{{ t('dashboard.high') }}</div>
          </div>
          <div class="p-3 bg-warning-amber/10 rounded-lg border border-warning-amber/20">
            <div class="text-2xl font-bold text-warning-amber">{{ conflictStore.stats.medium }}</div>
            <div class="text-xs text-slate-light">{{ t('dashboard.medium') }}</div>
          </div>
          <div class="p-3 bg-info-blue/10 rounded-lg border border-info-blue/20">
            <div class="text-2xl font-bold text-info-blue">{{ conflictStore.stats.low }}</div>
            <div class="text-xs text-slate-light">{{ t('dashboard.low') }}</div>
          </div>
        </div>
      </div>

      <div class="glass-card p-6">
        <h2 class="section-title">
          <Activity class="w-5 h-5 text-cyber-teal" />
          {{ t('dashboard.realtimeSensorData') }}
        </h2>
        <div class="space-y-3 max-h-96 overflow-y-auto">
          <div
            v-for="data in recentSensorData"
            :key="data.id"
            class="p-3 bg-slate-dark/50 rounded-lg border border-slate-mid/30"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium text-white">{{ deviceStore.getDeviceById(data.deviceId)?.name || data.deviceId }}</span>
              <span class="text-xs text-slate-mid">{{ data.sensorType }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-lg font-bold text-neon-purple">
                {{ typeof data.value === 'number' ? data.value : (data.value ? t('dashboard.on') : t('dashboard.off')) }}
                <span class="text-xs font-normal text-slate-light ml-1">{{ data.unit }}</span>
              </span>
              <span class="text-xs text-slate-mid">{{ formatTime(data.timestamp) }}</span>
            </div>
            <div class="mt-2">
              <div class="text-xs text-slate-light">{{ data.location }}</div>
            </div>
          </div>
          <div v-if="recentSensorData.length === 0" class="text-center py-8 text-slate-light">
            {{ t('dashboard.waitingSensorData') }}
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="glass-card p-6">
        <h2 class="section-title">
          <Shield class="w-5 h-5 text-alert-orange" />
          {{ t('dashboard.securityStatus') }}
        </h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="p-4 bg-slate-dark/50 rounded-lg border border-slate-mid/30">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-2 h-2 rounded-full bg-success-green animate-pulse"></div>
              <span class="text-sm text-slate-light">{{ t('dashboard.armedStatus') }}</span>
            </div>
            <div class="text-xl font-bold text-white">{{ conflictStore.securityState.armed ? t('dashboard.armed') : t('dashboard.disarmed') }}</div>
          </div>
          <div class="p-4 bg-slate-dark/50 rounded-lg border border-slate-mid/30">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-2 h-2 rounded-full bg-info-blue"></div>
              <span class="text-sm text-slate-light">{{ t('dashboard.currentScene') }}</span>
            </div>
            <div class="text-xl font-bold text-white">{{ semanticStore.activeScene?.name || t('dashboard.default') }}</div>
          </div>
          <div class="p-4 bg-slate-dark/50 rounded-lg border border-slate-mid/30">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-2 h-2 rounded-full bg-success-green"></div>
              <span class="text-sm text-slate-light">{{ t('dashboard.onlineDevices') }}</span>
            </div>
            <div class="text-xl font-bold text-white">{{ deviceStore.securityDevices.filter(d => d.status === 'online').length }}</div>
          </div>
          <div class="p-4 bg-slate-dark/50 rounded-lg border border-slate-mid/30">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-2 h-2 rounded-full bg-warning-amber"></div>
              <span class="text-sm text-slate-light">{{ t('dashboard.alertLevel') }}</span>
            </div>
            <div class="text-xl font-bold text-white capitalize">{{ conflictStore.securityState.alertLevel }}</div>
          </div>
        </div>
      </div>

      <div class="glass-card p-6">
        <h2 class="section-title">
          <Home class="w-5 h-5 text-info-blue" />
          {{ t('dashboard.smartHomeStatus') }}
        </h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="p-4 bg-slate-dark/50 rounded-lg border border-slate-mid/30">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-2 h-2 rounded-full bg-success-green"></div>
              <span class="text-sm text-slate-light">{{ t('dashboard.airconStatus') }}</span>
            </div>
            <div class="text-xl font-bold text-white">
              {{ conflictStore.homeControlState.airConditioning.running ? t('dashboard.running') : t('dashboard.closed') }}
            </div>
            <div class="text-xs text-slate-mid mt-1">
              {{ t('dashboard.target') }} {{ conflictStore.homeControlState.airConditioning.targetTemperature }}°C
            </div>
          </div>
          <div class="p-4 bg-slate-dark/50 rounded-lg border border-slate-mid/30">
            <div class="flex items-center gap-2 mb-2">
              <div :class="['w-2 h-2 rounded-full', conflictStore.homeControlState.energySaving.enabled ? 'bg-success-green' : 'bg-slate-mid']"></div>
              <span class="text-sm text-slate-light">{{ t('dashboard.energySaving') }}</span>
            </div>
            <div class="text-xl font-bold text-white">
              {{ conflictStore.homeControlState.energySaving.enabled ? t('dashboard.enabled') : t('dashboard.disabled') }}
            </div>
          </div>
          <div class="p-4 bg-slate-dark/50 rounded-lg border border-slate-mid/30">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-2 h-2 rounded-full bg-success-green"></div>
              <span class="text-sm text-slate-light">{{ t('dashboard.onlineDevices') }}</span>
            </div>
            <div class="text-xl font-bold text-white">{{ deviceStore.homeControlDevices.filter(d => d.status === 'online').length }}</div>
          </div>
          <div class="p-4 bg-slate-dark/50 rounded-lg border border-slate-mid/30">
            <div class="flex items-center gap-2 mb-2">
              <Clock class="w-3 h-3 text-slate-mid" />
              <span class="text-sm text-slate-light">{{ t('dashboard.avgResolutionTime') }}</span>
            </div>
            <div class="text-xl font-bold text-white">
              {{ formatDuration(conflictStore.stats.avgResolutionTime) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
