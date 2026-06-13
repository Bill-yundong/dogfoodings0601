<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AppLayout from '../../components/layout/AppLayout.vue';
import { getCrewCompleteProfile, getDatabaseStats, exportCrewData, exportAllData } from '../../database/queryEngine';
import { checkAndInitializeData } from '../../utils/mock';
import { clearAllData } from '../../database/schema';
import type { CrewCompleteProfile } from '../../database/queryEngine';
import { Database, User, FileText, Activity, Plane, Download, HardDrive, Clock, Calendar, Trash2, AlertTriangle } from 'lucide-vue-next';
import { getRiskColor } from '../../types/algorithm';
import dayjs from 'dayjs';

const selectedCrew = ref<CrewCompleteProfile | null>(null);
const dbStats = ref<any>(null);
const allProfiles = ref<CrewCompleteProfile[]>([]);
const isExporting = ref(false);
const isClearing = ref(false);
const activeTab = ref<'overview' | 'profiles' | 'storage'>('overview');
const showClearConfirm = ref(false);
const clearType = ref<'30d' | 'reset'>('30d');

const loadData = async () => {
  await checkAndInitializeData();
  dbStats.value = await getDatabaseStats();
  
  const profiles: CrewCompleteProfile[] = [];
  for (const stat of dbStats.value.crewStats) {
    const profile = await getCrewCompleteProfile(stat.crewId);
    if (profile) profiles.push(profile);
  }
  allProfiles.value = profiles;
};

const handleExport = async (crewId: string, format: 'json' | 'csv') => {
  isExporting.value = true;
  try {
    const data = await exportCrewData(crewId, format);
    const blob = new Blob([data as any], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aviaflow-crew-${crewId.slice(0, 8)}-${dayjs().format('YYYYMMDD')}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    isExporting.value = false;
  }
};

const handleExportAll = async () => {
  isExporting.value = true;
  try {
    const data = await exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aviaflow-backup-${dayjs().format('YYYYMMDD-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    isExporting.value = false;
  }
};

const confirmClear = (type: '30d' | 'reset') => {
  clearType.value = type;
  showClearConfirm.value = true;
};

const handleClear = async () => {
  isClearing.value = true;
  try {
    if (clearType.value === '30d') {
      const thirtyDaysAgo = dayjs().subtract(30, 'day').toISOString();
      const { deletePhysiologicalDataBefore } = await import('../../database/stores/physiologicalStore');
      await deletePhysiologicalDataBefore(thirtyDaysAgo);
    } else if (clearType.value === 'reset') {
      await clearAllData();
      await checkAndInitializeData();
    }
    await loadData();
  } finally {
    isClearing.value = false;
    showClearConfirm.value = false;
  }
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const storageBreakdown = computed(() => {
  if (!dbStats.value) return [];
  const total = dbStats.value.totalRecords;
  return [
    { name: '机组信息', count: dbStats.value.crewCount, color: '#3b82f6', icon: User },
    { name: '生理数据', count: dbStats.value.physiologicalCount, color: '#22c55e', icon: Activity },
    { name: '排班任务', count: dbStats.value.dutyCount, color: '#8b5cf6', icon: Plane },
    { name: '健康档案', count: dbStats.value.healthRecordCount, color: '#f59e0b', icon: FileText },
    { name: '疲劳评估', count: dbStats.value.fatigueAssessmentCount, color: '#ef4444', icon: Activity },
    { name: '同步日志', count: dbStats.value.syncLogCount, color: '#06b6d4', icon: Clock },
  ];
});

onMounted(async () => {
  await loadData();
});
</script>

<template>
  <AppLayout>
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-slate-100">机组工效学图谱数据库</h2>
          <p class="text-sm text-slate-500">IndexedDB 长周期数据存储与管理</p>
        </div>
        <div class="flex items-center gap-2">
          <Database class="w-5 h-5 text-blue-400" />
          <span class="text-sm text-slate-400">AviaFlow DB v1.0</span>
        </div>
      </div>

      <div class="flex items-center gap-2 mb-6 border-b border-slate-700/50">
        <button
          v-for="tab in [{ key: 'overview', label: '总览' }, { key: 'profiles', label: '机组档案' }, { key: 'storage', label: '存储管理' }]"
          :key="tab.key"
          @click="activeTab = tab.key as any"
          class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
          :class="activeTab === tab.key ? 'text-blue-400 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="activeTab === 'overview' && dbStats">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
            <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <HardDrive class="w-4 h-4" />
              <span>总记录数</span>
            </div>
            <div class="text-3xl font-bold text-slate-100">{{ dbStats.totalRecords.toLocaleString() }}</div>
            <div class="text-xs text-slate-500 mt-1">{{ formatBytes(dbStats.totalSizeBytes) }}</div>
          </div>
          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
            <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <User class="w-4 h-4" />
              <span>机组人员</span>
            </div>
            <div class="text-3xl font-bold text-blue-400">{{ dbStats.crewCount }}</div>
            <div class="text-xs text-slate-500 mt-1">含资质档案</div>
          </div>
          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
            <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Activity class="w-4 h-4" />
              <span>生理数据点</span>
            </div>
            <div class="text-3xl font-bold text-green-400">{{ dbStats.physiologicalCount.toLocaleString() }}</div>
            <div class="text-xs text-slate-500 mt-1">90天历史</div>
          </div>
          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
            <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Calendar class="w-4 h-4" />
              <span>数据周期</span>
            </div>
            <div class="text-3xl font-bold text-purple-400">{{ dbStats.dateRangeDays }}</div>
            <div class="text-xs text-slate-500 mt-1">天可追溯</div>
          </div>
        </div>

        <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 mb-6">
          <h3 class="text-lg font-semibold text-slate-100 mb-4">数据存储分布</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div
              v-for="item in storageBreakdown"
              :key="item.name"
              class="bg-slate-700/30 rounded-xl p-4 text-center"
            >
              <div
                class="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                :style="{ backgroundColor: `${item.color}20` }"
              >
                <component :is="item.icon" class="w-6 h-6" :style="{ color: item.color }" />
              </div>
              <div class="text-2xl font-bold text-slate-100">{{ item.count.toLocaleString() }}</div>
              <div class="text-xs text-slate-500">{{ item.name }}</div>
              <div class="text-xs mt-1" :style="{ color: item.color }">
                {{ ((item.count / dbStats.totalRecords) * 100).toFixed(1) }}%
              </div>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-500/30 rounded-2xl p-5">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl bg-blue-600/30 flex items-center justify-center flex-shrink-0">
              <Database class="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 class="font-semibold text-blue-400 mb-2">IndexedDB 长周期存储引擎</h3>
              <p class="text-sm text-slate-300 mb-3">
                采用浏览器端 IndexedDB 存储技术，支持离线存储180天以上的机组工效学数据。
                数据采用结构化存储，包含10个对象存储空间，支持复杂查询和多维度数据分析。
              </p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div class="bg-slate-800/50 rounded-lg p-3">
                  <div class="text-xs text-slate-500 mb-1">存储容量</div>
                  <div class="text-sm font-medium text-slate-200">最大 500MB</div>
                </div>
                <div class="bg-slate-800/50 rounded-lg p-3">
                  <div class="text-xs text-slate-500 mb-1">查询性能</div>
                  <div class="text-sm font-medium text-slate-200">毫秒级响应</div>
                </div>
                <div class="bg-slate-800/50 rounded-lg p-3">
                  <div class="text-xs text-slate-500 mb-1">数据加密</div>
                  <div class="text-sm font-medium text-slate-200">AES-256 可选</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'profiles'">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-1">
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
              <h3 class="text-lg font-semibold text-slate-100 mb-4">机组档案列表</h3>
              <div class="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
                <div
                  v-for="profile in allProfiles"
                  :key="profile.crew.id"
                  class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                  :class="selectedCrew?.crew.id === profile.crew.id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-slate-700/30 border border-transparent'"
                  @click="selectedCrew = profile"
                >
                  <div class="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
                    <User class="w-5 h-5 text-slate-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-slate-200 truncate">{{ profile.crew.name }}</div>
                    <div class="text-xs text-slate-500">
                      {{ profile.crew.role }}
                    </div>
                  </div>
                  <div
                    class="w-2.5 h-2.5 rounded-full"
                    :style="{ backgroundColor: getRiskColor(profile.latestFatigueAssessment?.riskLevel || 'low') }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div class="lg:col-span-2">
            <div v-if="selectedCrew" class="space-y-6">
              <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <h3 class="text-xl font-bold text-slate-100">{{ selectedCrew.crew.name }} 的完整档案</h3>
                    <p class="text-sm text-slate-500">工效学图谱完整数据视图</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      @click="handleExport(selectedCrew.crew.id, 'json')"
                      :disabled="isExporting"
                      class="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-lg text-sm text-slate-300 transition-colors disabled:opacity-50"
                    >
                      <Download class="w-4 h-4" />
                      JSON
                    </button>
                    <button
                      @click="handleExport(selectedCrew.crew.id, 'csv')"
                      :disabled="isExporting"
                      class="flex items-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-sm text-blue-400 transition-colors disabled:opacity-50"
                    >
                      <Download class="w-4 h-4" />
                      CSV
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div class="bg-slate-700/30 rounded-xl p-4">
                    <div class="text-xs text-slate-500 mb-1">生理数据</div>
                    <div class="text-2xl font-bold text-green-400">{{ selectedCrew.physiologicalData.length }}</div>
                    <div class="text-xs text-slate-500">条记录</div>
                  </div>
                  <div class="bg-slate-700/30 rounded-xl p-4">
                    <div class="text-xs text-slate-500 mb-1">排班任务</div>
                    <div class="text-2xl font-bold text-purple-400">{{ selectedCrew.flightDuties.length }}</div>
                    <div class="text-xs text-slate-500">个航班</div>
                  </div>
                  <div class="bg-slate-700/30 rounded-xl p-4">
                    <div class="text-xs text-slate-500 mb-1">健康档案</div>
                    <div class="text-2xl font-bold text-amber-400">{{ selectedCrew.healthRecords.length }}</div>
                    <div class="text-xs text-slate-500">份记录</div>
                  </div>
                  <div class="bg-slate-700/30 rounded-xl p-4">
                    <div class="text-xs text-slate-500 mb-1">疲劳评估</div>
                    <div class="text-2xl font-bold text-red-400">{{ selectedCrew.fatigueAssessments.length }}</div>
                    <div class="text-xs text-slate-500">次评估</div>
                  </div>
                </div>
              </div>

              <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
                <h4 class="font-semibold text-slate-200 mb-3">基本信息</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span class="text-slate-500">出生日期</span>
                    <div class="text-slate-200">{{ dayjs(selectedCrew.crew.birthDate).format('YYYY年MM月DD日') }}</div>
                  </div>
                  <div>
                    <span class="text-slate-500">总飞行时间</span>
                    <div class="text-slate-200">{{ selectedCrew.crew.totalFlightHours.toLocaleString() }} 小时</div>
                  </div>
                  <div>
                    <span class="text-slate-500">资质认证</span>
                    <div class="text-slate-200">{{ selectedCrew.crew.qualifications.typeRatings.join(', ') }}</div>
                  </div>
                  <div>
                    <span class="text-slate-500">当前状态</span>
                    <div class="text-slate-200">{{ selectedCrew.crew.status === 'active' ? '执勤中' : selectedCrew.crew.status === 'rest' ? '休息中' : selectedCrew.crew.status === 'medical_leave' ? '病假' : '停飞' }}</div>
                  </div>
                </div>
              </div>

              <div v-if="selectedCrew.latestFatigueAssessment" class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
                <h4 class="font-semibold text-slate-200 mb-3">最新疲劳评估</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span class="text-slate-500">疲劳评分</span>
                    <div
                      class="text-2xl font-bold"
                      :style="{ color: getRiskColor(selectedCrew.latestFatigueAssessment.riskLevel) }"
                    >
                      {{ selectedCrew.latestFatigueAssessment.fatigueScore.toFixed(0) }}
                    </div>
                  </div>
                  <div>
                    <span class="text-slate-500">风险等级</span>
                    <div
                      class="text-lg font-medium"
                      :style="{ color: getRiskColor(selectedCrew.latestFatigueAssessment.riskLevel) }"
                    >
                      {{ selectedCrew.latestFatigueAssessment.riskLevel === 'low' ? '低风险' : selectedCrew.latestFatigueAssessment.riskLevel === 'medium' ? '中风险' : selectedCrew.latestFatigueAssessment.riskLevel === 'high' ? '高风险' : '临界风险' }}
                    </div>
                  </div>
                  <div>
                    <span class="text-slate-500">反应时预测</span>
                    <div class="text-2xl font-bold text-purple-400">
                      {{ selectedCrew.latestFatigueAssessment.predictedReactionTime.toFixed(0) }}ms
                    </div>
                  </div>
                  <div>
                    <span class="text-slate-500">评估时间</span>
                    <div class="text-slate-200">
                      {{ dayjs(selectedCrew.latestFatigueAssessment.assessmentTimestamp).format('MM-DD HH:mm') }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
                <h4 class="font-semibold text-slate-200 mb-3">数据时间范围</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="text-slate-500">最早记录</span>
                    <div class="text-slate-200">
                      {{ selectedCrew.earliestDataDate ? dayjs(selectedCrew.earliestDataDate).format('YYYY年MM月DD日') : '--' }}
                    </div>
                  </div>
                  <div>
                    <span class="text-slate-500">最新记录</span>
                    <div class="text-slate-200">
                      {{ selectedCrew.latestDataDate ? dayjs(selectedCrew.latestDataDate).format('YYYY年MM月DD日 HH:mm') : '--' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="flex items-center justify-center h-96 text-slate-500">
              请从左侧选择一名机组人员查看完整档案
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'storage' && dbStats">
        <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 mb-6">
          <h3 class="text-lg font-semibold text-slate-100 mb-4">存储空间使用情况</h3>
          <div class="h-6 bg-slate-700/50 rounded-full overflow-hidden mb-4">
            <div
              class="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
              :style="{ width: `${Math.min((dbStats.totalSizeBytes / (500 * 1024 * 1024)) * 100, 100)}%` }"
            ></div>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-slate-500">已使用 {{ formatBytes(dbStats.totalSizeBytes) }}</span>
            <span class="text-slate-500">最大 500MB</span>
          </div>
        </div>

        <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
          <h3 class="text-lg font-semibold text-slate-100 mb-4">数据清理选项</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
              <div>
                <div class="font-medium text-slate-200">清理30天前的生理数据</div>
                <div class="text-sm text-slate-500">保留最近30天的高频率生理监测数据</div>
              </div>
              <button
                @click="confirmClear('30d')"
                :disabled="isClearing"
                class="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-lg text-sm text-amber-400 transition-colors disabled:opacity-50"
              >
                <Trash2 class="w-4 h-4" />
                清理
              </button>
            </div>
            <div class="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
              <div>
                <div class="font-medium text-slate-200">导出全部数据备份</div>
                <div class="text-sm text-slate-500">将所有数据导出为 JSON 格式备份</div>
              </div>
              <button
                @click="handleExportAll"
                :disabled="isExporting"
                class="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-sm text-blue-400 transition-colors disabled:opacity-50"
              >
                <Download class="w-4 h-4" />
                导出
              </button>
            </div>
            <div class="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
              <div>
                <div class="font-medium text-slate-200">重置数据库</div>
                <div class="text-sm text-slate-500">清空所有数据并重新生成仿真数据</div>
              </div>
              <button
                @click="confirmClear('reset')"
                :disabled="isClearing"
                class="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors disabled:opacity-50"
              >
                <AlertTriangle class="w-4 h-4" />
                重置
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showClearConfirm"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
        @click.self="showClearConfirm = false"
      >
        <div class="bg-slate-800 border border-slate-700/50 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-12 h-12 rounded-full flex items-center justify-center"
              :class="clearType === 'reset' ? 'bg-red-600/20' : 'bg-amber-600/20'"
            >
              <AlertTriangle
                class="w-6 h-6"
                :class="clearType === 'reset' ? 'text-red-400' : 'text-amber-400'"
              />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-100">
                {{ clearType === 'reset' ? '重置数据库' : '清理数据确认' }}
              </h3>
              <p class="text-sm text-slate-500">此操作不可撤销</p>
            </div>
          </div>
          
          <p class="text-sm text-slate-300 mb-6">
            {{ clearType === 'reset' 
              ? '确定要重置所有数据吗？所有数据将被清空并重新生成仿真数据。'
              : '确定要清理30天前的生理数据吗？清理后将无法恢复。'
            }}
          </p>
          
          <div class="flex gap-3 justify-end">
            <button
              @click="showClearConfirm = false"
              :disabled="isClearing"
              class="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-lg text-sm text-slate-300 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              @click="handleClear"
              :disabled="isClearing"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              :class="clearType === 'reset' 
                ? 'bg-red-600 hover:bg-red-500 text-white' 
                : 'bg-amber-600 hover:bg-amber-500 text-white'"
            >
              <Trash2 v-if="isClearing" class="w-4 h-4 animate-spin" />
              {{ isClearing ? '处理中...' : '确认' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
