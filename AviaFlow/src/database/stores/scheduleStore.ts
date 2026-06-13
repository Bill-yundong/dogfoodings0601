import { getDB } from '../schema';
import type { FlightDuty, SchedulePlan, ScheduleConflict } from '../../types/schedule';
import dayjs from 'dayjs';

export async function addSchedulePlan(plan: SchedulePlan): Promise<string> {
  const db = await getDB();
  return db.add('schedulePlans', plan);
}

export async function updateSchedulePlan(plan: SchedulePlan): Promise<string> {
  const db = await getDB();
  return db.put('schedulePlans', plan);
}

export async function getSchedulePlan(id: string): Promise<SchedulePlan | undefined> {
  const db = await getDB();
  return db.get('schedulePlans', id);
}

export async function getAllSchedulePlans(): Promise<SchedulePlan[]> {
  const db = await getDB();
  const plans = await db.getAll('schedulePlans');
  return plans.sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
}

export async function getSchedulePlansByStatus(status: SchedulePlan['status']): Promise<SchedulePlan[]> {
  const db = await getDB();
  return db.getAllFromIndex('schedulePlans', 'by-status', status);
}

export async function addFlightDuty(duty: FlightDuty): Promise<string> {
  const db = await getDB();
  return db.add('flightDuties', duty);
}

export async function updateFlightDuty(duty: FlightDuty): Promise<string> {
  const db = await getDB();
  return db.put('flightDuties', duty);
}

export async function getFlightDutiesBySchedule(scheduleId: string): Promise<FlightDuty[]> {
  const db = await getDB();
  const duties = await db.getAllFromIndex('flightDuties', 'by-schedule', scheduleId);
  return duties.sort((a, b) => dayjs(a.departureTime).valueOf() - dayjs(b.departureTime).valueOf());
}

export async function getFlightDutiesByCrew(
  crewId: string,
  startDate?: string,
  endDate?: string
): Promise<FlightDuty[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('flightDuties', 'by-crew', crewId);
  
  if (!startDate && !endDate) return all;
  
  return all.filter(d => {
    const dt = dayjs(d.departureTime);
    if (startDate && dt.isBefore(dayjs(startDate))) return false;
    if (endDate && dt.isAfter(dayjs(endDate).endOf('day'))) return false;
    return true;
  }).sort((a, b) => dayjs(a.departureTime).valueOf() - dayjs(b.departureTime).valueOf());
}

export async function addScheduleConflict(conflict: ScheduleConflict): Promise<string> {
  const db = await getDB();
  return db.add('scheduleConflicts', conflict);
}

export async function updateScheduleConflict(conflict: ScheduleConflict): Promise<string> {
  const db = await getDB();
  return db.put('scheduleConflicts', conflict);
}

export async function getScheduleConflicts(scheduleId: string, resolved?: boolean): Promise<ScheduleConflict[]> {
  const db = await getDB();
  let conflicts = await db.getAllFromIndex('scheduleConflicts', 'by-schedule', scheduleId);
  
  if (resolved !== undefined) {
    conflicts = conflicts.filter(c => c.resolved === resolved);
  }
  
  return conflicts;
}

export async function resolveConflict(conflictId: string, resolution: string): Promise<void> {
  const db = await getDB();
  const conflict = await db.get('scheduleConflicts', conflictId);
  if (conflict) {
    conflict.resolved = true;
    conflict.resolution = resolution;
    await db.put('scheduleConflicts', conflict);
  }
}

export async function bulkAddFlightDuties(duties: FlightDuty[]): Promise<string[]> {
  const db = await getDB();
  const tx = db.transaction('flightDuties', 'readwrite');
  const promises = duties.map(d => tx.store.add(d));
  const results = await Promise.all(promises);
  await tx.done;
  return results;
}

export async function getCrewFlightHours(crewId: string, days: number = 30): Promise<number> {
  const endDate = dayjs();
  const startDate = endDate.subtract(days, 'day');
  const duties = await getFlightDutiesByCrew(crewId, startDate.toISOString(), endDate.toISOString());
  return duties.reduce((sum, d) => sum + d.flightHours, 0);
}

export async function getCrewTimezoneChanges(crewId: string, days: number = 30): Promise<number> {
  const endDate = dayjs();
  const startDate = endDate.subtract(days, 'day');
  const duties = await getFlightDutiesByCrew(crewId, startDate.toISOString(), endDate.toISOString());
  return duties.filter(d => Math.abs(d.timezoneDiff) >= 3).length;
}
