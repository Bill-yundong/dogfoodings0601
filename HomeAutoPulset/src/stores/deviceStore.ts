import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Device, SensorData } from '@/types/device';
import { mockDevices } from '@/utils/mockData';

export const useDeviceStore = defineStore('device', () => {
  const devices = ref<Device[]>([...mockDevices]);
  const selectedDevice = ref<Device | null>(null);
  const sensorDataHistory = ref<SensorData[]>([]);

  const onlineDevices = computed(() => devices.value.filter(d => d.status === 'online'));
  const offlineDevices = computed(() => devices.value.filter(d => d.status === 'offline'));
  const errorDevices = computed(() => devices.value.filter(d => d.status === 'error'));

  const securityDevices = computed(() => devices.value.filter(d => d.systemAffiliation === 'security' || d.systemAffiliation === 'both'));
  const homeControlDevices = computed(() => devices.value.filter(d => d.systemAffiliation === 'homeControl' || d.systemAffiliation === 'both'));

  const getDeviceById = (id: string): Device | undefined => {
    return devices.value.find(d => d.id === id);
  };

  const getDevicesByLocation = (location: string): Device[] => {
    return devices.value.filter(d => d.location === location);
  };

  const getDevicesByType = (type: string): Device[] => {
    return devices.value.filter(d => d.type === type);
  };

  const updateDeviceStatus = (deviceId: string, status: Device['status']) => {
    const device = devices.value.find(d => d.id === deviceId);
    if (device) {
      device.status = status;
      device.lastActivity = Date.now();
    }
  };

  const updateDeviceState = (deviceId: string, stateUpdates: Record<string, any>) => {
    const device = devices.value.find(d => d.id === deviceId);
    if (device) {
      device.currentState = { ...device.currentState, ...stateUpdates };
      device.lastActivity = Date.now();
    }
  };

  const addSensorData = (data: SensorData) => {
    sensorDataHistory.value = [data, ...sensorDataHistory.value.slice(0, 199)];
    updateDeviceState(data.deviceId, { [data.sensorType]: data.value });
  };

  const getLatestSensorData = (deviceId: string, sensorType?: string): SensorData | undefined => {
    if (sensorType) {
      return sensorDataHistory.value.find(d => d.deviceId === deviceId && d.sensorType === sensorType);
    }
    return sensorDataHistory.value.find(d => d.deviceId === deviceId);
  };

  const selectDevice = (device: Device | null) => {
    selectedDevice.value = device;
  };

  return {
    devices,
    selectedDevice,
    sensorDataHistory,
    onlineDevices,
    offlineDevices,
    errorDevices,
    securityDevices,
    homeControlDevices,
    getDeviceById,
    getDevicesByLocation,
    getDevicesByType,
    updateDeviceStatus,
    updateDeviceState,
    addSensorData,
    getLatestSensorData,
    selectDevice,
  };
});
