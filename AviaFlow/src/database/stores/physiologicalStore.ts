import { getDB } from '../schema';
import type { PhysiologicalData } from '../../types/medical';
import dayjs from 'dayjs';

export async function addPhysiologicalData(data: PhysiologicalData): Promise<string> {
  const db = await getDB();
  return db.add('physiologicalData', data);
}

export async function updatePhysiologicalData(data: PhysiologicalData): Promise<string> {
  const db = await getDB();
  return db.put('physiologicalData', data);
}

export async function getPhysiologicalData(id: string): Promise<PhysiologicalData | undefined> {
  const db = await getDB();
  return db.get('physiologicalData', id);
}

export async function getPhysiologicalDataByCrew(
  crewId: string,
  startDate?: string,
  endDate?: string
): Promise<PhysiologicalData[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('physiologicalData', 'by-crew', crewId);
  
  if (!startDate && !endDate) return all;
  
  return all.filter(d => {
    const ts = dayjs(d.timestamp);
    if (startDate && ts.isBefore(dayjs(startDate))) return false;
    if (endDate && ts.isAfter(dayjs(endDate).endOf('day'))) return false;
    return true;
  }).sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf());
}

export async function getLatestPhysiologicalData(crewId: string): Promise<PhysiologicalData | undefined> {
  const data = await getPhysiologicalDataByCrew(crewId);
  return data.sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf())[0];
}

export async function getPhysiologicalDataByTimeRange(
  startDate: string,
  endDate: string
): Promise<PhysiologicalData[]> {
  const db = await getDB();
  const all = await db.getAll('physiologicalData');
  return all.filter(d => {
    const ts = dayjs(d.timestamp);
    return ts.isAfter(dayjs(startDate)) && ts.isBefore(dayjs(endDate).endOf('day'));
  }).sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf());
}

export async function bulkAddPhysiologicalData(dataList: PhysiologicalData[]): Promise<string[]> {
  const db = await getDB();
  const tx = db.transaction('physiologicalData', 'readwrite');
  const promises = dataList.map(d => tx.store.add(d));
  const results = await Promise.all(promises);
  await tx.done;
  return results;
}

export async function getPhysiologicalStats(crewId: string, days: number = 7) {
  const endDate = dayjs();
  const startDate = endDate.subtract(days, 'day');
  const data = await getPhysiologicalDataByCrew(crewId, startDate.toISOString(), endDate.toISOString());
  
  if (data.length === 0) return null;
  
  const stats = {
    avgHeartRate: data.reduce((sum, d) => sum + d.heartRate, 0) / data.length,
    avgHrv: data.reduce((sum, d) => sum + d.hrv, 0) / data.length,
    avgSleepQuality: data.reduce((sum, d) => sum + d.sleepQuality, 0) / data.length,
    avgSleepDuration: data.reduce((sum, d) => sum + d.sleepDuration, 0) / data.length,
    avgReactionTime: data.reduce((sum, d) => sum + d.reactionTime, 0) / data.length,
    avgStressLevel: data.reduce((sum, d) => sum + d.stressLevel, 0) / data.length,
    dataPoints: data.length,
    timeRange: { start: startDate.toISOString(), end: endDate.toISOString() },
  };
  
  return stats;
}
