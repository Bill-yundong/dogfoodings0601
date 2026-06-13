import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CrewMember } from '../types/crew';
import type { PhysiologicalData, HealthRecord, MedicalAlert } from '../types/medical';
import { getAllCrewMembers, getCrewMember } from '../database/stores/crewStore';
import { 
  getPhysiologicalDataByCrew, 
  getLatestPhysiologicalData,
  getPhysiologicalStats,
  addPhysiologicalData,
} from '../database/stores/physiologicalStore';
import { 
  getHealthRecordsByCrew, 
  getMedicalAlerts,
  acknowledgeAlert as dbAcknowledgeAlert,
  addMedicalAlert,
} from '../database/stores/medicalStore';
import type { CrewCompleteProfile } from '../database/queryEngine';
import { getCrewCompleteProfile } from '../database/queryEngine';

export const useMedicalStore = defineStore('medical', () => {
  const crewList = ref<CrewMember[]>([]);
  const selectedCrewId = ref<string | null>(null);
  const selectedCrew = ref<CrewMember | null>(null);
  const physiologicalData = ref<PhysiologicalData[]>([]);
  const latestPhysiological = ref<PhysiologicalData | null>(null);
  const physiologicalStats = ref<Awaited<ReturnType<typeof getPhysiologicalStats>>>(null);
  const healthRecords = ref<HealthRecord[]>([]);
  const alerts = ref<MedicalAlert[]>([]);
  const completeProfile = ref<CrewCompleteProfile | null>(null);
  const loading = ref(false);
  const timeRange = ref({ days: 7 });

  const selectedCrewAlerts = computed(() => 
    alerts.value.filter(a => a.crewId === selectedCrewId.value)
  );

  const highRiskCrew = computed(() => 
    crewList.value.filter(c => c.status === 'active')
  );

  async function loadCrewList() {
    try {
      crewList.value = await getAllCrewMembers();
    } catch (e) {
      console.error('加载机组列表失败:', e);
    }
  }

  async function selectCrew(crewId: string) {
    selectedCrewId.value = crewId;
    loading.value = true;
    
    try {
      const [
        crew,
        physioData,
        latest,
        stats,
        records,
        profile,
      ] = await Promise.all([
        getCrewMember(crewId),
        getPhysiologicalDataByCrew(
          crewId,
          new Date(Date.now() - timeRange.value.days * 24 * 60 * 60 * 1000).toISOString()
        ),
        getLatestPhysiologicalData(crewId),
        getPhysiologicalStats(crewId, timeRange.value.days),
        getHealthRecordsByCrew(crewId),
        getCrewCompleteProfile(crewId),
      ]);
      
      selectedCrew.value = crew ?? null;
      physiologicalData.value = physioData;
      latestPhysiological.value = latest ?? null;
      physiologicalStats.value = stats;
      healthRecords.value = records;
      completeProfile.value = profile;
    } catch (e) {
      console.error('加载机组详情失败:', e);
    } finally {
      loading.value = false;
    }
  }

  async function loadAlerts() {
    try {
      alerts.value = await getMedicalAlerts();
    } catch (e) {
      console.error('加载预警数据失败:', e);
    }
  }

  async function addPhysiologicalReading(data: Omit<PhysiologicalData, 'id' | 'createdAt'>) {
    try {
      const newData: PhysiologicalData = {
        ...data,
        id: `physio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      };
      await addPhysiologicalData(newData);
      
      if (data.crewId === selectedCrewId.value) {
        await selectCrew(data.crewId);
      }
      
      return newData;
    } catch (e) {
      console.error('添加生理数据失败:', e);
      throw e;
    }
  }

  async function acknowledgeAlertAction(alertId: string, acknowledgedBy: string) {
    try {
      await dbAcknowledgeAlert(alertId, acknowledgedBy);
      const alert = alerts.value.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedBy = acknowledgedBy;
        alert.acknowledgedAt = new Date().toISOString();
      }
    } catch (e) {
      console.error('确认预警失败:', e);
    }
  }

  function setTimeRange(days: number) {
    timeRange.value = { days };
    if (selectedCrewId.value) {
      selectCrew(selectedCrewId.value);
    }
  }

  async function loadCrew() {
    await loadCrewList();
  }

  async function loadPhysiologicalData(crewId: string, days: number = 7) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    physiologicalData.value = await getPhysiologicalDataByCrew(crewId, startDate);
  }

  async function acknowledgeAlert(alertId: string) {
    await acknowledgeAlertAction(alertId, 'system');
  }

  return {
    crewList,
    crew: crewList,
    selectedCrewId,
    selectedCrew,
    physiologicalData,
    latestPhysiological,
    physiologicalStats,
    healthRecords,
    alerts,
    completeProfile,
    loading,
    timeRange,
    selectedCrewAlerts,
    highRiskCrew,
    loadCrewList,
    loadCrew,
    selectCrew,
    loadPhysiologicalData,
    loadAlerts,
    addPhysiologicalReading,
    acknowledgeAlertAction,
    acknowledgeAlert,
    setTimeRange,
  };
});
