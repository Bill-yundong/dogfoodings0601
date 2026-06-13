<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useMedicalStore } from '../../stores/medical';
import { useSyncMechanism } from '../../composables/useSyncMechanism';
import CrewCard from '../../components/common/CrewCard.vue';
import PhysiologicalWaveform from '../../components/charts/PhysiologicalWaveform.vue';
import AlertCard from '../../components/common/AlertCard.vue';
import type { CrewMember } from '../../types/crew';
import { getLatestPhysiologicalData, getPhysiologicalStats } from '../../database/stores/physiologicalStore';
import { getLatestFatigueAssessment } from '../../database/stores/fatigueStore';
import type { PhysiologicalData } from '../../types/medical';
import type { FatigueAssessment } from '../../types/algorithm';
import { getRiskColor, getRiskLabel } from '../../types/algorithm';
import { Search, Filter, Activity, Heart, Brain, Moon, Zap } from 'lucide-vue-next';

const medicalStore = useMedicalStore();
const syncMechanism = useSyncMechanism();

const selectedCrew = ref<CrewMember | null>(null);
const physiologicalData = ref<PhysiologicalData[]>([]);
const latestAssessment = ref<FatigueAssessment | null>(null);
const searchQuery = ref('');
const selectedRole = ref('all');

const loadCrewDetail = async (crew: CrewMember) => {
  selectedCrew.value = crew;
  medicalStore.selectCrew(crew.id);
  await medicalStore.loadPhysiologicalData(crew.id, 90);
  physiologicalData.value = medicalStore.physiologicalData;
  latestAssessment.value = await getLatestFatigueAssessment(crew.id);
};

const filteredCrew = () => {
  return medicalStore.crew.filter(c => {
    const matchName = c.name.includes(searchQuery.value);
    const matchRole = selectedRole.value === 'all' || c.role === selectedRole.value;
    return matchName && matchRole;
  });
};

const getLatestAssessment = async (crewId: string) => {
  return await getLatestFatigueAssessment(crewId);
};

const getLatestData = async (crewId: string) => {
  const data = await getLatestPhysiologicalData(crewId);
  return data;
};

const handleAcknowledge = async (alertId: string) => {
  await medicalStore.acknowledgeAlert(alertId);
};

watch(() => medicalStore.selectedCrewId, async (newId) => {
  if (newId) {
    const crew = medicalStore.crew.find(c => c.id === newId);
    if (crew) {
      selectedCrew.value = crew;
      physiologicalData.value = medicalStore.physiologicalData;
      latestAssessment.value = await getLatestFatigueAssessment(newId);
    }
  }
});

onMounted(async () => {
  if (medicalStore.crew.length > 0) {
    await loadCrewDetail(medicalStore.crew[0]);
  }
});
</script>

<template>
  <div class="p-6">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-4 xl:col-span-3">
        <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 mb-4">
          <div class="mb-4">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索机组人员..."
                class="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>
          </div>
          <div class="flex gap-2 mb-4">
            <select
              v-model="selectedRole"
              class="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
            >
              <option value="all">全部角色</option>
              <option value="captain">机长</option>
              <option value="first_officer">副驾驶</option>
              <option value="purser">乘务长</option>
              <option value="flight_attendant">乘务员</option>
            </select>
            <button class="p-2 bg-slate-700/50 border border-slate-600/50 rounded-lg hover:bg-slate-600/50 transition-colors">
              <Filter class="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div class="text-xs text-slate-500 mb-3">共 {{ filteredCrew().length }} 名机组人员</div>
        </div>

        <div class="space-y-3 max-h-[calc(100vh-340px)] overflow-y-auto pr-2">
          <CrewCard
            v-for="crew in filteredCrew()"
            :key="crew.id"
            :crew="crew"
            :selected="selectedCrew?.id === crew.id"
            :latest-assessment="null"
            @select="loadCrewDetail"
          />
        </div>
      </div>

      <div class="lg:col-span-8 xl:col-span-9">
        <div v-if="selectedCrew" class="space-y-6">
          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
            <div class="flex items-start justify-between mb-4">
              <div>
                <div class="flex items-center gap-3 mb-2">
                  <h2 class="text-2xl font-bold text-slate-100">{{ selectedCrew.name }}</h2>
                  <span
                    v-if="latestAssessment"
                    class="px-3 py-1 text-sm rounded-full"
                    :style="{ backgroundColor: `${getRiskColor(latestAssessment.riskLevel)}20`, color: getRiskColor(latestAssessment.riskLevel) }"
                  >
                    {{ getRiskLabel(latestAssessment.riskLevel) }} · {{ latestAssessment.fatigueScore.toFixed(0) }}分
                  </span>
                </div>
                <div class="flex items-center gap-4 text-sm text-slate-400">
                  <span>{{ selectedCrew.role }}</span>
                  <span>·</span>
                  <span>总飞行时间 {{ selectedCrew.totalFlightHours.toLocaleString() }} 小时</span>
                  <span>·</span>
                  <span>资质: {{ selectedCrew.qualifications.typeRatings.join(', ') }}</span>
                </div>
              </div>
              <button
                @click="syncMechanism.syncMedicalDataSimple(selectedCrew.id)"
                class="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-medium hover:bg-blue-600/30 transition-colors"
              >
                同步到AOC
              </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                v-if="physiologicalData.length > 0"
                class="bg-slate-700/30 rounded-xl p-4"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Heart class="w-4 h-4 text-red-400" />
                  <span class="text-sm text-slate-400">心率</span>
                </div>
                <div class="text-2xl font-bold text-slate-100">
                  {{ physiologicalData[physiologicalData.length - 1]?.heartRate || '--' }}
                  <span class="text-sm font-normal text-slate-500">bpm</span>
                </div>
              </div>
              <div
                v-if="physiologicalData.length > 0"
                class="bg-slate-700/30 rounded-xl p-4"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Activity class="w-4 h-4 text-green-400" />
                  <span class="text-sm text-slate-400">HRV</span>
                </div>
                <div class="text-2xl font-bold text-slate-100">
                  {{ physiologicalData[physiologicalData.length - 1]?.hrv || '--' }}
                  <span class="text-sm font-normal text-slate-500">ms</span>
                </div>
              </div>
              <div
                v-if="physiologicalData.length > 0"
                class="bg-slate-700/30 rounded-xl p-4"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Moon class="w-4 h-4 text-blue-400" />
                  <span class="text-sm text-slate-400">睡眠质量</span>
                </div>
                <div class="text-2xl font-bold text-slate-100">
                  {{ physiologicalData[physiologicalData.length - 1]?.sleepQuality || '--' }}
                  <span class="text-sm font-normal text-slate-500">%</span>
                </div>
              </div>
              <div
                v-if="physiologicalData.length > 0"
                class="bg-slate-700/30 rounded-xl p-4"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Zap class="w-4 h-4 text-amber-400" />
                  <span class="text-sm text-slate-400">反应时</span>
                </div>
                <div class="text-2xl font-bold text-slate-100">
                  {{ physiologicalData[physiologicalData.length - 1]?.reactionTime || '--' }}
                  <span class="text-sm font-normal text-slate-500">ms</span>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
              <h3 class="text-lg font-semibold text-slate-100 mb-4">心率监测</h3>
              <PhysiologicalWaveform v-if="physiologicalData.length > 0" :data="physiologicalData" metric="heartRate" height="180px" />
            </div>
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
              <h3 class="text-lg font-semibold text-slate-100 mb-4">心率变异性 (HRV)</h3>
              <PhysiologicalWaveform v-if="physiologicalData.length > 0" :data="physiologicalData" metric="hrv" height="180px" />
            </div>
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
              <h3 class="text-lg font-semibold text-slate-100 mb-4">睡眠质量趋势</h3>
              <PhysiologicalWaveform v-if="physiologicalData.length > 0" :data="physiologicalData" metric="sleepQuality" height="180px" />
            </div>
            <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
              <h3 class="text-lg font-semibold text-slate-100 mb-4">反应时监测</h3>
              <PhysiologicalWaveform v-if="physiologicalData.length > 0" :data="physiologicalData" metric="reactionTime" height="180px" />
            </div>
          </div>

          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
            <h3 class="text-lg font-semibold text-slate-100 mb-4">医疗预警记录</h3>
            <div class="space-y-3">
              <AlertCard
                v-for="alert in medicalStore.alerts.filter(a => a.crewId === selectedCrew.id).slice(0, 5)"
                :key="alert.id"
                :alert="alert"
                @acknowledge="handleAcknowledge"
              />
              <div v-if="medicalStore.alerts.filter(a => a.crewId === selectedCrew.id).length === 0" class="text-center py-8 text-slate-500 text-sm">
                暂无预警记录
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex items-center justify-center h-96 text-slate-500">
          请从左侧选择一名机组人员查看详细生理指标
        </div>
      </div>
    </div>
  </div>
</template>
