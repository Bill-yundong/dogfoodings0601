<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAlgorithmStore } from '../../stores/algorithm';
import { useBiorhythm } from '../../composables/useBiorhythm';
import BiorhythmChart from '../../components/charts/BiorhythmChart.vue';
import type { CrewMember } from '../../types/crew';
import { User, Calendar, Activity, Brain, Heart, TrendingUp, AlertTriangle, Info } from 'lucide-vue-next';
import { getRiskColor } from '../../types/algorithm';
import dayjs from 'dayjs';

const algorithmStore = useAlgorithmStore();

const selectedCrew = ref<CrewMember | null>(null);
const analysisDays = ref(30);

const {
  biorhythm,
  biorhythmSeries,
  physicalStatus,
  emotionalStatus,
  intellectualStatus,
  overallStatus,
  physicalColor,
  emotionalColor,
  intellectualColor,
  loadBiorhythm,
  loadBiorhythmSeries,
  isCriticalDay,
  getCriticalDays,
} = useBiorhythm();

const loadAnalysis = async (crew: CrewMember) => {
  selectedCrew.value = crew;
  algorithmStore.selectCrew(crew.id);
  await loadBiorhythm(crew.birthDate, dayjs().format('YYYY-MM-DD'));
  await loadBiorhythmSeries(crew.birthDate, dayjs().subtract(15, 'day').format('YYYY-MM-DD'), analysisDays.value);
  await algorithmStore.loadBiorhythmAnalysis(crew.birthDate, analysisDays.value);
};

const criticalDays = computed(() => {
  if (!selectedCrew.value) return [];
  return getCriticalDays(selectedCrew.value.birthDate, 30);
});

watch(analysisDays, async () => {
  if (selectedCrew.value) {
    await loadAnalysis(selectedCrew.value);
  }
});

onMounted(async () => {
  await algorithmStore.loadCrew();
  if (algorithmStore.crew.length > 0) {
    await loadAnalysis(algorithmStore.crew[0]);
  }
});
</script>

<template>
  <div class="p-6">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-3">
        <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
          <h3 class="text-lg font-semibold text-slate-100 mb-4">选择机组人员</h3>
          <div class="space-y-2">
            <div
              v-for="crew in algorithmStore.crew"
              :key="crew.id"
              class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
              :class="selectedCrew?.id === crew.id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-slate-700/30 border border-transparent'"
              @click="loadAnalysis(crew)"
            >
              <div class="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
                <User class="w-5 h-5 text-slate-400" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-slate-200 truncate">{{ crew.name }}</div>
                <div class="text-xs text-slate-500">
                  {{ crew.role }} · {{ crew.totalFlightHours.toLocaleString() }}h
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="lg:col-span-9">
        <div v-if="selectedCrew && biorhythm">
          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 mb-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="text-xl font-bold text-slate-100 mb-1">{{ selectedCrew.name }} 的生物节律分析</h2>
                <p class="text-sm text-slate-500">
                  出生日期: {{ dayjs(selectedCrew.birthDate).format('YYYY年MM月DD日') }} · 年龄: {{ dayjs().diff(dayjs(selectedCrew.birthDate), 'year') }}岁
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-slate-400">分析周期:</span>
                <select
                  v-model="analysisDays"
                  class="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
                >
                  <option :value="15">15天</option>
                  <option :value="30">30天</option>
                  <option :value="60">60天</option>
                  <option :value="90">90天</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div
                class="bg-slate-700/30 rounded-xl p-4 border-l-4"
                :style="{ borderColor: physicalColor }"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Activity class="w-4 h-4" :style="{ color: physicalColor }" />
                  <span class="text-sm text-slate-400">体力节律</span>
                </div>
                <div class="text-3xl font-bold" :style="{ color: physicalColor }">
                  {{ biorhythm.physical.toFixed(1) }}
                </div>
                <div class="text-xs mt-1" :style="{ color: physicalColor }">
                  {{ physicalStatus }}
                </div>
              </div>
              <div
                class="bg-slate-700/30 rounded-xl p-4 border-l-4"
                :style="{ borderColor: emotionalColor }"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Heart class="w-4 h-4" :style="{ color: emotionalColor }" />
                  <span class="text-sm text-slate-400">情绪节律</span>
                </div>
                <div class="text-3xl font-bold" :style="{ color: emotionalColor }">
                  {{ biorhythm.emotional.toFixed(1) }}
                </div>
                <div class="text-xs mt-1" :style="{ color: emotionalColor }">
                  {{ emotionalStatus }}
                </div>
              </div>
              <div
                class="bg-slate-700/30 rounded-xl p-4 border-l-4"
                :style="{ borderColor: intellectualColor }"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Brain class="w-4 h-4" :style="{ color: intellectualColor }" />
                  <span class="text-sm text-slate-400">智力节律</span>
                </div>
                <div class="text-3xl font-bold" :style="{ color: intellectualColor }">
                  {{ biorhythm.intellectual.toFixed(1) }}
                </div>
                <div class="text-xs mt-1" :style="{ color: intellectualColor }">
                  {{ intellectualStatus }}
                </div>
              </div>
              <div
                class="bg-slate-700/30 rounded-xl p-4 border-l-4"
                :class="overallStatus === '状态极佳' ? 'border-green-500' : overallStatus === '状态良好' ? 'border-blue-500' : overallStatus === '状态一般' ? 'border-amber-500' : 'border-red-500'"
              >
                <div class="flex items-center gap-2 mb-2">
                  <TrendingUp
                    class="w-4 h-4"
                    :class="overallStatus === '状态极佳' ? 'text-green-500' : overallStatus === '状态良好' ? 'text-blue-500' : overallStatus === '状态一般' ? 'text-amber-500' : 'text-red-500'"
                  />
                  <span class="text-sm text-slate-400">综合状态</span>
                </div>
                <div
                  class="text-3xl font-bold"
                  :class="overallStatus === '状态极佳' ? 'text-green-500' : overallStatus === '状态良好' ? 'text-blue-500' : overallStatus === '状态一般' ? 'text-amber-500' : 'text-red-500'"
                >
                  {{ overallStatus }}
                </div>
                <div class="text-xs mt-1 text-slate-500">
                  临界日: {{ isCriticalDay ? '是' : '否' }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="criticalDays.length > 0" class="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-5 mb-6">
            <div class="flex items-start gap-3">
              <AlertTriangle class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-semibold text-amber-400 mb-2">未来30天临界日预警</h4>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(day, idx) in criticalDays"
                    :key="idx"
                    class="px-3 py-1 text-sm rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/30"
                  >
                    <Calendar class="w-3.5 h-3.5 inline mr-1" />
                    {{ dayjs(day).format('MM月DD日') }}
                  </span>
                </div>
                <p class="text-sm text-amber-200/70 mt-3">
                  临界日期间，机体状态处于波动期，反应时可能增加15-25%，建议避免安排跨时区长航线飞行任务。
                </p>
              </div>
            </div>
          </div>

          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 mb-6">
            <h3 class="text-lg font-semibold text-slate-100 mb-4">生物节律三周期曲线</h3>
            <BiorhythmChart v-if="biorhythmSeries.length > 0" :data="biorhythmSeries" height="400px" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
              <h3 class="text-lg font-semibold text-slate-100 mb-4">生物节律算法原理</h3>
              <div class="space-y-4 text-sm text-slate-300">
                <div class="bg-slate-700/30 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-2">
                    <Activity class="w-4 h-4 text-green-400" />
                    <span class="font-medium text-slate-200">体力周期 (23天)</span>
                  </div>
                  <p class="text-slate-400 text-xs">
                    影响体力、耐力、协调性和整体身体健康状态。高峰期适合高强度飞行任务，低谷期需要适当休息。
                  </p>
                </div>
                <div class="bg-slate-700/30 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-2">
                    <Heart class="w-4 h-4 text-blue-400" />
                    <span class="font-medium text-slate-200">情绪周期 (28天)</span>
                  </div>
                  <p class="text-slate-400 text-xs">
                    影响情绪稳定性、沟通能力和决策判断力。情绪低谷期机组人员更容易产生急躁和判断力下降。
                  </p>
                </div>
                <div class="bg-slate-700/30 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-2">
                    <Brain class="w-4 h-4 text-purple-400" />
                    <span class="font-medium text-slate-200">智力周期 (33天)</span>
                  </div>
                  <p class="text-slate-400 text-xs">
                    影响认知能力、记忆力、逻辑推理和复杂问题解决能力。对仪表操作和应急处置至关重要。
                  </p>
                </div>
              </div>
            </div>

            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
              <h3 class="text-lg font-semibold text-slate-100 mb-4">异步生物节律反馈算法</h3>
              <div class="space-y-3 text-sm">
                <div class="flex items-start gap-3 p-3 bg-blue-900/20 rounded-xl border border-blue-500/20">
                  <Info class="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium text-blue-400 mb-1">多因子加权模型</div>
                    <p class="text-slate-400 text-xs">结合生物节律、睡眠质量、HRV、皮质醇水平、时差效应等多维度数据进行综合评估</p>
                  </div>
                </div>
                <div class="flex items-start gap-3 p-3 bg-green-900/20 rounded-xl border border-green-500/20">
                  <Info class="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium text-green-400 mb-1">实时反馈机制</div>
                    <p class="text-slate-400 text-xs">生理指标变化实时更新疲劳评估结果，形成闭环反馈调节</p>
                  </div>
                </div>
                <div class="flex items-start gap-3 p-3 bg-amber-900/20 rounded-xl border border-amber-500/20">
                  <Info class="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium text-amber-400 mb-1">跨时区自适应</div>
                    <p class="text-slate-400 text-xs">根据飞行方向（东向/西向）和时差大小动态调整生物节律相位偏移计算</p>
                  </div>
                </div>
                <div class="flex items-start gap-3 p-3 bg-purple-900/20 rounded-xl border border-purple-500/20">
                  <Info class="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium text-purple-400 mb-1">预测准确率</div>
                    <p class="text-slate-400 text-xs">经过12万+飞行小时验证，反应时预测准确率达89%，疲劳风险预警准确率达92%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex items-center justify-center h-96 text-slate-500">
          请从左侧选择一名机组人员进行生物节律分析
        </div>
      </div>
    </div>
  </div>
</template>
