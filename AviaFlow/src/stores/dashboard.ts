import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { DashboardStats, FatigueHeatmapData } from '../database/queryEngine';
import { getDashboardStats, getFatigueHeatmap } from '../database/queryEngine';
import { getMedicalAlerts } from '../database/stores/medicalStore';
import type { MedicalAlert } from '../types/medical';

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<DashboardStats | null>(null);
  const heatmapData = ref<FatigueHeatmapData[]>([]);
  const alerts = ref<MedicalAlert[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<string | null>(null);

  const highRiskCount = computed(() => stats.value?.highRiskCrew ?? 0);
  const avgFatigue = computed(() => Math.round(stats.value?.avgFatigueScore ?? 0));
  const activeAlertsCount = computed(() => alerts.value.filter(a => !a.acknowledged).length);

  async function loadAllData() {
    loading.value = true;
    error.value = null;
    
    try {
      const [statsResult, heatmapResult, alertsResult] = await Promise.all([
        getDashboardStats(),
        getFatigueHeatmap(14),
        getMedicalAlerts(undefined, false),
      ]);
      
      stats.value = statsResult;
      heatmapData.value = heatmapResult;
      alerts.value = alertsResult;
      lastUpdated.value = new Date().toISOString();
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载数据失败';
      console.error('加载仪表盘数据失败:', e);
    } finally {
      loading.value = false;
    }
  }

  async function refreshStats() {
    try {
      stats.value = await getDashboardStats();
      lastUpdated.value = new Date().toISOString();
    } catch (e) {
      console.error('刷新统计数据失败:', e);
    }
  }

  async function refreshAlerts() {
    try {
      alerts.value = await getMedicalAlerts(undefined, false);
    } catch (e) {
      console.error('刷新预警数据失败:', e);
    }
  }

  async function loadHeatmap(days: number) {
    try {
      heatmapData.value = await getFatigueHeatmap(days);
    } catch (e) {
      console.error('加载热力图数据失败:', e);
    }
  }

  async function acknowledgeAlert(alertId: string) {
    try {
      const alert = alerts.value.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedBy = 'system';
        alert.acknowledgedAt = new Date().toISOString();
      }
    } catch (e) {
      console.error('确认预警失败:', e);
    }
  }

  async function loadStats() {
    await refreshStats();
  }

  async function loadAlerts() {
    await refreshAlerts();
  }

  return {
    stats,
    heatmapData,
    alerts,
    loading,
    error,
    lastUpdated,
    highRiskCount,
    avgFatigue,
    activeAlertsCount,
    loadAllData,
    refreshStats,
    refreshAlerts,
    loadHeatmap,
    acknowledgeAlert,
    loadStats,
    loadAlerts,
  };
});
