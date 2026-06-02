<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useSensorStore } from '@/stores/sensor'
import Chart from 'chart.js/auto'

const sensorStore = useSensorStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

function createChart() {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  if (chartInstance) chartInstance.destroy()

  const data = sensorStore.chartData

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: '安防系统',
          data: data.securityLine,
          borderColor: '#ff9100',
          backgroundColor: 'rgba(255, 145, 0, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: '家居控制',
          data: data.homeControlLine,
          borderColor: '#00e5ff',
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        x: {
          grid: { color: 'rgba(0, 229, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 9 }, maxRotation: 0 },
        },
        y: {
          grid: { color: 'rgba(0, 229, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 9 }, stepSize: 1 },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Noto Sans SC', size: 11 }, boxWidth: 12, padding: 16 },
        },
      },
    },
  })
}

let updateInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  createChart()
  updateInterval = setInterval(() => {
    if (chartInstance && sensorStore.events.length > 0) {
      const data = sensorStore.chartData
      chartInstance.data.labels = data.labels
      chartInstance.data.datasets[0].data = data.securityLine
      chartInstance.data.datasets[1].data = data.homeControlLine
      chartInstance.update('none')
    }
  }, 3000)
})

onUnmounted(() => {
  if (chartInstance) chartInstance.destroy()
  if (updateInterval) clearInterval(updateInterval)
})
</script>

<template>
  <div class="glass-card p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="section-title text-sm text-cyan-glow">传感器数据流</h3>
      <span class="data-label">LIVE STREAM</span>
    </div>
    <div class="h-56">
      <canvas ref="canvasRef" />
    </div>
  </div>
</template>
