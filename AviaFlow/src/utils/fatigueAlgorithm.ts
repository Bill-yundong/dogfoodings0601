import dayjs from 'dayjs';
import type { 
  ReactionTimePrediction, 
  FatigueAssessment,
  FatigueEvolutionPoint,
  RiskLevel 
} from '../types/algorithm';
import { getRiskLevel } from '../types/algorithm';
import { calculateBiorhythm, getBiorhythmInfluence } from './biorhythm';
import type { PhysiologicalData } from '../types/medical';
import type { FlightDuty } from '../types/schedule';

const BASELINE_REACTION_TIME = 250;
const MAX_REACTION_TIME = 600;

export function calculateTimezoneJetlag(timezoneDiff: number, flightHours: number): number {
  const directionFactor = timezoneDiff > 0 ? 1.5 : 1.0;
  const baseJetlag = (Math.abs(timezoneDiff) * 0.8 + flightHours * 0.3) * directionFactor;
  return Math.min(baseJetlag, 100);
}

export function calculateSleepDebt(
  avgSleepDuration: number,
  avgSleepQuality: number,
  days: number = 7
): number {
  const optimalSleep = 8;
  const durationDebt = Math.max(0, (optimalSleep - avgSleepDuration) * days * 1.5);
  const qualityFactor = (100 - avgSleepQuality) / 100;
  return Math.min(durationDebt * (1 + qualityFactor), 100);
}

export function calculateFatigueAccumulation(
  flightHours: number,
  timezoneChanges: number,
  restHours: number
): number {
  const flightFactor = flightHours * 2.5;
  const timezoneFactor = timezoneChanges * 8;
  const restFactor = Math.max(0, (48 - restHours) * 0.5);
  return Math.min(flightFactor + timezoneFactor + restFactor, 100);
}

export function predictReactionTime(
  baselineReactionTime: number,
  physiologicalData: PhysiologicalData[],
  upcomingDuties: FlightDuty[],
  birthDate: string
): ReactionTimePrediction {
  const avgSleepQuality = physiologicalData.length > 0
    ? physiologicalData.reduce((sum, d) => sum + d.sleepQuality, 0) / physiologicalData.length
    : 70;
  
  const avgSleepDuration = physiologicalData.length > 0
    ? physiologicalData.reduce((sum, d) => sum + d.sleepDuration, 0) / physiologicalData.length
    : 6.5;
  
  const avgHrv = physiologicalData.length > 0
    ? physiologicalData.reduce((sum, d) => sum + d.hrv, 0) / physiologicalData.length
    : 40;
  
  const avgStress = physiologicalData.length > 0
    ? physiologicalData.reduce((sum, d) => sum + d.stressLevel, 0) / physiologicalData.length
    : 30;
  
  const totalFlightHours = upcomingDuties.reduce((sum, d) => sum + d.flightHours, 0);
  const totalTimezoneDiff = upcomingDuties.reduce((sum, d) => sum + Math.abs(d.timezoneDiff), 0);
  
  const timezoneJetlag = calculateTimezoneJetlag(
    totalTimezoneDiff > 0 ? totalTimezoneDiff / upcomingDuties.length : 0,
    totalFlightHours
  );
  
  const sleepDebt = calculateSleepDebt(avgSleepDuration, avgSleepQuality);
  
  const fatigueAccumulation = calculateFatigueAccumulation(
    totalFlightHours,
    upcomingDuties.filter(d => Math.abs(d.timezoneDiff) >= 3).length,
    Math.max(0, 48 - totalFlightHours * 1.5)
  );
  
  const hrvFactor = Math.max(0, (60 - avgHrv) / 60);
  const stressFactor = avgStress / 100;
  
  const targetDate = upcomingDuties.length > 0 
    ? upcomingDuties[0].departureTime 
    : dayjs().toISOString();
  const biorhythm = calculateBiorhythm(birthDate, targetDate);
  const biorhythmFactor = getBiorhythmInfluence(biorhythm);
  
  const attenuationFactor = Math.min(
    0.15 + 
    timezoneJetlag * 0.003 + 
    sleepDebt * 0.004 + 
    fatigueAccumulation * 0.003 +
    hrvFactor * 0.2 +
    stressFactor * 0.15 +
    biorhythmFactor * 0.15,
    1.0
  );
  
  const predictedReactionTime = baselineReactionTime * (1 + attenuationFactor * 0.8);
  
  let peakDay = 1;
  let peakValue = predictedReactionTime;
  for (let i = 1; i <= 7; i++) {
    const dailyFactor = attenuationFactor * (1 - i * 0.1);
    const dailyRt = baselineReactionTime * (1 + Math.max(0, dailyFactor) * 0.8);
    if (dailyRt > peakValue) {
      peakValue = dailyRt;
      peakDay = i;
    }
  }
  
  const estimatedRecoveryDays = Math.ceil(attenuationFactor * 10);
  
  return {
    baselineReactionTime,
    predictedReactionTime: Math.min(Math.round(predictedReactionTime), MAX_REACTION_TIME),
    attenuationFactor: Math.round(attenuationFactor * 1000) / 1000,
    timezoneJetlag: Math.round(timezoneJetlag * 10) / 10,
    sleepDebt: Math.round(sleepDebt * 10) / 10,
    fatigueAccumulation: Math.round(fatigueAccumulation * 10) / 10,
    confidence: Math.round((1 - attenuationFactor * 0.5) * 100),
    currentReactionTime: Math.min(Math.round(predictedReactionTime), MAX_REACTION_TIME),
    predictedPeak: Math.min(Math.round(peakValue), MAX_REACTION_TIME),
    peakDate: dayjs().add(peakDay, 'day').toISOString(),
    estimatedRecoveryDays,
  };
}

export function assessFatigue(
  crewId: string,
  birthDate: string,
  physiologicalData: PhysiologicalData[],
  upcomingDuties: FlightDuty[],
  historicalAssessments: FatigueAssessment[]
): FatigueAssessment {
  const latestPhysio = physiologicalData[physiologicalData.length - 1];
  const baselineRt = latestPhysio?.reactionTime || BASELINE_REACTION_TIME;
  
  const reactionTimePrediction = predictReactionTime(
    baselineRt,
    physiologicalData,
    upcomingDuties,
    birthDate
  );
  
  const targetDate = upcomingDuties.length > 0 
    ? upcomingDuties[0].departureTime 
    : dayjs().toISOString();
  
  const biorhythmState = calculateBiorhythm(birthDate, targetDate);
  
  const rtFactor = (reactionTimePrediction.predictedReactionTime - BASELINE_REACTION_TIME) / 
    (MAX_REACTION_TIME - BASELINE_REACTION_TIME);
  
  const jetlagFactor = reactionTimePrediction.timezoneJetlag / 100;
  const sleepFactor = reactionTimePrediction.sleepDebt / 100;
  const fatigueFactor = reactionTimePrediction.fatigueAccumulation / 100;
  const biorhythmFactor = getBiorhythmInfluence(biorhythmState);
  
  const lastAssessment = historicalAssessments[historicalAssessments.length - 1];
  const cumulativeFactor = lastAssessment ? 
    (lastAssessment.fatigueScore / 100) * 0.2 : 0;
  
  let fatigueScore = (
    rtFactor * 0.30 +
    jetlagFactor * 0.20 +
    sleepFactor * 0.20 +
    fatigueFactor * 0.15 +
    biorhythmFactor * 0.10 +
    cumulativeFactor
  ) * 100;
  
  if (latestPhysio) {
    if (latestPhysio.hrv < 30) fatigueScore += 5;
    if (latestPhysio.stressLevel > 70) fatigueScore += 5;
    if (latestPhysio.sleepQuality < 50) fatigueScore += 8;
  }
  
  fatigueScore = Math.min(Math.max(Math.round(fatigueScore), 0), 100);
  
  const riskLevel = getRiskLevel(fatigueScore);
  
  const contributingFactors: string[] = [];
  const recommendations: string[] = [];
  
  if (jetlagFactor > 0.4) {
    contributingFactors.push('跨时区飞行时差影响显著');
    recommendations.push('建议增加落地后休息时间，考虑提前调整作息');
  }
  
  if (sleepFactor > 0.5) {
    contributingFactors.push('近期睡眠质量不佳或时长不足');
    recommendations.push('强制保证每日8小时睡眠，必要时使用睡眠辅助措施');
  }
  
  if (fatigueFactor > 0.5) {
    contributingFactors.push('飞行小时累积，疲劳未充分恢复');
    recommendations.push('调整排班密度，增加休息间隔');
  }
  
  if (biorhythmState.isCriticalDay) {
    contributingFactors.push('生物节律临界日');
    recommendations.push('关键阶段加强监控，考虑搭配双机组');
  }
  
  if (rtFactor > 0.4) {
    contributingFactors.push('反应时明显延长');
    recommendations.push('执行反应时恢复训练，避免关键阶段操作');
  }
  
  if (riskLevel === 'high' || riskLevel === 'critical') {
    recommendations.push('建议重新评估排班方案，考虑机组调整');
  }
  
  const avgHrv = physiologicalData.length > 0
    ? physiologicalData.reduce((sum, d) => sum + d.hrv, 0) / physiologicalData.length
    : 40;
  const avgStress = physiologicalData.length > 0
    ? physiologicalData.reduce((sum, d) => sum + d.stressLevel, 0) / physiologicalData.length
    : 30;
  
  const hrvInfluence = Math.max(0, (60 - avgHrv) / 60) * 30;
  const stressInfluence = avgStress * 0.3;
  
  return {
    id: `fatigue_${crewId}_${dayjs().valueOf()}`,
    crewId,
    dutyId: upcomingDuties.length > 0 ? upcomingDuties[0].id : undefined,
    assessmentTime: dayjs().toISOString(),
    assessmentTimestamp: dayjs().toISOString(),
    fatigueScore,
    riskLevel,
    biorhythmState,
    reactionTime: reactionTimePrediction,
    predictedReactionTime: reactionTimePrediction.predictedReactionTime,
    contributingFactors,
    recommendations,
    factors: {
      jetlag: reactionTimePrediction.timezoneJetlag,
      sleepDebt: reactionTimePrediction.sleepDebt,
      fatigueAccumulation: reactionTimePrediction.fatigueAccumulation,
      hrvInfluence: Math.round(hrvInfluence * 10) / 10,
      stressInfluence: Math.round(stressInfluence * 10) / 10,
      biorhythmInfluence: Math.round(getBiorhythmInfluence(biorhythmState) * 30 * 10) / 10,
    },
    timeWindow: {
      start: targetDate,
      end: dayjs(targetDate).add(24, 'hour').toISOString(),
    },
  };
}

export function simulateFatigueEvolution(
  crewId: string,
  birthDate: string,
  physiologicalData: PhysiologicalData[],
  duties: FlightDuty[],
  startDate: string,
  days: number
): FatigueEvolutionPoint[] {
  const evolution: FatigueEvolutionPoint[] = [];
  let cumulativeFatigue = 0;
  let totalFlightHours = 0;
  let totalSleepHours = 0;
  let timezoneChanges = 0;
  
  for (let d = 0; d < days; d++) {
    const currentDate = dayjs(startDate).add(d, 'day');
    const dayStart = currentDate.startOf('day');
    const dayEnd = currentDate.endOf('day');
    
    const dayDuties = duties.filter(duty => 
      dayjs(duty.departureTime).isAfter(dayStart) && 
      dayjs(duty.departureTime).isBefore(dayEnd)
    );
    
    const dayPhysio = physiologicalData.filter(p =>
      dayjs(p.timestamp).isAfter(dayStart) &&
      dayjs(p.timestamp).isBefore(dayEnd)
    );
    
    const dayFlightHours = dayDuties.reduce((sum, duty) => sum + duty.flightHours, 0);
    const daySleepHours = dayPhysio.length > 0 
      ? dayPhysio.reduce((sum, p) => sum + p.sleepDuration, 0) / dayPhysio.length 
      : 7;
    const dayTimezoneChanges = dayDuties.filter(duty => Math.abs(duty.timezoneDiff) >= 3).length;
    
    totalFlightHours += dayFlightHours;
    totalSleepHours += daySleepHours;
    timezoneChanges += dayTimezoneChanges;
    
    const dailyRecovery = Math.max(0, (daySleepHours - 6) * 5);
    const dailyFatigue = dayFlightHours * 3 + dayTimezoneChanges * 8;
    
    cumulativeFatigue = Math.max(0, cumulativeFatigue + dailyFatigue - dailyRecovery);
    cumulativeFatigue = Math.min(cumulativeFatigue, 100);
    
    const biorhythm = calculateBiorhythm(birthDate, currentDate.toISOString());
    const biorhythmInfluence = getBiorhythmInfluence(biorhythm);
    
    const baseScore = cumulativeFatigue * 0.6 + biorhythmInfluence * 20;
    const randomVariation = (Math.random() - 0.5) * 10;
    const fatigueScore = Math.min(Math.max(Math.round(baseScore + randomVariation), 0), 100);
    
    evolution.push({
      timestamp: currentDate.toISOString(),
      fatigueScore,
      riskLevel: getRiskLevel(fatigueScore),
      flightHoursAccumulated: Math.round(totalFlightHours * 10) / 10,
      sleepHoursAccumulated: Math.round(totalSleepHours * 10) / 10,
      timezoneChanges,
    });
  }
  
  return evolution;
}
