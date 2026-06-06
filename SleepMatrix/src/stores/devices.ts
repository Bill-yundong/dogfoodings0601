import { createStore, produce } from 'solid-js/store';
import type { Device, DeviceConfig, DeviceCommand } from '@/types/device';
import { generateMockDevices, generateDeviceConfig } from '@/mock/devices';

interface DevicesState {
  devices: Device[];
  configs: Map<string, DeviceConfig>;
  selectedDeviceId: string | null;
  commands: DeviceCommand[];
  isLoading: boolean;
  error: string | null;
}

const initialState: DevicesState = {
  devices: [],
  configs: new Map(),
  selectedDeviceId: null,
  commands: [],
  isLoading: false,
  error: null,
};

const [state, setState] = createStore<DevicesState>(initialState);

export const devicesStore = state;

export const devicesActions = {
  loadDevices: async (userId: string) => {
    setState('isLoading', true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const devices = generateMockDevices(userId);
      const configs = new Map<string, DeviceConfig>();

      devices.forEach(device => {
        configs.set(device.id, generateDeviceConfig(device.id));
      });

      setState(produce(s => {
        s.devices = devices;
        s.configs = configs;
        s.isLoading = false;
        if (devices.length > 0 && !s.selectedDeviceId) {
          s.selectedDeviceId = devices[0].id;
        }
      }));

      return devices;
    } catch (error) {
      setState(produce(s => {
        s.isLoading = false;
        s.error = error instanceof Error ? error.message : '加载设备失败';
      }));
      throw error;
    }
  },

  selectDevice: (deviceId: string | null) => {
    setState('selectedDeviceId', deviceId);
  },

  getSelectedDevice: (): Device | null => {
    if (!state.selectedDeviceId) return null;
    return state.devices.find(d => d.id === state.selectedDeviceId) || null;
  },

  getDeviceConfig: (deviceId: string): DeviceConfig | undefined => {
    return state.configs.get(deviceId);
  },

  updateDeviceStatus: (deviceId: string, status: Device['status']) => {
    setState(produce(s => {
      const device = s.devices.find(d => d.id === deviceId);
      if (device) {
        device.status = status;
        device.lastOnline = Date.now();
      }
    }));
  },

  updateDeviceConfig: (deviceId: string, config: Partial<DeviceConfig>) => {
    setState(produce(s => {
      const existing = s.configs.get(deviceId);
      if (existing) {
        s.configs.set(deviceId, {
          ...existing,
          ...config,
          updatedAt: Date.now(),
        });
      }
    }));
  },

  sendCommand: (command: DeviceCommand) => {
    setState(produce(s => {
      s.commands.unshift(command);
      if (s.commands.length > 50) {
        s.commands.pop();
      }
    }));
  },

  refreshDevice: async (deviceId: string) => {
    setState('isLoading', true);

    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      setState(produce(s => {
        const device = s.devices.find(d => d.id === deviceId);
        if (device) {
          device.signalStrength = Math.floor(50 + Math.random() * 50);
          device.lastOnline = Date.now();
          if (device.batteryLevel !== undefined) {
            device.batteryLevel = Math.max(0, Math.min(100, device.batteryLevel + Math.floor(Math.random() * 10 - 5)));
          }
        }
        s.isLoading = false;
      }));
    } catch (error) {
      setState(produce(s => {
        s.isLoading = false;
        s.error = error instanceof Error ? error.message : '刷新设备失败';
      }));
      throw error;
    }
  },

  getOnlineDevices: (): Device[] => {
    return state.devices.filter(d => d.status === 'online');
  },

  clearError: () => {
    setState('error', null);
  },
};
