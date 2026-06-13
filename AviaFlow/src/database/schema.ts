import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { CrewMember } from '../types/crew';
import type { PhysiologicalData, HealthRecord, MedicalAlert } from '../types/medical';
import type { FlightDuty, SchedulePlan, ScheduleConflict } from '../types/schedule';
import type { FatigueAssessment, SyncLog, SyncMessage } from '../types/algorithm';

export interface AviaFlowDB extends DBSchema {
  crewMembers: {
    key: string;
    value: CrewMember;
    indexes: {
      'by-role': string;
      'by-status': string;
      'by-name': string;
    };
  };
  physiologicalData: {
    key: string;
    value: PhysiologicalData;
    indexes: {
      'by-crew': string;
      'by-timestamp': string;
      'by-crew-timestamp': [string, string];
      'by-source': string;
    };
  };
  healthRecords: {
    key: string;
    value: HealthRecord;
    indexes: {
      'by-crew': string;
      'by-date': string;
      'by-type': string;
    };
  };
  medicalAlerts: {
    key: string;
    value: MedicalAlert;
    indexes: {
      'by-crew': string;
      'by-severity': string;
      'by-triggeredAt': string;
      'by-acknowledged': string;
    };
  };
  flightDuties: {
    key: string;
    value: FlightDuty;
    indexes: {
      'by-crew': string;
      'by-schedule': string;
      'by-departureTime': string;
      'by-status': string;
      'by-crew-departure': [string, string];
    };
  };
  schedulePlans: {
    key: string;
    value: SchedulePlan;
    indexes: {
      'by-status': string;
      'by-dateRange': [string, string];
      'by-createdBy': string;
    };
  };
  scheduleConflicts: {
    key: string;
    value: ScheduleConflict;
    indexes: {
      'by-schedule': string;
      'by-severity': string;
      'by-type': string;
      'by-resolved': string;
    };
  };
  fatigueAssessments: {
    key: string;
    value: FatigueAssessment;
    indexes: {
      'by-crew': string;
      'by-duty': string;
      'by-assessmentTime': string;
      'by-riskLevel': string;
      'by-crew-time': [string, string];
    };
  };
  syncMessages: {
    key: string;
    value: SyncMessage;
    indexes: {
      'by-type': string;
      'by-source': string;
      'by-target': string;
      'by-timestamp': string;
      'by-status': string;
    };
  };
  syncLogs: {
    key: string;
    value: SyncLog;
    indexes: {
      'by-source': string;
      'by-target': string;
      'by-syncTime': string;
      'by-status': string;
      'by-record': [string, string];
    };
  };
}

export const DB_NAME = 'AviaFlowDB';
export const DB_VERSION = 1;

export async function initDB(): Promise<IDBPDatabase<AviaFlowDB>> {
  return openDB<AviaFlowDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('crewMembers')) {
        const crewStore = db.createObjectStore('crewMembers', { keyPath: 'id' });
        crewStore.createIndex('by-role', 'role');
        crewStore.createIndex('by-status', 'status');
        crewStore.createIndex('by-name', 'name');
      }

      if (!db.objectStoreNames.contains('physiologicalData')) {
        const physioStore = db.createObjectStore('physiologicalData', { keyPath: 'id' });
        physioStore.createIndex('by-crew', 'crewId');
        physioStore.createIndex('by-timestamp', 'timestamp');
        physioStore.createIndex('by-crew-timestamp', ['crewId', 'timestamp']);
        physioStore.createIndex('by-source', 'source');
      }

      if (!db.objectStoreNames.contains('healthRecords')) {
        const healthStore = db.createObjectStore('healthRecords', { keyPath: 'id' });
        healthStore.createIndex('by-crew', 'crewId');
        healthStore.createIndex('by-date', 'date');
        healthStore.createIndex('by-type', 'recordType');
      }

      if (!db.objectStoreNames.contains('medicalAlerts')) {
        const alertStore = db.createObjectStore('medicalAlerts', { keyPath: 'id' });
        alertStore.createIndex('by-crew', 'crewId');
        alertStore.createIndex('by-severity', 'severity');
        alertStore.createIndex('by-triggeredAt', 'triggeredAt');
        alertStore.createIndex('by-acknowledged', 'acknowledged');
      }

      if (!db.objectStoreNames.contains('flightDuties')) {
        const dutyStore = db.createObjectStore('flightDuties', { keyPath: 'id' });
        dutyStore.createIndex('by-crew', 'crewId');
        dutyStore.createIndex('by-schedule', 'scheduleId');
        dutyStore.createIndex('by-departureTime', 'departureTime');
        dutyStore.createIndex('by-status', 'status');
        dutyStore.createIndex('by-crew-departure', ['crewId', 'departureTime']);
      }

      if (!db.objectStoreNames.contains('schedulePlans')) {
        const scheduleStore = db.createObjectStore('schedulePlans', { keyPath: 'id' });
        scheduleStore.createIndex('by-status', 'status');
        scheduleStore.createIndex('by-dateRange', ['startDate', 'endDate']);
        scheduleStore.createIndex('by-createdBy', 'createdBy');
      }

      if (!db.objectStoreNames.contains('scheduleConflicts')) {
        const conflictStore = db.createObjectStore('scheduleConflicts', { keyPath: 'id' });
        conflictStore.createIndex('by-schedule', 'scheduleId');
        conflictStore.createIndex('by-severity', 'severity');
        conflictStore.createIndex('by-type', 'type');
        conflictStore.createIndex('by-resolved', 'resolved');
      }

      if (!db.objectStoreNames.contains('fatigueAssessments')) {
        const fatigueStore = db.createObjectStore('fatigueAssessments', { keyPath: 'id' });
        fatigueStore.createIndex('by-crew', 'crewId');
        fatigueStore.createIndex('by-duty', 'dutyId');
        fatigueStore.createIndex('by-assessmentTime', 'assessmentTime');
        fatigueStore.createIndex('by-riskLevel', 'riskLevel');
        fatigueStore.createIndex('by-crew-time', ['crewId', 'assessmentTime']);
      }

      if (!db.objectStoreNames.contains('syncMessages')) {
        const msgStore = db.createObjectStore('syncMessages', { keyPath: 'id' });
        msgStore.createIndex('by-type', 'type');
        msgStore.createIndex('by-source', 'source');
        msgStore.createIndex('by-target', 'target');
        msgStore.createIndex('by-timestamp', 'timestamp');
        msgStore.createIndex('by-status', 'status');
      }

      if (!db.objectStoreNames.contains('syncLogs')) {
        const logStore = db.createObjectStore('syncLogs', { keyPath: 'id' });
        logStore.createIndex('by-source', 'source');
        logStore.createIndex('by-target', 'target');
        logStore.createIndex('by-syncTime', 'syncTime');
        logStore.createIndex('by-status', 'status');
        logStore.createIndex('by-record', ['source', 'recordId']);
      }
    },
  });
}

let dbInstance: IDBPDatabase<AviaFlowDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AviaFlowDB>> {
  if (!dbInstance) {
    dbInstance = await initDB();
  }
  return dbInstance;
}

export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function clearAllData(): Promise<void> {
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
  
  const tx = db.transaction(storeNames, 'readwrite');
  
  await Promise.all(
    storeNames.map(name => tx.objectStore(name).clear())
  );
  
  await tx.done;
}
