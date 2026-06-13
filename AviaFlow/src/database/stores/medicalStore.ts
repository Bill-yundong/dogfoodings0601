import { getDB } from '../schema';
import type { HealthRecord, MedicalAlert } from '../../types/medical';
import dayjs from 'dayjs';

export async function addHealthRecord(record: HealthRecord): Promise<string> {
  const db = await getDB();
  return db.add('healthRecords', record);
}

export async function updateHealthRecord(record: HealthRecord): Promise<string> {
  const db = await getDB();
  return db.put('healthRecords', record);
}

export async function getHealthRecordsByCrew(crewId: string): Promise<HealthRecord[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex('healthRecords', 'by-crew', crewId);
  return records.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
}

export async function addMedicalAlert(alert: MedicalAlert): Promise<string> {
  const db = await getDB();
  return db.add('medicalAlerts', alert);
}

export async function updateMedicalAlert(alert: MedicalAlert): Promise<string> {
  const db = await getDB();
  return db.put('medicalAlerts', alert);
}

export async function getMedicalAlerts(
  crewId?: string,
  acknowledged?: boolean,
  severity?: MedicalAlert['severity']
): Promise<MedicalAlert[]> {
  const db = await getDB();
  let alerts: MedicalAlert[];
  
  if (crewId) {
    alerts = await db.getAllFromIndex('medicalAlerts', 'by-crew', crewId);
  } else {
    alerts = await db.getAll('medicalAlerts');
  }
  
  if (acknowledged !== undefined) {
    alerts = alerts.filter(a => a.acknowledged === acknowledged);
  }
  
  if (severity) {
    alerts = alerts.filter(a => a.severity === severity);
  }
  
  return alerts.sort((a, b) => dayjs(b.triggeredAt).valueOf() - dayjs(a.triggeredAt).valueOf());
}

export async function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
  const db = await getDB();
  const alert = await db.get('medicalAlerts', alertId);
  if (alert) {
    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = dayjs().toISOString();
    await db.put('medicalAlerts', alert);
  }
}

export async function bulkAddHealthRecords(records: HealthRecord[]): Promise<string[]> {
  const db = await getDB();
  const tx = db.transaction('healthRecords', 'readwrite');
  const promises = records.map(r => tx.store.add(r));
  const results = await Promise.all(promises);
  await tx.done;
  return results;
}

export async function bulkAddMedicalAlerts(alerts: MedicalAlert[]): Promise<string[]> {
  const db = await getDB();
  const tx = db.transaction('medicalAlerts', 'readwrite');
  const promises = alerts.map(a => tx.store.add(a));
  const results = await Promise.all(promises);
  await tx.done;
  return results;
}
