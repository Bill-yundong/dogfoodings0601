import { ref, computed } from 'vue';
import dayjs from 'dayjs';
import type { FatigueAssessment, FatigueEvolutionPoint, ReactionTimePrediction } from '../types/algorithm';
import { getRiskLevel, getRiskColor, getRiskLabel } from '../types/algorithm';
import type { PhysiologicalData } from '../types/medical';
import type { FlightDuty } from '../types/schedule';
import { assessFatigue, predictReactionTime, simulateFatigueEvolution } from '../utils/fatigueAlgorithm';
import { getFatigueAssessmentsByCrew, addFatigueAssessment } from '../database/stores/fatigueStore';

export function useFatigueAssessment() {
  const crewId = ref<string>('');
  const birthDate = ref<string>('');
  const physiologicalData = ref<PhysiologicalData[]>([]);
  const flightDuties = ref<FlightDuty[]>([]);
  const historicalAssessments = ref<FatigueAssessment[]>([]);
  const currentAssessment = ref<FatigueAssessment | null>(null);
  const evolutionData = ref<FatigueEvolutionPoint[]>([]);
  const reactionTimePrediction = ref<ReactionTimePrediction | null>(null);
  const predictionDays = ref(14);
  const loading = ref(false);

  const fatigueScore = computed(() => currentAssessment.value?.fatigueScore ?? 0);
  const riskLevel = computed(() => currentAssessment.value?.riskLevel ?? 'low');
  const riskColor = computed(() => getRiskColor(riskLevel.value));
  const riskLabel = computed(() => getRiskLabel(riskLevel.value));

  const contributingFactors = computed(() => 
    currentAssessment.value?.contributingFactors ?? []
  );

  const recommendations = computed(() => 
    currentAssessment.value?.recommendations ?? []
  );

  const avgEvolutionScore = computed(() => {
    if (evolutionData.value.length === 0) return 0;
    return Math.round(
      evolutionData.value.reduce((sum, p) => sum + p.fatigueScore, 0) / evolutionData.value.length
    );
  });

  const maxEvolutionScore = computed(() => {
    if (evolutionData.value.length === 0) return 0;
    return Math.max(...evolutionData.value.map(p => p.fatigueScore));
  });

  const highRiskCount = computed(() => 
    evolutionData.value.filter(p => 
      p.riskLevel === 'high' || p.riskLevel === 'critical'
    ).length
  );

  const reactionTimeDelay = computed(() => {
    if (!reactionTimePrediction.value) return 0;
    return reactionTimePrediction.value.predictedReactionTime - 
           reactionTimePrediction.value.baselineReactionTime;
  });

  const reactionTimeDelayPercent = computed(() => {
    if (!reactionTimePrediction.value) return 0;
    const baseline = reactionTimePrediction.value.baselineReactionTime;
    return Math.round((reactionTimeDelay.value / baseline) * 100);
  });

  async function loadHistoricalData() {
    if (!crewId.value) return;
    
    try {
      const endDate = dayjs();
      const startDate = endDate.subtract(60, 'day');
      historicalAssessments.value = await getFatigueAssessmentsByCrew(
        crewId.value,
        startDate.toISOString(),
        endDate.toISOString()
      );
    } catch (e) {
      console.error('加载历史评估数据失败:', e);
    }
  }

  async function runAssessment() {
    if (!crewId.value || !birthDate.value) return;
    
    loading.value = true;
    try {
      const upcomingDuties = flightDuties.value.filter(d => 
        dayjs(d.departureTime).isAfter(dayjs())
      ).slice(0, 5);
      
      const assessment = assessFatigue(
        crewId.value,
        birthDate.value,
        physiologicalData.value,
        upcomingDuties,
        historicalAssessments.value
      );
      
      currentAssessment.value = assessment;
      
      try {
        await addFatigueAssessment(assessment);
      } catch (e) {
        console.error('保存评估结果失败:', e);
      }
      
      runReactionTimePrediction();
      runEvolutionSimulation();
    } finally {
      loading.value = false;
    }
  }

  const isLoading = computed(() => loading.value);

  async function assessFatigueWrapper(
    id: string,
    birth: string,
    physioData: PhysiologicalData[],
    upcomingDuties: FlightDuty[],
    history: FatigueAssessment[]
  ) {
    crewId.value = id;
    birthDate.value = birth;
    physiologicalData.value = physioData;
    flightDuties.value = upcomingDuties;
    historicalAssessments.value = history;
    await runAssessment();
    return currentAssessment.value!;
  }

  async function predictReactionTimeWrapper(
    baseline: number,
    physioData: PhysiologicalData[],
    upcomingDuties: FlightDuty[],
    birth: string
  ) {
    birthDate.value = birth;
    physiologicalData.value = physioData;
    flightDuties.value = upcomingDuties;
    runReactionTimePrediction(baseline);
    return reactionTimePrediction.value!;
  }

  async function simulateEvolutionWrapper(
    id: string,
    birth: string,
    physioData: PhysiologicalData[],
    duties: FlightDuty[],
    days: number
  ) {
    crewId.value = id;
    birthDate.value = birth;
    physiologicalData.value = physioData;
    flightDuties.value = duties;
    predictionDays.value = days;
    runEvolutionSimulation();
    return evolutionData.value;
  }

  function runReactionTimePrediction(baselineRt?: number) {
    if (!birthDate.value) return;
    
    const baseline = baselineRt ?? 
      physiologicalData.value[physiologicalData.value.length - 1]?.reactionTime ?? 250;
    
    const upcomingDuties = flightDuties.value.filter(d => 
      dayjs(d.departureTime).isAfter(dayjs())
    ).slice(0, 5);
    
    reactionTimePrediction.value = predictReactionTime(
      baseline,
      physiologicalData.value,
      upcomingDuties,
      birthDate.value
    );
  }

  function runEvolutionSimulation() {
    if (!crewId.value || !birthDate.value) return;
    
    const startDate = dayjs().subtract(7, 'day').toISOString();
    evolutionData.value = simulateFatigueEvolution(
      crewId.value,
      birthDate.value,
      physiologicalData.value,
      flightDuties.value,
      startDate,
      predictionDays.value + 7
    );
  }

  function setCrew(id: string, birth: string) {
    crewId.value = id;
    birthDate.value = birth;
  }

  function setPhysiologicalData(data: PhysiologicalData[]) {
    physiologicalData.value = data;
  }

  function setFlightDuties(duties: FlightDuty[]) {
    flightDuties.value = duties;
  }

  function setPredictionDays(days: number) {
    predictionDays.value = days;
    if (crewId.value && birthDate.value) {
      runEvolutionSimulation();
    }
  }

  function getScoreColor(score: number): string {
    return getRiskColor(getRiskLevel(score));
  }

  return {
    crewId,
    birthDate,
    physiologicalData,
    flightDuties,
    historicalAssessments,
    currentAssessment,
    evolutionData,
    reactionTimePrediction,
    predictionDays,
    loading,
    isLoading,
    fatigueScore,
    riskLevel,
    riskColor,
    riskLabel,
    contributingFactors,
    recommendations,
    avgEvolutionScore,
    maxEvolutionScore,
    highRiskCount,
    reactionTimeDelay,
    reactionTimeDelayPercent,
    loadHistoricalData,
    runAssessment,
    runReactionTimePrediction,
    runEvolutionSimulation,
    assessFatigue: assessFatigueWrapper,
    predictReactionTime: predictReactionTimeWrapper,
    simulateEvolution: simulateEvolutionWrapper,
    setCrew,
    setPhysiologicalData,
    setFlightDuties,
    setPredictionDays,
    getScoreColor,
  };
}
