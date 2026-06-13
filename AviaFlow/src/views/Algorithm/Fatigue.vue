<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAlgorithmStore } from '../../stores/algorithm';
import { useFatigueAssessment } from '../../composables/useFatigueAssessment';
import FatigueEvolutionChart from '../../components/charts/FatigueEvolutionChart.vue';
import type { CrewMember } from '../../types/crew';
import { User, Clock, AlertTriangle, Brain, Zap, Moon, Activity, TrendingUp, TrendingDown, Heart } from 'lucide-vue-next';
import { getRiskColor, getRiskLabel } from '../../types/algorithm';
import { getFlightDutiesByCrew } from '../../database/stores/scheduleStore';
import { getPhysiologicalDataByCrew } from '../../database/stores/physiologicalStore';
import { getFatigueAssessmentsByCrew } from '../../database/stores/fatigueStore';
import dayjs from 'dayjs';

const algorithmStore = useAlgorithmStore();

const selectedCrew = ref<CrewMember | null>(null);
const simulationDays = ref(14);

const {
  currentAssessment,
  reactionTimePrediction,
  evolutionData,
  isLoading,
  assessFatigue,
  predictReactionTime,
  simulateEvolution,
} = useFatigueAssessment();

const factors = computed(() => {
  if (!currentAssessment.value) return [];
  return [
    { name: '时差效应', score: currentAssessment.value.factors.jetlag, icon: Clock },
    { name: '睡眠负债', score: currentAssessment.value.factors.sleepDebt, icon: Moon },
    { name: '疲劳累积', score: currentAssessment.value.factors.fatigueAccumulation, icon: Activity },
    { name: 'HRV影响', score: currentAssessment.value.factors.hrvInfluence, icon: Heart },
    { name: '压力水平', score: currentAssessment.value.factors.stressInfluence, icon: Brain },
    { name: '生物节律', score: currentAssessment.value.factors.biorhythmInfluence, icon: TrendingUp },
  ];
});

const loadAnalysis = async (crew: CrewMember) => {
  selectedCrew.value = crew;
  algorithmStore.selectCrew(crew.id);
  
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const physiologicalData = await getPhysiologicalDataByCrew(crew.id, ninetyDaysAgo);
  const upcomingDuties = await getFlightDutiesByCrew(crew.id, new Date().toISOString(), thirtyDaysLater);
  const historicalAssessments = await getFatigueAssessmentsByCrew(crew.id, ninetyDaysAgo, new Date().toISOString());
  
  await assessFatigue(crew.id, crew.birthDate, physiologicalData, upcomingDuties, historicalAssessments);
  await predictReactionTime(300, physiologicalData, upcomingDuties, crew.birthDate);
  await simulateEvolution(crew.id, crew.birthDate, physiologicalData, upcomingDuties, simulationDays.value);
  
  await algorithmStore.loadFatigueAssessment(crew.id, 90, 30);
};

watch(simulationDays, async () => {
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
        <div v-if="selectedCrew && currentAssessment">
          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 mb-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="text-xl font-bold text-slate-100 mb-1">{{ selectedCrew.name }} 的疲劳评估</h2>
                <p class="text-sm text-slate-500">
                  基于异步生物节律反馈算法的多维度综合评估 · 评估时间: {{ dayjs(currentAssessment.assessmentTimestamp).format('YYYY年MM月DD日 HH:mm') }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-slate-400">仿真周期:</span>
                <select
                  v-model="simulationDays"
                  class="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
                >
                  <option :value="7">7天</option>
                  <option :value="14">14天</option>
                  <option :value="21">21天</option>
                  <option :value="30">30天</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div
                class="bg-slate-700/30 rounded-xl p-4"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Activity class="w-4 h-4 text-slate-400" />
                  <span class="text-sm text-slate-400">疲劳评分</span>
                </div>
                <div
                  class="text-4xl font-bold"
                  :style="{ color: getRiskColor(currentAssessment.riskLevel) }"
                >
                  {{ currentAssessment.fatigueScore.toFixed(0) }}
                </div>
                <div class="text-xs mt-1">
                  <span
                    class="px-2 py-0.5 rounded-full"
                    :style="{ backgroundColor: `${getRiskColor(currentAssessment.riskLevel)}20`, color: getRiskColor(currentAssessment.riskLevel) }"
                  >
                    {{ getRiskLabel(currentAssessment.riskLevel) }}
                  </span>
                </div>
              </div>
              <div
                class="bg-slate-700/30 rounded-xl p-4"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Zap class="w-4 h-4 text-purple-400" />
                  <span class="text-sm text-slate-400">当前反应时</span>
                </div>
                <div class="text-4xl font-bold text-purple-400">
                  {{ reactionTimePrediction?.currentReactionTime.toFixed(0) || '--' }}
                </div>
                <div class="text-xs mt-1 text-slate-500">
                  基准: {{ reactionTimePrediction?.baselineReactionTime || 300 }}ms
                </div>
              </div>
              <div
                class="bg-slate-700/30 rounded-xl p-4"
              >
                <div class="flex items-center gap-2 mb-2">
                  <TrendingUp class="w-4 h-4 text-red-400" />
                  <span class="text-sm text-slate-400">预测峰值</span>
                </div>
                <div class="text-4xl font-bold text-red-400">
                  {{ reactionTimePrediction?.predictedPeak.toFixed(0) || '--' }}
                </div>
                <div class="text-xs mt-1 text-slate-500">
                  {{ reactionTimePrediction?.peakDate ? dayjs(reactionTimePrediction.peakDate).format('MM月DD日') : '--' }}
                </div>
              </div>
              <div
                class="bg-slate-700/30 rounded-xl p-4"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Clock class="w-4 h-4 text-blue-400" />
                  <span class="text-sm text-slate-400">预计恢复</span>
                </div>
                <div class="text-4xl font-bold text-blue-400">
                  {{ reactionTimePrediction?.estimatedRecoveryDays || '--' }}
                </div>
                <div class="text-xs mt-1 text-slate-500">
                  天后恢复至基准水平
                </div>
              </div>
            </div>

            <div class="bg-slate-700/30 rounded-xl p-4">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-slate-300">疲劳风险评分</span>
                <span
                  class="text-lg font-bold"
                  :style="{ color: getRiskColor(currentAssessment.riskLevel) }"
                >
                  {{ currentAssessment.fatigueScore.toFixed(1) }} / 100
                </span>
              </div>
              <div class="h-4 bg-slate-600/50 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-1000"
                  :style="{
                    width: `${currentAssessment.fatigueScore}%`,
                    background: `linear-gradient(to right, #22c55e, #eab308 40%, #f97316 65%, #ef4444)`,
                  }"
                ></div>
              </div>
              <div class="flex justify-between text-xs text-slate-500 mt-1">
                <span>低风险 30</span>
                <span>中风险 55</span>
                <span>高风险 75</span>
                <span>临界风险</span>
              </div>
            </div>
          </div>

          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 mb-6">
            <h3 class="text-lg font-semibold text-slate-100 mb-4">疲劳演化趋势仿真</h3>
            <p class="text-sm text-slate-500 mb-4">
              基于历史生理数据和未来排班计划，通过异步生物节律反馈算法仿真未来{{ simulationDays }}天的疲劳度变化趋势。
            </p>
            <FatigueEvolutionChart v-if="evolutionData.length > 0" :data="evolutionData" height="400px" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
              <h3 class="text-lg font-semibold text-slate-100 mb-4">疲劳因子分解</h3>
              <div class="space-y-3">
                <div v-for="factor in factors" :key="factor.name">
                  <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                      <component :is="factor.icon" class="w-4 h-4 text-slate-400" />
                      <span class="text-sm text-slate-300">{{ factor.name }}</span>
                    </div>
                    <span
                      class="text-sm font-medium"
                      :class="factor.score > 25 ? 'text-red-400' : factor.score > 15 ? 'text-amber-400' : 'text-green-400'"
                    >
                      {{ factor.score.toFixed(1) }}
                    </span>
                  </div>
                  <div class="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-700"
                      :class="factor.score > 25 ? 'bg-red-500' : factor.score > 15 ? 'bg-amber-500' : 'bg-green-500'"
                      :style="{ width: `${factor.score}%` }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
              <h3 class="text-lg font-semibold text-slate-100 mb-4">排班建议</h3>
              <div class="space-y-3">
                <div
                  v-if="currentAssessment.riskLevel === 'critical' || currentAssessment.riskLevel === 'high'"
                  class="flex items-start gap-3 p-3 bg-red-900/20 rounded-xl border border-red-500/30"
                >
                  <AlertTriangle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium text-red-400 mb-1">不建议安排飞行任务</div>
                    <p class="text-sm text-slate-400">
                      当前疲劳风险过高，建议立即安排休息，48小时内不安排任何飞行任务。
                    </p>
                  </div>
                </div>
                <div
                  v-else-if="currentAssessment.riskLevel === 'medium'"
                  class="flex items-start gap-3 p-3 bg-amber-900/20 rounded-xl border border-amber-500/30"
                >
                  <AlertTriangle class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium text-amber-400 mb-1">限制飞行任务类型</div>
                    <p class="text-sm text-slate-400">
                      可安排短途国内航线，避免跨时区长航线和夜航任务。
                    </p>
                  </div>
                </div>
                <div
                  v-else
                  class="flex items-start gap-3 p-3 bg-green-900/20 rounded-xl border border-green-500/30"
                >
                  <TrendingUp class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium text-green-400 mb-1">可正常排班</div>
                    <p class="text-sm text-slate-400">
                      疲劳状态良好，可执行包括跨洲际在内的各类飞行任务。
                    </p>
                  </div>
                </div>
                <div class="flex items-start gap-3 p-3 bg-blue-900/20 rounded-xl border border-blue-500/30">
                  <Clock class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium text-blue-400 mb-1">建议休息安排</div>
                    <p class="text-sm text-slate-400">
                      每次长航线飞行后至少安排48小时休息，跨6个时区以上飞行需额外增加24小时休息。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
            <h3 class="text-lg font-semibold text-slate-100 mb-4">跨时区飞行反应时影响评估</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="bg-slate-700/30 rounded-xl p-4 text-center">
                <div class="text-3xl font-bold text-green-400 mb-2">+12%</div>
                <div class="text-sm text-slate-400">时差2-4小时<br>反应时增加</div>
              </div>
              <div class="bg-slate-700/30 rounded-xl p-4 text-center">
                <div class="text-3xl font-bold text-amber-400 mb-2">+25%</div>
                <div class="text-sm text-slate-400">时差4-6小时<br>反应时增加</div>
              </div>
              <div class="bg-slate-700/30 rounded-xl p-4 text-center">
                <div class="text-3xl font-bold text-red-400 mb-2">+42%</div>
                <div class="text-sm text-slate-400">时差6小时以上<br>反应时增加</div>
              </div>
            </div>
            <div class="mt-4 p-4 bg-slate-700/20 rounded-xl">
              <p class="text-sm text-slate-300">
                <span class="text-blue-400 font-medium">研究发现：</span>
                跨时区飞行导致的反应时增加具有累积效应。连续执行3次以上跨时区飞行任务后，
                即使经过常规休息，反应时仍比基线水平高出15-20%。建议采用"向西飞行为主"的排班策略，
                因为向西飞行的生物节律调整时间平均比向东飞行缩短40%。
              </p>
            </div>
          </div>
        </div>

        <div v-else class="flex items-center justify-center h-96 text-slate-500">
          请从左侧选择一名机组人员进行疲劳评估
        </div>
      </div>
    </div>
  </div>
</template>
