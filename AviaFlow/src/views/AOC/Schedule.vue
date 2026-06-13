<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAocStore } from '../../stores/aoc';
import { useSyncMechanism } from '../../composables/useSyncMechanism';
import type { FlightDuty, SchedulePlan } from '../../types/schedule';
import type { CrewMember } from '../../types/crew';
import { getCrewMember } from '../../database/stores/crewStore';
import { getLatestFatigueAssessment } from '../../database/stores/fatigueStore';
import { Plane, Calendar, MapPin, Clock, AlertTriangle, RefreshCw, Users } from 'lucide-vue-next';
import { getRiskColor, getRiskLabel } from '../../types/algorithm';
import dayjs from 'dayjs';

const aocStore = useAocStore();
const syncMechanism = useSyncMechanism();

const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
const crewDetails = ref<Map<string, { crew: CrewMember; riskLevel: string; fatigueScore: number }>>(new Map());

const loadCrewDetails = async () => {
  const crewIds = new Set<string>();
  aocStore.duties.forEach(duty => {
    duty.crewIds.forEach(id => crewIds.add(id));
  });
  
  const details = new Map();
  for (const id of crewIds) {
    const crew = await getCrewMember(id);
    const assessment = await getLatestFatigueAssessment(id);
    if (crew) {
      details.set(id, {
        crew,
        riskLevel: assessment?.riskLevel || 'low',
        fatigueScore: assessment?.fatigueScore || 0,
      });
    }
  }
  crewDetails.value = details;
};

const filteredDuties = computed(() => {
  return aocStore.duties
    .filter(d => dayjs(d.dutyDate).format('YYYY-MM-DD') === selectedDate.value)
    .sort((a, b) => dayjs(a.departureTime).valueOf() - dayjs(b.departureTime).valueOf());
});

const getCrewInfo = (crewId: string) => crewDetails.value.get(crewId);

const resolveConflict = async (conflictId: string, resolution: 'reassign' | 'adjust' | 'rest') => {
  await aocStore.resolveConflict(conflictId, resolution, `手动${resolution === 'reassign' ? '重新排班' : resolution === 'adjust' ? '调整时间' : '强制休息'}`);
  await syncMechanism.syncScheduleDataSimple();
};

const syncToMedical = async () => {
  await syncMechanism.syncScheduleDataSimple();
};

onMounted(async () => {
  await loadCrewDetails();
});
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-slate-100">排班计划管理</h2>
        <p class="text-sm text-slate-500">管理机组排班、监测冲突并进行调整</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <Calendar class="w-4 h-4 text-slate-400" />
          <input
            v-model="selectedDate"
            type="date"
            class="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <button
          @click="syncToMedical"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-medium hover:bg-blue-600/30 transition-colors"
        >
          <RefreshCw class="w-4 h-4" />
          同步到航医中心
        </button>
      </div>
    </div>

    <div v-if="aocStore.conflicts.filter(c => !c.resolved).length > 0" class="mb-6">
      <div class="bg-red-900/20 border border-red-500/30 rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <AlertTriangle class="w-5 h-5 text-red-400" />
          <h3 class="font-semibold text-red-400">排班冲突预警</h3>
          <span class="px-2 py-0.5 text-xs rounded-full bg-red-600/30 text-red-400">
            {{ aocStore.conflicts.filter(c => !c.resolved).length }} 条待处理
          </span>
        </div>
        <div class="space-y-3">
          <div
            v-for="conflict in aocStore.conflicts.filter(c => !c.resolved)"
            :key="conflict.id"
            class="bg-slate-800/50 border border-red-500/30 rounded-xl p-4"
          >
            <div class="flex items-start justify-between">
              <div>
                <div class="font-medium text-slate-200 mb-1">{{ conflict.description }}</div>
                <div class="text-sm text-slate-400">
                  涉及航班: {{ conflict.flightDutyIds.join(', ') }} · 
                  类型: {{ conflict.type === 'fatigue' ? '疲劳超标' : conflict.type === 'rest' ? '休息期不足' : '资质不符' }}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="resolveConflict(conflict.id, 'reassign')"
                  class="px-3 py-1.5 text-xs rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors"
                >
                  重新排班
                </button>
                <button
                  @click="resolveConflict(conflict.id, 'adjust')"
                  class="px-3 py-1.5 text-xs rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
                >
                  调整时间
                </button>
                <button
                  @click="resolveConflict(conflict.id, 'rest')"
                  class="px-3 py-1.5 text-xs rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                >
                  强制休息
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-6">
      <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
          <Plane class="w-4 h-4" />
          <span>今日航班</span>
        </div>
        <div class="text-2xl font-bold text-slate-100">{{ filteredDuties.length }}</div>
      </div>
      <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
          <Users class="w-4 h-4" />
          <span>执飞机组</span>
        </div>
        <div class="text-2xl font-bold text-slate-100">
          {{ new Set(filteredDuties.flatMap(d => d.crewIds)).size }}
        </div>
      </div>
      <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center gap-2 text-amber-400 text-sm mb-2">
          <AlertTriangle class="w-4 h-4" />
          <span>待处理冲突</span>
        </div>
        <div class="text-2xl font-bold text-amber-400">
          {{ aocStore.conflicts.filter(c => !c.resolved).length }}
        </div>
      </div>
      <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-2">
          <Clock class="w-4 h-4" />
          <span>总飞行小时</span>
        </div>
        <div class="text-2xl font-bold text-slate-100">
          {{ filteredDuties.reduce((sum, d) => sum + d.flightHours, 0).toFixed(1) }}h
        </div>
      </div>
    </div>

    <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5">
      <h3 class="text-lg font-semibold text-slate-100 mb-4">{{ dayjs(selectedDate).format('YYYY年MM月DD日') }} 航班计划</h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-xs text-slate-500 border-b border-slate-700/50">
              <th class="pb-3 font-medium">航班号</th>
              <th class="pb-3 font-medium">航线</th>
              <th class="pb-3 font-medium">起降时间</th>
              <th class="pb-3 font-medium">飞行时长</th>
              <th class="pb-3 font-medium">时差</th>
              <th class="pb-3 font-medium">机组人员</th>
              <th class="pb-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="duty in filteredDuties"
              :key="duty.id"
              class="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
            >
              <td class="py-4">
                <div class="font-medium text-slate-200">{{ duty.flightNumber }}</div>
                <div class="text-xs text-slate-500">{{ duty.id.slice(0, 8) }}</div>
              </td>
              <td class="py-4">
                <div class="flex items-center gap-2">
                  <div class="text-sm text-slate-200">{{ duty.departureAirport.code }}</div>
                  <MapPin class="w-3 h-3 text-slate-500" />
                  <div class="text-sm text-slate-200">{{ duty.arrivalAirport.code }}</div>
                </div>
                <div class="text-xs text-slate-500">
                  {{ duty.departureAirport.city }} → {{ duty.arrivalAirport.city }}
                </div>
              </td>
              <td class="py-4">
                <div class="text-sm text-slate-200">
                  {{ dayjs(duty.departureTime).format('HH:mm') }} - {{ dayjs(duty.arrivalTime).format('HH:mm') }}
                </div>
                <div class="text-xs text-slate-500">
                  {{ dayjs(duty.departureTime).format('MM月DD日') }}
                </div>
              </td>
              <td class="py-4">
                <div class="text-sm font-medium text-slate-200">{{ duty.flightHours.toFixed(1) }}h</div>
                <div class="text-xs text-slate-500">{{ duty.dutyHours.toFixed(1) }}h 执勤</div>
              </td>
              <td class="py-4">
                <div
                  class="text-sm font-medium"
                  :class="duty.timezoneDiff > 4 ? 'text-red-400' : duty.timezoneDiff > 2 ? 'text-amber-400' : 'text-green-400'"
                >
                  {{ duty.timezoneDiff > 0 ? '+' : '' }}{{ duty.timezoneDiff }}h
                </div>
                <div class="text-xs text-slate-500">时区变化</div>
              </td>
              <td class="py-4">
                <div class="flex flex-wrap gap-1">
                  <div
                    v-for="crewId in duty.crewIds"
                    :key="crewId"
                    class="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                    :style="{ backgroundColor: getCrewInfo(crewId) ? `${getRiskColor(getCrewInfo(crewId)!.riskLevel as any)}20` : '#334155', color: getCrewInfo(crewId) ? getRiskColor(getCrewInfo(crewId)!.riskLevel as any) : '#94a3b8' }"
                  >
                    <span>{{ getCrewInfo(crewId)?.crew.name || crewId.slice(0, 4) }}</span>
                    <span class="opacity-70">{{ getCrewInfo(crewId)?.fatigueScore.toFixed(0) }}</span>
                  </div>
                </div>
              </td>
              <td class="py-4">
                <span
                  class="px-2 py-1 text-xs rounded-full"
                  :class="duty.status === 'scheduled' ? 'bg-blue-600/20 text-blue-400' : duty.status === 'in_progress' ? 'bg-green-600/20 text-green-400' : duty.status === 'completed' ? 'bg-slate-600/20 text-slate-400' : 'bg-red-600/20 text-red-400'"
                >
                  {{ duty.status === 'scheduled' ? '已排班' : duty.status === 'in_progress' ? '执行中' : duty.status === 'completed' ? '已完成' : '已取消' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="filteredDuties.length === 0" class="text-center py-12 text-slate-500">
        该日期暂无航班计划
      </div>
    </div>
  </div>
</template>
