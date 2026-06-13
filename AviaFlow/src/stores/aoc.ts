import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SchedulePlan, FlightDuty, ScheduleConflict } from '../types/schedule';
import type { CrewMember } from '../types/crew';
import { 
  getAllSchedulePlans, 
  getSchedulePlan,
  getFlightDutiesBySchedule,
  getFlightDutiesByCrew,
  getScheduleConflicts,
  addSchedulePlan,
  updateSchedulePlan,
  addFlightDuty,
  updateFlightDuty,
  resolveConflict,
} from '../database/stores/scheduleStore';
import { getAllCrewMembers } from '../database/stores/crewStore';
import { getLatestFatigueAssessment } from '../database/stores/fatigueStore';

export const useAocStore = defineStore('aoc', () => {
  const schedulePlans = ref<SchedulePlan[]>([]);
  const selectedScheduleId = ref<string | null>(null);
  const selectedSchedule = ref<SchedulePlan | null>(null);
  const flightDuties = ref<FlightDuty[]>([]);
  const crewList = ref<CrewMember[]>([]);
  const conflicts = ref<ScheduleConflict[]>([]);
  const selectedCrewId = ref<string | null>(null);
  const crewDuties = ref<FlightDuty[]>([]);
  const loading = ref(false);
  const dateRange = ref({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const activePlans = computed(() => 
    schedulePlans.value.filter(p => p.status !== 'archived')
  );

  const unresolvedConflicts = computed(() => 
    conflicts.value.filter(c => !c.resolved)
  );

  const highRiskDuties = computed(() => 
    flightDuties.value.filter(d => Math.abs(d.timezoneDiff) >= 8)
  );

  async function loadSchedulePlans() {
    try {
      schedulePlans.value = await getAllSchedulePlans();
    } catch (e) {
      console.error('加载排班计划失败:', e);
    }
  }

  async function loadCrewList() {
    try {
      crewList.value = await getAllCrewMembers();
    } catch (e) {
      console.error('加载机组列表失败:', e);
    }
  }

  async function selectSchedule(scheduleId: string) {
    selectedScheduleId.value = scheduleId;
    loading.value = true;
    
    try {
      const [plan, duties, scheduleConflicts] = await Promise.all([
        getSchedulePlan(scheduleId),
        getFlightDutiesBySchedule(scheduleId),
        getScheduleConflicts(scheduleId),
      ]);
      
      selectedSchedule.value = plan ?? null;
      flightDuties.value = duties;
      conflicts.value = scheduleConflicts;
    } catch (e) {
      console.error('加载排班详情失败:', e);
    } finally {
      loading.value = false;
    }
  }

  async function selectCrewDuties(crewId: string) {
    selectedCrewId.value = crewId;
    try {
      crewDuties.value = await getFlightDutiesByCrew(
        crewId,
        dateRange.value.start,
        dateRange.value.end
      );
    } catch (e) {
      console.error('加载机组任务失败:', e);
    }
  }

  async function createSchedulePlan(plan: Omit<SchedulePlan, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const newPlan: SchedulePlan = {
        ...plan,
        id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const id = await addSchedulePlan(newPlan);
      await loadSchedulePlans();
      return id;
    } catch (e) {
      console.error('创建排班计划失败:', e);
      throw e;
    }
  }

  async function updateScheduleStatus(scheduleId: string, status: SchedulePlan['status']) {
    try {
      const plan = schedulePlans.value.find(p => p.id === scheduleId);
      if (plan) {
        plan.status = status;
        plan.updatedAt = new Date().toISOString();
        plan.syncedAt = new Date().toISOString();
        await updateSchedulePlan(plan);
        
        if (selectedScheduleId.value === scheduleId) {
          selectedSchedule.value = plan;
        }
      }
    } catch (e) {
      console.error('更新排班状态失败:', e);
    }
  }

  async function createFlightDuty(duty: Omit<FlightDuty, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const newDuty: FlightDuty = {
        ...duty,
        id: `duty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addFlightDuty(newDuty);
      
      if (selectedScheduleId.value === duty.scheduleId) {
        flightDuties.value.push(newDuty);
      }
      
      return newDuty;
    } catch (e) {
      console.error('创建航班任务失败:', e);
      throw e;
    }
  }

  async function resolveScheduleConflict(conflictId: string, resolution: string) {
    try {
      await resolveConflict(conflictId, resolution);
      const conflict = conflicts.value.find(c => c.id === conflictId);
      if (conflict) {
        conflict.resolved = true;
        conflict.resolution = resolution;
      }
    } catch (e) {
      console.error('解决冲突失败:', e);
    }
  }

  async function checkCrewFatigueRisk(crewId: string) {
    try {
      const assessment = await getLatestFatigueAssessment(crewId);
      return assessment;
    } catch (e) {
      console.error('检查机组疲劳风险失败:', e);
      return null;
    }
  }

  function setDateRange(start: string, end: string) {
    dateRange.value = { start, end };
  }

  const duties = flightDuties;

  async function loadDuties() {
    try {
      const allDuties: FlightDuty[] = [];
      for (const plan of schedulePlans.value) {
        const duties = await getFlightDutiesBySchedule(plan.id);
        allDuties.push(...duties);
      }
      flightDuties.value = allDuties;
    } catch (e) {
      console.error('加载航班任务失败:', e);
    }
  }

  async function loadSchedules() {
    await loadSchedulePlans();
  }

  async function loadConflicts() {
    try {
      const allConflicts: ScheduleConflict[] = [];
      for (const plan of schedulePlans.value) {
        const conflicts = await getScheduleConflicts(plan.id);
        allConflicts.push(...conflicts);
      }
      conflicts.value = allConflicts;
    } catch (e) {
      console.error('加载排班冲突失败:', e);
    }
  }

  async function resolveConflictWrapper(conflictId: string, resolution: string, remarks: string) {
    await resolveScheduleConflict(conflictId, `${resolution}: ${remarks}`);
  }

  return {
    schedulePlans,
    selectedScheduleId,
    selectedSchedule,
    flightDuties,
    duties,
    crewList,
    conflicts,
    selectedCrewId,
    crewDuties,
    loading,
    dateRange,
    activePlans,
    unresolvedConflicts,
    highRiskDuties,
    loadSchedulePlans,
    loadCrewList,
    selectSchedule,
    selectCrewDuties,
    createSchedulePlan,
    updateScheduleStatus,
    createFlightDuty,
    resolveScheduleConflict,
    resolveConflict: resolveConflictWrapper,
    checkCrewFatigueRisk,
    setDateRange,
    loadDuties,
    loadSchedules,
    loadConflicts,
  };
});
