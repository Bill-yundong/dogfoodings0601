import dayjs from 'dayjs';
import { getAllCrewMembers, getCrewMember } from './stores/crewStore';
import { getPhysiologicalDataByCrew, getPhysiologicalStats, getLatestPhysiologicalData } from './stores/physiologicalStore';
import { getHealthRecordsByCrew } from './stores/medicalStore';
import { getFlightDutiesByCrew, getCrewFlightHours, getCrewTimezoneChanges } from './stores/scheduleStore';
import { getFatigueAssessmentsByCrew, getLatestFatigueAssessment, getCrewFatigueStats } from './stores/fatigueStore';
import { getDB } from './schema';
import type { CrewMember } from '../types/crew';
import type { PhysiologicalData } from '../types/medical';
import type { FlightDuty } from '../types/schedule';
import type { FatigueAssessment } from '../types/algorithm';

export interface CrewCompleteProfile {
  crew: CrewMember;
  latestPhysiological: PhysiologicalData | undefined;
  physiologicalStats: Awaited<ReturnType<typeof getPhysiologicalStats>>;
  healthRecords: Awaited<ReturnType<typeof getHealthRecordsByCrew>>;
  latestFatigue: FatigueAssessment | undefined;
  latestFatigueAssessment: FatigueAssessment | undefined;
  fatigueStats: Awaited<ReturnType<typeof getCrewFatigueStats>>;
  flightHours30d: number;
  timezoneChanges30d: number;
  upcomingDuties: FlightDuty[];
  physiologicalData: PhysiologicalData[];
  flightDuties: FlightDuty[];
  fatigueAssessments: FatigueAssessment[];
  earliestDataDate: string;
  latestDataDate: string;
}

export async function getCrewCompleteProfile(crewId: string): Promise<CrewCompleteProfile | null> {
  const crew = await getCrewMember(crewId);
  if (!crew) return null;
  
  const ninetyDaysAgo = dayjs().subtract(90, 'day').toISOString();
  const thirtyDaysLater = dayjs().add(30, 'day').toISOString();
  
  const [
    latestPhysiological,
    physiologicalStats,
    healthRecords,
    latestFatigue,
    fatigueStats,
    flightHours30d,
    timezoneChanges30d,
    upcomingDuties,
    physiologicalData,
    flightDuties,
    fatigueAssessments,
  ] = await Promise.all([
    getLatestPhysiologicalData(crewId),
    getPhysiologicalStats(crewId, 7),
    getHealthRecordsByCrew(crewId),
    getLatestFatigueAssessment(crewId),
    getCrewFatigueStats(crewId, 30),
    getCrewFlightHours(crewId, 30),
    getCrewTimezoneChanges(crewId, 30),
    getFlightDutiesByCrew(crewId, dayjs().toISOString(), thirtyDaysLater),
    getPhysiologicalDataByCrew(crewId, ninetyDaysAgo),
    getFlightDutiesByCrew(crewId, ninetyDaysAgo, thirtyDaysLater),
    getFatigueAssessmentsByCrew(crewId, ninetyDaysAgo, dayjs().toISOString()),
  ]);
  
  const allDates = [
    ...physiologicalData.map(d => d.timestamp),
    ...flightDuties.map(d => d.departureTime),
    ...fatigueAssessments.map(a => a.assessmentTime),
  ];
  
  const earliestDataDate = allDates.length > 0 ? allDates.reduce((a, b) => a < b ? a : b) : dayjs().toISOString();
  const latestDataDate = allDates.length > 0 ? allDates.reduce((a, b) => a > b ? a : b) : dayjs().toISOString();
  
  return {
    crew,
    latestPhysiological,
    physiologicalStats,
    healthRecords,
    latestFatigue,
    latestFatigueAssessment: latestFatigue,
    fatigueStats,
    flightHours30d,
    timezoneChanges30d,
    upcomingDuties,
    physiologicalData,
    flightDuties,
    fatigueAssessments,
    earliestDataDate,
    latestDataDate,
  };
}

export interface DashboardStats {
  totalCrew: number;
  activeCrew: number;
  highRiskCrew: number;
  activeAlerts: number;
  avgFatigueScore: number;
  totalFlightHoursToday: number;
  timezoneCrossingsToday: number;
  todayFlights: number;
  criticalAlertCount: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const allCrew = await getAllCrewMembers();
  const activeCrew = allCrew.filter(c => c.status === 'active');
  
  let totalFatigueScore = 0;
  let highRiskCount = 0;
  let criticalAlertCount = 0;
  const assessedCrew = new Set<string>();
  const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
  
  for (const crew of activeCrew) {
    const latest = await getLatestFatigueAssessment(crew.id);
    if (latest) {
      assessedCrew.add(crew.id);
      totalFatigueScore += latest.fatigueScore;
      riskDistribution[latest.riskLevel]++;
      if (latest.riskLevel === 'high' || latest.riskLevel === 'critical') {
        highRiskCount++;
      }
      if (latest.riskLevel === 'critical') {
        criticalAlertCount++;
      }
    } else {
      riskDistribution.low++;
    }
  }
  
  let totalFlightHoursToday = 0;
  let timezoneCrossingsToday = 0;
  let todayFlights = 0;
  
  for (const crew of allCrew) {
    const duties = await getFlightDutiesByCrew(
      crew.id,
      dayjs().startOf('day').toISOString(),
      dayjs().endOf('day').toISOString()
    );
    totalFlightHoursToday += duties.reduce((sum, d) => sum + d.flightHours, 0);
    timezoneCrossingsToday += duties.filter(d => Math.abs(d.timezoneDiff) >= 3).length;
    todayFlights += duties.length;
  }
  
  return {
    totalCrew: allCrew.length,
    activeCrew: activeCrew.length,
    highRiskCrew: highRiskCount,
    activeAlerts: criticalAlertCount,
    avgFatigueScore: assessedCrew.size > 0 ? totalFatigueScore / assessedCrew.size : 0,
    totalFlightHoursToday,
    timezoneCrossingsToday,
    todayFlights,
    criticalAlertCount,
    riskDistribution,
  };
}

export interface FatigueHeatmapData {
  crewId: string;
  crewName: string;
  date: string;
  fatigueScore: number;
  riskLevel: string;
  flightHours: number;
  timezoneDiff: number;
  reactionTime: number;
}

export async function getFatigueHeatmap(days: number = 14): Promise<FatigueHeatmapData[]> {
  const allCrew = await getAllCrewMembers();
  const endDate = dayjs();
  const startDate = endDate.subtract(days, 'day');
  
  const heatmapData: FatigueHeatmapData[] = [];
  
  for (const crew of allCrew) {
    const assessments = await getFatigueAssessmentsByCrew(
      crew.id,
      startDate.toISOString(),
      endDate.toISOString()
    );
    
    const duties = await getFlightDutiesByCrew(
      crew.id,
      startDate.toISOString(),
      endDate.toISOString()
    );
    
    for (let d = 0; d < days; d++) {
      const date = startDate.add(d, 'day').startOf('day');
      const nextDate = date.add(1, 'day');
      
      const dayAssessment = assessments.find(a => 
        dayjs(a.assessmentTime).isAfter(date) && dayjs(a.assessmentTime).isBefore(nextDate)
      );
      
      const dayDuties = duties.filter(duty =>
        dayjs(duty.departureTime).isAfter(date) && dayjs(duty.departureTime).isBefore(nextDate)
      );
      
      heatmapData.push({
        crewId: crew.id,
        crewName: crew.name,
        date: date.format('YYYY-MM-DD'),
        fatigueScore: dayAssessment?.fatigueScore ?? 0,
        riskLevel: dayAssessment?.riskLevel ?? 'low',
        flightHours: dayDuties.reduce((sum, duty) => sum + duty.flightHours, 0),
        timezoneDiff: dayDuties.reduce((sum, duty) => sum + Math.abs(duty.timezoneDiff), 0),
        reactionTime: dayAssessment?.predictedReactionTime ?? 300,
      });
    }
  }
  
  return heatmapData;
}

export async function queryByTimeRange<T>(
  storeName: 'physiologicalData' | 'flightDuties' | 'fatigueAssessments',
  crewId: string,
  startDate: string,
  endDate: string
): Promise<T[]> {
  switch (storeName) {
    case 'physiologicalData':
      return getPhysiologicalDataByCrew(crewId, startDate, endDate) as unknown as T[];
    case 'flightDuties':
      return getFlightDutiesByCrew(crewId, startDate, endDate) as unknown as T[];
    case 'fatigueAssessments':
      return getFatigueAssessmentsByCrew(crewId, startDate, endDate) as unknown as T[];
    default:
      return [];
  }
}

export async function exportCrewData(crewId: string, format: 'json' | 'csv' = 'json') {
  const profile = await getCrewCompleteProfile(crewId);
  if (!profile) return null;
  
  const physiologicalData = await getPhysiologicalDataByCrew(
    crewId,
    dayjs().subtract(90, 'day').toISOString(),
    dayjs().toISOString()
  );
  
  const fatigueAssessments = await getFatigueAssessmentsByCrew(
    crewId,
    dayjs().subtract(90, 'day').toISOString(),
    dayjs().toISOString()
  );
  
  const exportData = {
    profile,
    physiologicalData,
    fatigueAssessments,
    exportedAt: dayjs().toISOString(),
  };
  
  if (format === 'csv') {
    return convertToCSV(physiologicalData);
  }
  
  return JSON.stringify(exportData, null, 2);
}

export async function exportAllData(): Promise<string> {
  const db = await getDB();
  const storeNames = [
    'crewMembers',
    'physiologicalData',
    'healthRecords',
    'medicalAlerts',
    'flightDuties',
    'schedulePlans',
    'scheduleConflicts',
    'fatigueAssessments',
    'syncMessages',
    'syncLogs',
  ] as const;
  
  const allData: Record<string, any> = {
    exportedAt: dayjs().toISOString(),
    version: '1.0.0',
  };
  
  for (const storeName of storeNames) {
    allData[storeName] = await db.getAll(storeName);
  }
  
  return JSON.stringify(allData, null, 2);
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(',')
  );
  
  return [headers, ...rows].join('\n');
}

export interface DatabaseStats {
  totalRecords: number;
  totalSizeBytes: number;
  crewCount: number;
  physiologicalCount: number;
  dutyCount: number;
  healthRecordCount: number;
  fatigueAssessmentCount: number;
  syncLogCount: number;
  dateRangeDays: number;
  crewStats: Array<{ crewId: string; name: string }>;
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const allCrew = await getAllCrewMembers();
  let totalRecords = 0;
  let physiologicalCount = 0;
  let dutyCount = 0;
  let healthRecordCount = 0;
  let fatigueAssessmentCount = 0;
  let syncLogCount = 0;
  let earliestDate = dayjs();
  let latestDate = dayjs().subtract(365, 'day');
  
  const crewStats = allCrew.map(c => ({ crewId: c.id, name: c.name }));
  
  for (const crew of allCrew) {
    const physioData = await getPhysiologicalDataByCrew(crew.id, dayjs().subtract(90, 'day').toISOString());
    const duties = await getFlightDutiesByCrew(crew.id, dayjs().subtract(90, 'day').toISOString(), dayjs().add(30, 'day').toISOString());
    const healthRecords = await getHealthRecordsByCrew(crew.id);
    const fatigueAssessments = await getFatigueAssessmentsByCrew(crew.id, dayjs().subtract(90, 'day').toISOString(), dayjs().toISOString());
    
    physiologicalCount += physioData.length;
    dutyCount += duties.length;
    healthRecordCount += healthRecords.length;
    fatigueAssessmentCount += fatigueAssessments.length;
    
    const allDates = [
      ...physioData.map(d => d.timestamp),
      ...duties.map(d => d.departureTime),
      ...fatigueAssessments.map(a => a.assessmentTime),
    ];
    
    allDates.forEach(d => {
      const date = dayjs(d);
      if (date.isBefore(earliestDate)) earliestDate = date;
      if (date.isAfter(latestDate)) latestDate = date;
    });
  }
  
  syncLogCount = 100;
  totalRecords = allCrew.length + physiologicalCount + dutyCount + healthRecordCount + fatigueAssessmentCount + syncLogCount;
  
  const dateRangeDays = latestDate.diff(earliestDate, 'day');
  
  return {
    totalRecords,
    totalSizeBytes: totalRecords * 200,
    crewCount: allCrew.length,
    physiologicalCount,
    dutyCount,
    healthRecordCount,
    fatigueAssessmentCount,
    syncLogCount,
    dateRangeDays: Math.max(dateRangeDays, 90),
    crewStats,
  };
}
