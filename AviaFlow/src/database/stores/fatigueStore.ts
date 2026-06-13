import { getDB } from '../schema';
import type { FatigueAssessment, FatigueEvolutionPoint } from '../../types/algorithm';
import { getRiskLevel } from '../../types/algorithm';
import dayjs from 'dayjs';

export async function addFatigueAssessment(assessment: FatigueAssessment): Promise<string> {
  const db = await getDB();
  return db.add('fatigueAssessments', assessment);
}

export async function updateFatigueAssessment(assessment: FatigueAssessment): Promise<string> {
  const db = await getDB();
  return db.put('fatigueAssessments', assessment);
}

export async function getFatigueAssessment(id: string): Promise<FatigueAssessment | undefined> {
  const db = await getDB();
  return db.get('fatigueAssessments', id);
}

export async function getFatigueAssessmentsByCrew(
  crewId: string,
  startDate?: string,
  endDate?: string
): Promise<FatigueAssessment[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('fatigueAssessments', 'by-crew', crewId);
  
  if (!startDate && !endDate) return all;
  
  return all.filter(a => {
    const at = dayjs(a.assessmentTime);
    if (startDate && at.isBefore(dayjs(startDate))) return false;
    if (endDate && at.isAfter(dayjs(endDate).endOf('day'))) return false;
    return true;
  }).sort((a, b) => dayjs(a.assessmentTime).valueOf() - dayjs(b.assessmentTime).valueOf());
}

export async function getLatestFatigueAssessment(crewId: string): Promise<FatigueAssessment | undefined> {
  const db = await getDB();
  const all = await db.getAllFromIndex('fatigueAssessments', 'by-crew', crewId);
  return all.sort((a, b) => dayjs(b.assessmentTime).valueOf() - dayjs(a.assessmentTime).valueOf())[0];
}

export async function getFatigueAssessmentsByRisk(
  riskLevel: FatigueAssessment['riskLevel']
): Promise<FatigueAssessment[]> {
  const db = await getDB();
  return db.getAllFromIndex('fatigueAssessments', 'by-riskLevel', riskLevel);
}

export async function getFatigueByDuty(dutyId: string): Promise<FatigueAssessment | undefined> {
  const db = await getDB();
  const all = await db.getAllFromIndex('fatigueAssessments', 'by-duty', dutyId);
  return all[0];
}

export async function getFatigueEvolution(
  crewId: string,
  days: number = 7
): Promise<FatigueEvolutionPoint[]> {
  const endDate = dayjs();
  const startDate = endDate.subtract(days, 'day');
  const assessments = await getFatigueAssessmentsByCrew(crewId, startDate.toISOString(), endDate.toISOString());
  
  return assessments.map(a => ({
    timestamp: a.assessmentTime,
    fatigueScore: a.fatigueScore,
    riskLevel: a.riskLevel,
    flightHoursAccumulated: 0,
    sleepHoursAccumulated: 0,
    timezoneChanges: 0,
  }));
}

export async function getHighRiskCrewCount(): Promise<number> {
  const db = await getDB();
  const high = await db.getAllFromIndex('fatigueAssessments', 'by-riskLevel', 'high');
  const critical = await db.getAllFromIndex('fatigueAssessments', 'by-riskLevel', 'critical');
  
  const seenCrew = new Set<string>();
  [...high, ...critical].forEach(a => seenCrew.add(a.crewId));
  return seenCrew.size;
}

export async function bulkAddFatigueAssessments(assessments: FatigueAssessment[]): Promise<string[]> {
  const db = await getDB();
  const tx = db.transaction('fatigueAssessments', 'readwrite');
  const promises = assessments.map(a => tx.store.add(a));
  const results = await Promise.all(promises);
  await tx.done;
  return results;
}

export async function getCrewFatigueStats(crewId: string, days: number = 30) {
  const assessments = await getFatigueAssessmentsByCrew(
    crewId,
    dayjs().subtract(days, 'day').toISOString(),
    dayjs().toISOString()
  );
  
  if (assessments.length === 0) return null;
  
  const avgScore = assessments.reduce((sum, a) => sum + a.fatigueScore, 0) / assessments.length;
  const maxScore = Math.max(...assessments.map(a => a.fatigueScore));
  const riskDistribution = {
    low: assessments.filter(a => a.riskLevel === 'low').length,
    medium: assessments.filter(a => a.riskLevel === 'medium').length,
    high: assessments.filter(a => a.riskLevel === 'high').length,
    critical: assessments.filter(a => a.riskLevel === 'critical').length,
  };
  
  return {
    avgScore,
    maxScore,
    currentLevel: getRiskLevel(avgScore),
    riskDistribution,
    totalAssessments: assessments.length,
  };
}
