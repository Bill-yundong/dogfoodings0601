<script setup lang="ts">
import { computed } from 'vue';
import * as echarts from 'echarts';
import VChart from 'vue-echarts';
import type { PhysiologicalData } from '../../types/medical';
import dayjs from 'dayjs';

const props = defineProps<{
  data: PhysiologicalData[];
  metric: 'heartRate' | 'hrv' | 'sleepQuality' | 'reactionTime' | 'stressLevel';
  height?: string;
}>();

const metricConfig: Record<string, { name: string; unit: string; color: string; min?: number; max?: number }> = {
  heartRate: { name: '心率', unit: 'bpm', color: '#ef4444', min: 50, max: 120 },
  hrv: { name: '心率变异性', unit: 'ms', color: '#22c55e', min: 20, max: 80 },
  sleepQuality: { name: '睡眠质量', unit: '%', color: '#3b82f6', min: 0, max: 100 },
  reactionTime: { name: '反应时', unit: 'ms', color: '#a855f7', min: 200, max: 500 },
  stressLevel: { name: '压力水平', unit: '%', color: '#f97316', min: 0, max: 100 },
};

const chartData = computed(() => {
  const sorted = [...props.data].sort((a, b) => 
    dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf()
  );
  
  const times = sorted.map(d => dayjs(d.timestamp).format('MM-DD HH:mm'));
  const values = sorted.map(d => d[props.metric]);
  
  const config = metricConfig[props.metric];
  
  return { times, values, config };
});

const option = computed(() => {
  const config = chartData.value.config;
  
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      borderWidth: 1,
      textStyle: { color: '#e2e8f0' },
      formatter: (params: any) => {
        const p = params[0];
        return `
          <div style="font-weight: 600; margin-bottom: 8px;">${p.axisValue}</div>
          <div>${config.name}: <span style="font-weight: 600; color: ${config.color};">${p.value} ${config.unit}</span></div>
        `;
      },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 20, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartData.value.times,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 30 },
    },
    yAxis: {
      type: 'value',
      name: `${config.name} (${config.unit})`,
      min: config.min,
      max: config.max,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: config.name,
        type: 'line',
        data: chartData.value.values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: config.color },
        itemStyle: { color: config.color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${config.color}40` },
            { offset: 1, color: `${config.color}05` },
          ]),
        },
        markLine: {
          silent: true,
          data: [
            { yAxis: config.min, lineStyle: { color: '#22c55e', type: 'dashed' } },
            { yAxis: config.max, lineStyle: { color: '#ef4444', type: 'dashed' } },
          ],
        },
      },
    ],
  };
});
</script>

<template>
  <div :style="{ height: height || '200px' }">
    <VChart :option="option" autoresize />
  </div>
</template>
