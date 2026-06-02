import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SensorEvent } from '@/types'

export const useSensorStore = defineStore('sensor', () => {
  const events = ref<SensorEvent[]>([])
  const maxEvents = 200

  const recentEvents = computed(() =>
    [...events.value].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50)
  )

  const securityEvents = computed(() =>
    events.value.filter((e) => e.source === 'security_system')
  )

  const homeControlEvents = computed(() =>
    events.value.filter((e) => e.source === 'home_control')
  )

  const chartData = computed(() => {
    const now = Date.now()
    const windowMs = 60000
    const points = 20
    const step = windowMs / points
    const securityLine: number[] = []
    const homeControlLine: number[] = []
    const labels: string[] = []

    for (let i = 0; i < points; i++) {
      const from = now - windowMs + i * step
      const to = from + step
      labels.push(new Date(from).toLocaleTimeString('zh-CN', { minute: '2-digit', second: '2-digit' }))
      securityLine.push(events.value.filter((e) => e.source === 'security_system' && e.timestamp >= from && e.timestamp < to).length)
      homeControlLine.push(events.value.filter((e) => e.source === 'home_control' && e.timestamp >= from && e.timestamp < to).length)
    }
    return { labels, securityLine, homeControlLine }
  })

  function addEvent(event: SensorEvent) {
    events.value.push(event)
    if (events.value.length > maxEvents) {
      events.value = events.value.slice(-maxEvents)
    }
  }

  function clearEvents() {
    events.value = []
  }

  return { events, recentEvents, securityEvents, homeControlEvents, chartData, addEvent, clearEvents }
})
