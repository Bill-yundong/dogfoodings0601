<script setup lang="ts">
import { computed, watch } from 'vue';
import * as echarts from 'echarts';
import VChart from 'vue-echarts';
import type { BiorhythmDayData } from '../../types/algorithm';

const props = defineProps<{
  data: BiorhythmDayData[];
  height?: string;
}>();

const chartData = computed(() => {
  const dates = props.data.map(d => d.date);
  const physical = props.data.map(d => d.physical);
  const emotional = props.data.map(d => d.emotional);
  const intellectual = props.data.map(d => d.intellectual);
  const criticalMarkPoints = props.data
    .map((d, i) => d.isCritical ? { coord: [dates[i], 0], value: '临界' } : null)
    .filter(Boolean);

  return { dates, physical, emotional, intellectual, criticalMarkPoints };
});

const option = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderColor: '#334155',
    borderWidth: 1,
    textStyle: { color: '#e2e8f0' },
    axisPointer: { type: 'cross' },
  },
  legend: {
    data: ['体力节律', '情绪节律', '智力节律'],
    top: 10,
    textStyle: { color: '#94a3b8' },
  },
  grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: chartData.value.dates,
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#94a3b8', fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    min: -100,
    max: 100,
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#1e293b' } },
  },
  series: [
    {
      name: '体力节律',
      type: 'line',
      data: chartData.value.physical,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 3, color: '#22c55e' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(34, 197, 94, 0.3)' },
          { offset: 1, color: 'rgba(34, 197, 94, 0.05)' },
        ]),
      },
    },
    {
      name: '情绪节律',
      type: 'line',
      data: chartData.value.emotional,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 3, color: '#3b82f6' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
          { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
        ]),
      },
    },
    {
      name: '智力节律',
      type: 'line',
      data: chartData.value.intellectual,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 3, color: '#a855f7' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(168, 85, 247, 0.3)' },
          { offset: 1, color: 'rgba(168, 85, 247, 0.05)' },
        ]),
      },
    },
    {
      type: 'scatter',
      data: chartData.value.criticalMarkPoints,
      symbol: 'pin',
      symbolSize: 30,
      itemStyle: { color: '#ef4444' },
      label: { show: true, color: '#fff', fontSize: 10 },
      z: 10,
    },
  ],
  markLine: {
    silent: true,
    data: [{ yAxis: 0, lineStyle: { color: '#475569', type: 'dashed' } }],
  },
}));

defineExpose({ option });
</script>

<template>
  <div :style="{ height: height || '400px' }">
    <VChart :option="option" autoresize />
  </div>
</template>
