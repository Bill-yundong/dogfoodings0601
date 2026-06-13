import { initDB } from './index'
import type { DeviceStatus } from '@/types'

export async function saveDeviceStatus(status: DeviceStatus): Promise<void> {
  const db = await initDB()
  await db.put('device_status', status)
}

export async function getDeviceStatus(id: string): Promise<DeviceStatus | undefined> {
  const db = await initDB()
  return db.get('device_status', id)
}

export async function listDeviceStatus(type?: 'sensor' | 'controller'): Promise<DeviceStatus[]> {
  const db = await initDB()
  if (type) {
    return db.getAllFromIndex('device_status', 'by-type', type)
  }
  return db.getAll('device_status')
}

export async function updateDeviceStatus(id: string, updates: Partial<DeviceStatus>): Promise<DeviceStatus | undefined> {
  const db = await initDB()
  const existing = await db.get('device_status', id)
  if (!existing) return undefined

  const updated: DeviceStatus = {
    ...existing,
    ...updates,
    lastUpdate: Date.now(),
  }
  await db.put('device_status', updated)
  return updated
}
