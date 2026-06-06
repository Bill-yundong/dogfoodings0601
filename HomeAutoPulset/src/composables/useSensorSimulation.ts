import { ref, onUnmounted } from 'vue';
import type { SensorData, Device } from '@/types/device';
import { generateSensorData, mockDevices } from '@/utils/mockData';

export function useSensorSimulation() {
  const sensorDataStream = ref<SensorData[]>([]);
  const isRunning = ref(false);
  const intervalId = ref<number | null>(null);
  const updateInterval = ref(2000);
  const devices = ref<Device[]>([...mockDevices]);

  const generateData = () => {
    const activeDevices = devices.value.filter(d => d.status === 'online' && d.sensorTypes);
    if (activeDevices.length === 0) return;

    const randomDevice = activeDevices[Math.floor(Math.random() * activeDevices.length)];
    const data = generateSensorData(randomDevice);
    if (data) {
      sensorDataStream.value = [data, ...sensorDataStream.value.slice(0, 99)];

      const deviceIndex = devices.value.findIndex(d => d.id === randomDevice.id);
      if (deviceIndex !== -1) {
        devices.value[deviceIndex] = {
          ...devices.value[deviceIndex],
          lastActivity: Date.now(),
          currentState: {
            ...devices.value[deviceIndex].currentState,
            [data.sensorType]: data.value,
          },
        };
      }
    }
  };

  const startSimulation = () => {
    if (isRunning.value) return;
    isRunning.value = true;
    generateData();
    intervalId.value = window.setInterval(generateData, updateInterval.value);
  };

  const stopSimulation = () => {
    isRunning.value = false;
    if (intervalId.value) {
      clearInterval(intervalId.value);
      intervalId.value = null;
    }
  };

  const setUpdateInterval = (ms: number) => {
    updateInterval.value = ms;
    if (isRunning.value) {
      stopSimulation();
      startSimulation();
    }
  };

  const triggerManualData = (deviceId?: string): SensorData | null => {
    let device: Device | undefined;
    if (deviceId) {
      device = devices.value.find(d => d.id === deviceId);
    } else {
      const activeDevices = devices.value.filter(d => d.status === 'online' && d.sensorTypes);
      device = activeDevices[Math.floor(Math.random() * activeDevices.length)];
    }

    if (!device) return null;
    const data = generateSensorData(device);
    if (data) {
      sensorDataStream.value = [data, ...sensorDataStream.value.slice(0, 99)];
    }
    return data;
  };

  const getLatestDataByDevice = (deviceId: string): SensorData | undefined => {
    return sensorDataStream.value.find(d => d.deviceId === deviceId);
  };

  const getLatestDataByType = (sensorType: string): SensorData | undefined => {
    return sensorDataStream.value.find(d => d.sensorType === sensorType);
  };

  const getDeviceById = (deviceId: string): Device | undefined => {
    return devices.value.find(d => d.id === deviceId);
  };

  const updateDeviceStatus = (deviceId: string, status: Device['status']) => {
    const index = devices.value.findIndex(d => d.id === deviceId);
    if (index !== -1) {
      devices.value[index] = {
        ...devices.value[index],
        status,
        lastActivity: Date.now(),
      };
    }
  };

  const clearData = () => {
    sensorDataStream.value = [];
  };

  onUnmounted(() => {
    stopSimulation();
  });

  return {
    sensorDataStream,
    isRunning,
    devices,
    updateInterval,
    startSimulation,
    stopSimulation,
    setUpdateInterval,
    triggerManualData,
    getLatestDataByDevice,
    getLatestDataByType,
    getDeviceById,
    updateDeviceStatus,
    clearData,
  };
}
