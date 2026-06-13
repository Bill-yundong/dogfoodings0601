<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useMedicalStore } from '../../stores/medical';
import { getHealthRecordsByCrew } from '../../database/stores/medicalStore';
import type { HealthRecord } from '../../types/medical';
import type { CrewMember } from '../../types/crew';
import { FileText, Calendar, User, ClipboardCheck, Download } from 'lucide-vue-next';
import dayjs from 'dayjs';

const medicalStore = useMedicalStore();
const selectedCrew = ref<CrewMember | null>(null);
const healthRecords = ref<HealthRecord[]>([]);

const loadRecords = async (crew: CrewMember) => {
  selectedCrew.value = crew;
  healthRecords.value = await getHealthRecordsByCrew(crew.id);
};

const statusColor = (status: string) => {
  const colors: Record<string, string> = {
    fit: 'text-green-400 bg-green-600/20',
    conditional: 'text-amber-400 bg-amber-600/20',
    unfit: 'text-red-400 bg-red-600/20',
    pending: 'text-blue-400 bg-blue-600/20',
  };
  return colors[status] || colors.pending;
};

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    fit: '合格',
    conditional: '条件合格',
    unfit: '不合格',
    pending: '待评估',
  };
  return labels[status] || status;
};

onMounted(async () => {
  await medicalStore.loadCrew();
  if (medicalStore.crew.length > 0) {
    await loadRecords(medicalStore.crew[0]);
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
              v-for="crew in medicalStore.crew"
              :key="crew.id"
              class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
              :class="selectedCrew?.id === crew.id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-slate-700/30 border border-transparent'"
              @click="loadRecords(crew)"
            >
              <div class="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
                <User class="w-5 h-5 text-slate-400" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-slate-200 truncate">{{ crew.name }}</div>
                <div class="text-xs text-slate-500">{{ crew.role }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="lg:col-span-9">
        <div v-if="selectedCrew">
          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 mb-6">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-bold text-slate-100 mb-1">{{ selectedCrew.name }} 的健康档案</h2>
                <p class="text-sm text-slate-500">共 {{ healthRecords.length }} 条健康记录</p>
              </div>
              <button class="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-xl text-sm text-slate-300 transition-colors">
                <Download class="w-4 h-4" />
                导出档案
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <div
              v-for="record in healthRecords"
              :key="record.id"
              class="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600/50 transition-all"
            >
              <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                    <FileText class="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="font-semibold text-slate-100">{{ record.title }}</h3>
                      <span
                        class="px-2 py-0.5 text-xs rounded-full"
                        :class="statusColor('fit')"
                      >
                        {{ record.recordType }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar class="w-3.5 h-3.5" />
                      <span>{{ dayjs(record.date).format('YYYY年MM月DD日') }}</span>
                      <span>·</span>
                      <span>医生: {{ record.doctor }}</span>
                    </div>
                  </div>
                </div>
                <span class="text-xs text-slate-500">编号: {{ record.id.slice(0, 8) }}</span>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div class="bg-slate-700/30 rounded-xl p-3">
                  <div class="text-xs text-slate-500 mb-1">身高/体重</div>
                  <div class="text-sm font-medium text-slate-200">-- / --</div>
                </div>
                <div class="bg-slate-700/30 rounded-xl p-3">
                  <div class="text-xs text-slate-500 mb-1">血压</div>
                  <div class="text-sm font-medium text-slate-200">-- / -- mmHg</div>
                </div>
                <div class="bg-slate-700/30 rounded-xl p-3">
                  <div class="text-xs text-slate-500 mb-1">静息心率</div>
                  <div class="text-sm font-medium text-slate-200">-- bpm</div>
                </div>
                <div class="bg-slate-700/30 rounded-xl p-3">
                  <div class="text-xs text-slate-500 mb-1">视力</div>
                  <div class="text-sm font-medium text-slate-200">-- / --</div>
                </div>
              </div>

              <div v-if="record.findings" class="mb-4">
                <div class="text-xs text-slate-500 mb-1">检查发现</div>
                <p class="text-sm text-slate-300">{{ record.findings }}</p>
              </div>

              <div v-if="record.recommendations" class="bg-amber-600/10 border border-amber-500/30 rounded-xl p-3">
                <div class="flex items-start gap-2">
                  <ClipboardCheck class="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div class="text-xs text-amber-400 font-medium mb-1">医生建议</div>
                    <p class="text-sm text-amber-200/80">{{ record.recommendations }}</p>
                  </div>
                </div>
              </div>

              <div v-if="false" class="mt-4 pt-4 border-t border-slate-700/50">
                <div class="text-xs text-slate-500 mb-2">飞行限制</div>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="restriction in []"
                    :key="restriction"
                    class="px-2 py-1 text-xs rounded-md bg-red-600/20 text-red-400 border border-red-500/30"
                  >
                    {{ restriction }}
                  </span>
                </div>
              </div>

              <div v-if="false" class="mt-4 pt-4 border-t border-slate-700/50">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-slate-500">下次检查日期</span>
                  <span class="text-slate-300 font-medium">--</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex items-center justify-center h-96 text-slate-500">
          请从左侧选择一名机组人员查看健康档案
        </div>
      </div>
    </div>
  </div>
</template>
