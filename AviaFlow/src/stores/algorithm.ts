import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import dayjs from 'dayjs';
import type { BiorhythmResult, BiorhythmDayData, FatigueAssessment, FatigueEvolutionPoint } from '../types/algorithm';
import { calculateBiorhythm, getBiorhythmSeries } from '../utils/biorhythm';
import { assessFatigue, predictReactionTime, simulateFatigueEvolution } from '../utils/fatigueAlgorithm';
import type { CrewMember } from '../types/crew';
import type { PhysiologicalData } from '../types/medical';
import type { FlightDuty } from '../types/schedule';
import { getAllCrewMembers } from '../database/stores/crewStore';
import { getPhysiologicalDataByCrew } from '../database/stores/physiologicalStore';
import { getFlightDutiesByCrew } from '../database/stores/scheduleStore';
import { getFatigueAssessmentsByCrew, addFatigueAssessment } from '../database/stores/fatigueStore';

export const useAlgorithmStore = defineStore('algorithm', () => {
  const selectedCrewId = ref<string | null>(null);
  const crewList = ref<CrewMember[]>([]);
  const biorhythmResult = ref<BiorhythmResult | null>(null);
  const biorhythmSeries = ref<BiorhythmDayData[]>([]);
  const currentFatigueAssessment = ref<FatigueAssessment | null>(null);
  const fatigueEvolution = ref<FatigueEvolutionPoint[]>([]);
  const historicalAssessments = ref<FatigueAssessment[]>([]);
  const physiologicalData = ref<PhysiologicalData[]>([]);
  const flightDuties = ref<FlightDuty[]>([]);
  const predictionDays = ref(14);
  const analysisDate = ref(dayjs().toISOString());
  const loading = ref(false);

  const criticalDays = computed(() => 
    biorhythmSeries.value.filter(d => d.isCritical)
  );

  const avgFatigueScore = computed(() => {
    if (fatigueEvolution.value.length === 0) return 0;
    return Math.round(
      fatigueEvolution.value.reduce((sum, p) => sum + p.fatigueScore, 0) / fatigueEvolution.value.length
    );
  });

  const maxFatigueScore = computed(() => {
    if (fatigueEvolution.value.length === 0) return 0;
    return Math.max(...fatigueEvolution.value.map(p => p.fatigueScore));
  });

  const highRiskPeriods = computed(() => 
    fatigueEvolution.value.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical')
  );

  async function loadCrewList() {
    try {
      crewList.value = await getAllCrewMembers();
    } catch (e) {
      console.error('加载机组列表失败:', e);
    }
  }

  async function selectCrewForAnalysis(crewId: string) {
    selectedCrewId.value = crewId;
    loading.value = true;
    
    try {
      const crew = crewList.value.find(c => c.id === crewId);
      if (!crew) {
        await loadCrewList();
      }
      
      const endDate = dayjs();
      const startDate = endDate.subtract(60, 'day');
      
      const [physio, duties, assessments] = await Promise.all([
        getPhysiologicalDataByCrew(crewId, startDate.toISOString(), endDate.toISOString()),
        getFlightDutiesByCrew(crewId, startDate.toISOString(), endDate.add(30, 'day').toISOString()),
        getFatigueAssessmentsByCrew(crewId, startDate.toISOString(), endDate.toISOString()),
      ]);
      
      physiologicalData.value = physio;
      flightDuties.value = duties;
      historicalAssessments.value = assessments;
      
      if (crew) {
        runBiorhythmAnalysis(crew.birthDate, analysisDate.value);
        runFatigueAssessment(crewId, crew.birthDate);
        runEvolutionSimulation(crewId, crew.birthDate);
      }
    } catch (e) {
      console.error('加载分析数据失败:', e);
    } finally {
      loading.value = false;
    }
  }

  function runBiorhythmAnalysis(birthDate: string, targetDate: string) {
    biorhythmResult.value = calculateBiorhythm(birthDate, targetDate);
    biorhythmSeries.value = getBiorhythmSeries(
      birthDate,
      dayjs(targetDate).subtract(7, 'day').toISOString(),
      predictionDays.value + 7
    );
  }

  async function runFatigueAssessment(crewId: string, birthDate: string) {
    const upcomingDuties = flightDuties.value.filter(d => 
      dayjs(d.departureTime).isAfter(dayjs())
    ).slice(0, 5);
    
    const assessment = assessFatigue(
      crewId,
      birthDate,
      physiologicalData.value,
      upcomingDuties,
      historicalAssessments.value
    );
    
    currentFatigueAssessment.value = assessment;
    
    try {
      await addFatigueAssessment(assessment);
    } catch (e) {
      console.error('保存疲劳评估失败:', e);
    }
  }

  function runEvolutionSimulation(crewId: string, birthDate: string) {
    const startDate = dayjs().subtract(7, 'day').toISOString();
    fatigueEvolution.value = simulateFatigueEvolution(
      crewId,
      birthDate,
      physiologicalData.value,
      flightDuties.value,
      startDate,
      predictionDays.value + 7
    );
  }

  function runReactionTimePrediction(
    baselineRt: number,
    crewId: string,
    birthDate: string
  ) {
    const upcomingDuties = flightDuties.value.filter(d => 
      dayjs(d.departureTime).isAfter(dayjs())
    ).slice(0, 5);
    
    return predictReactionTime(
      baselineRt,
      physiologicalData.value,
      upcomingDuties,
      birthDate
    );
  }

  function setAnalysisDate(date: string) {
    analysisDate.value = date;
    const crew = crewList.value.find(c => c.id === selectedCrewId.value);
    if (crew) {
      runBiorhythmAnalysis(crew.birthDate, date);
    }
  }

  function setPredictionDays(days: number) {
    predictionDays.value = days;
    const crew = crewList.value.find(c => c.id === selectedCrewId.value);
    if (crew) {
      runBiorhythmAnalysis(crew.birthDate, analysisDate.value);
      runEvolutionSimulation(crew.id, crew.birthDate);
    }
  }

  async function loadCrew() {
    await loadCrewList();
  }

  function selectCrew(crewId: string) {
    selectCrewForAnalysis(crewId);
  }

  async function loadBiorhythmAnalysis(birthDate: string, days: number) {
    setPredictionDays(days);
    runBiorhythmAnalysis(birthDate, analysisDate.value);
  }

  async function loadFatigueAssessment(crewId: string, physioDays: number, dutyDays: number) {
    const crew = crewList.value.find(c => c.id === crewId);
    if (crew) {
      runFatigueAssessment(crewId, crew.birthDate);
    }
  }

  return {
    selectedCrewId,
    crewList,
    crew: crewList,
    biorhythmResult,
    biorhythmSeries,
    currentFatigueAssessment,
    fatigueEvolution,
    historicalAssessments,
    physiologicalData,
    flightDuties,
    predictionDays,
    analysisDate,
    loading,
    criticalDays,
    avgFatigueScore,
    maxFatigueScore,
    highRiskPeriods,
    loadCrewList,
    loadCrew,
    selectCrewForAnalysis,
    selectCrew,
    loadBiorhythmAnalysis,
    loadFatigueAssessment,
    runBiorhythmAnalysis,
    runFatigueAssessment,
    runEvolutionSimulation,
    runReactionTimePrediction,
    setAnalysisDate,
    setPredictionDays,
  };
});
