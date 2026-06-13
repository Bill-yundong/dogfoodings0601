<script setup lang="ts">
import { computed } from 'vue';
import { User, Plane, Award } from 'lucide-vue-next';
import type { CrewMember } from '../../types/crew';
import type { FatigueAssessment } from '../../types/algorithm';
import { getRiskColor, getRiskLabel } from '../../types/algorithm';
import dayjs from 'dayjs';

const props = defineProps<{
  crew: CrewMember;
  latestAssessment?: FatigueAssessment;
  selected?: boolean;
}>();

const emit = defineEmits<{
  select: [crew: CrewMember];
}>();

const age = computed(() => {
  return dayjs().diff(dayjs(props.crew.birthDate), 'year');
});

const fatigueLevel = computed(() => {
  if (!props.latestAssessment) return null;
  return props.latestAssessment.riskLevel;
});

const roleLabel: Record<string, string> = {
  '机长': '机长',
  '副驾驶': '副驾驶',
  '飞航工程师': '飞航工程师',
  '乘务长': '乘务长',
  '乘务员': '乘务员',
};

const statusLabel: Record<string, string> = {
  'active': '执勤中',
  'on_flight': '飞行中',
  'resting': '休息中',
  'on_leave': '休假中',
  'training': '培训中',
};

const statusColor: Record<string, string> = {
  'active': 'bg-blue-600/20 text-blue-400',
  'on_flight': 'bg-green-600/20 text-green-400',
  'resting': 'bg-slate-600/20 text-slate-400',
  'on_leave': 'bg-purple-600/20 text-purple-400',
  'training': 'bg-amber-600/20 text-amber-400',
};
</script>

<template>
  <div
    class="bg-slate-800/50 border rounded-xl p-4 cursor-pointer transition-all hover:border-slate-600 hover:shadow-lg"
    :class="selected ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' : 'border-slate-700/50'"
    @click="emit('select', crew)"
  >
    <div class="flex items-start gap-3">
      <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0">
        <User class="w-6 h-6 text-slate-400" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <div class="font-semibold text-slate-100">{{ crew.name }}</div>
          <div
            v-if="fatigueLevel"
            class="px-2 py-0.5 text-xs rounded-full"
            :style="{ backgroundColor: `${getRiskColor(fatigueLevel)}20`, color: getRiskColor(fatigueLevel) }"
          >
            {{ getRiskLabel(fatigueLevel) }}
          </div>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">
            {{ roleLabel[crew.role] }}
          </span>
          <span class="text-xs px-2 py-0.5 rounded" :class="statusColor[crew.status]">
            {{ statusLabel[crew.status] }}
          </span>
          <span class="text-xs text-slate-500">{{ age }}岁</span>
        </div>
        <div class="flex items-center gap-4 text-xs text-slate-500">
          <div class="flex items-center gap-1">
            <Award class="w-3 h-3" />
            <span>{{ crew.qualifications.typeRatings.join(', ') }}</span>
          </div>
          <div class="flex items-center gap-1">
            <Plane class="w-3 h-3" />
            <span>{{ crew.totalFlightHours.toLocaleString() }}h</span>
          </div>
        </div>
        <div v-if="latestAssessment" class="mt-3 pt-3 border-t border-slate-700/50">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">疲劳评分</span>
            <span
              class="font-semibold"
              :style="{ color: getRiskColor(fatigueLevel!) }"
            >
              {{ latestAssessment.fatigueScore.toFixed(0) }}/100
            </span>
          </div>
          <div class="mt-1.5 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :style="{ width: `${latestAssessment.fatigueScore}%`, backgroundColor: getRiskColor(fatigueLevel!) }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
