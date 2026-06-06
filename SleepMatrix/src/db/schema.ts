import type { DBSchema } from 'idb';
import type { SleepSession, EnvDataPoint, SleepStagePoint } from '@/types/data';
import type { Device, DeviceConfig } from '@/types/device';
import type { AnalysisResult, AnalysisTask } from '@/types/analysis';

export interface SleepMatrixDB extends DBSchema {
  sleep_sessions: {
    key: string;
    value: SleepSession;
    indexes: {
      'by-userId': string;
      'by-startTime': number;
      'by-scenario': string;
      'by-userId-startTime': [string, number];
    };
  };
  env_data_points: {
    key: string;
    value: EnvDataPoint;
    indexes: {
      'by-sessionId': string;
      'by-timestamp': number;
      'by-sessionId-timestamp': [string, number];
    };
  };
  sleep_stage_points: {
    key: string;
    value: SleepStagePoint;
    indexes: {
      'by-sessionId': string;
      'by-timestamp': number;
      'by-sessionId-timestamp': [string, number];
    };
  };
  analysis_results: {
    key: string;
    value: AnalysisResult;
    indexes: {
      'by-sessionId': string;
      'by-analyzedAt': number;
      'by-sessionId-analyzedAt': [string, number];
    };
  };
  analysis_tasks: {
    key: string;
    value: AnalysisTask;
    indexes: {
      'by-sessionId': string;
      'by-status': string;
      'by-createdAt': number;
    };
  };
  devices: {
    key: string;
    value: Device;
    indexes: {
      'by-userId': string;
      'by-status': string;
      'by-userId-status': [string, string];
    };
  };
  device_configs: {
    key: string;
    value: DeviceConfig;
    indexes: {
      'by-deviceId': string;
    };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: unknown;
      updatedAt: number;
    };
  };
}

export const DB_NAME = 'sleepmatrix_db';
export const DB_VERSION = 1;

export const STORE_NAMES = [
  'sleep_sessions',
  'env_data_points',
  'sleep_stage_points',
  'analysis_results',
  'analysis_tasks',
  'devices',
  'device_configs',
  'settings',
] as const;

export type StoreName = typeof STORE_NAMES[number];
