import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SmartDevice } from '@/types'

const INITIAL_DEVICES: SmartDevice[] = [
  { id: 'dev-door-lock', name: '智能门锁', room: '客厅', type: 'lock', source: 'security_system', status: 'online', state: { locked: true }, lastUpdate: Date.now() },
  { id: 'dev-door-sensor', name: '门磁传感器', room: '客厅', type: 'sensor', source: 'security_system', status: 'online', state: { open: false }, lastUpdate: Date.now() },
  { id: 'dev-motion', name: '移动侦测器', room: '客厅', type: 'sensor', source: 'security_system', status: 'online', state: { detected: false }, lastUpdate: Date.now() },
  { id: 'dev-camera', name: '安防摄像头', room: '客厅', type: 'camera', source: 'security_system', status: 'online', state: { recording: false }, lastUpdate: Date.now() },
  { id: 'dev-alarm', name: '入侵警报器', room: '客厅', type: 'alarm', source: 'security_system', status: 'online', state: { armed: false }, lastUpdate: Date.now() },
  { id: 'dev-smoke', name: '烟感探测器', room: '厨房', type: 'sensor', source: 'security_system', status: 'online', state: { ppm: 12 }, lastUpdate: Date.now() },
  { id: 'dev-emergency', name: '紧急按钮', room: '卧室', type: 'alarm', source: 'security_system', status: 'online', state: { pressed: false }, lastUpdate: Date.now() },
  { id: 'dev-light-living', name: '客厅主灯', room: '客厅', type: 'light', source: 'home_control', status: 'online', state: { brightness: 80, color: '#ffffff' }, lastUpdate: Date.now() },
  { id: 'dev-light-bedroom', name: '卧室灯', room: '卧室', type: 'light', source: 'home_control', status: 'online', state: { brightness: 60, color: '#fff5e6' }, lastUpdate: Date.now() },
  { id: 'dev-ac', name: '中央空调', room: '客厅', type: 'thermostat', source: 'home_control', status: 'online', state: { temp: 24, mode: 'cool' }, lastUpdate: Date.now() },
  { id: 'dev-curtain', name: '智能窗帘', room: '客厅', type: 'curtain', source: 'home_control', status: 'online', state: { position: 70 }, lastUpdate: Date.now() },
  { id: 'dev-vent', name: '新风系统', room: '全屋', type: 'switch', source: 'home_control', status: 'online', state: { speed: 'auto' }, lastUpdate: Date.now() },
  { id: 'dev-shutoff', name: '燃气关断阀', room: '厨房', type: 'switch', source: 'home_control', status: 'online', state: { closed: false }, lastUpdate: Date.now() },
  { id: 'dev-camera-door', name: '门口摄像头', room: '门厅', type: 'camera', source: 'security_system', status: 'online', state: { recording: true }, lastUpdate: Date.now() },
  { id: 'dev-light-door', name: '门厅灯', room: '门厅', type: 'light', source: 'home_control', status: 'online', state: { brightness: 100 }, lastUpdate: Date.now() },
  { id: 'dev-window-sensor', name: '窗户传感器', room: '卧室', type: 'sensor', source: 'security_system', status: 'offline', state: { open: false }, lastUpdate: Date.now() },
]

export const useDeviceStore = defineStore('devices', () => {
  const devices = ref<SmartDevice[]>([...INITIAL_DEVICES])
  const selectedRoom = ref<string>('all')

  const rooms = computed(() => {
    const set = new Set(devices.value.map((d) => d.room))
    return ['all', ...Array.from(set)]
  })

  const filteredDevices = computed(() => {
    if (selectedRoom.value === 'all') return devices.value
    return devices.value.filter((d) => d.room === selectedRoom.value)
  })

  const onlineCount = computed(() => devices.value.filter((d) => d.status === 'online').length)
  const offlineCount = computed(() => devices.value.filter((d) => d.status === 'offline').length)
  const warningCount = computed(() => devices.value.filter((d) => d.status === 'warning').length)
  const securityDevices = computed(() => devices.value.filter((d) => d.source === 'security_system'))
  const homeDevices = computed(() => devices.value.filter((d) => d.source === 'home_control'))

  function updateDeviceState(deviceId: string, state: Record<string, unknown>) {
    const dev = devices.value.find((d) => d.id === deviceId)
    if (dev) {
      dev.state = { ...dev.state, ...state }
      dev.lastUpdate = Date.now()
    }
  }

  function setDeviceStatus(deviceId: string, status: SmartDevice['status']) {
    const dev = devices.value.find((d) => d.id === deviceId)
    if (dev) dev.status = status
  }

  return { devices, selectedRoom, rooms, filteredDevices, onlineCount, offlineCount, warningCount, securityDevices, homeDevices, updateDeviceState, setDeviceStatus }
})
