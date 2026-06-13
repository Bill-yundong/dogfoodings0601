<script setup lang="ts">
import { computed } from 'vue';
import * as echarts from 'echarts';
import VChart from 'vue-echarts';
import type { FatigueHeatmapData } from '../../database/queryEngine';

const props = defineProps<{
  data: FatigueHeatmapData[];
  height?: string;
}>();

const chartData = computed(() => {
  const crewNames = [...new Set(props.data.map(d => d.crewName))];
  const dates = [...new Set(props.data.map(d => d.date))].sort();
  
  const heatmapData = props.data.map(d => [
    dates.indexOf(d.date),
    crewNames.indexOf(d.crewName),
    d.fatigueScore,
  ]);

  return { crewNames, dates, heatmapData };
});

const option = computed(() => ({
  tooltip: {
    position: 'top',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderColor: '#334155',
    borderWidth: 1,
    textStyle: { color: '#e2e8f0' },
    formatter: (params: any) => {
      const data = props.data.find(
        d => d.date === chartData.value.dates[params.data[0]] && 
             d.crewName === chartData.value.crewNames[params.data[1]]
      );
      if (!data) return '';
      return `
        <div style="font-weight: 600; margin-bottom: 8px;">${data.crewName}</div>
        <div style="margin: 4px 0;">日期: ${data.date}</div>
        <div style="margin: 4px 0;">疲劳评分: <span style="font-weight: 600; color: ${
          data.fatigueScore >= 75 ? '#ef4444' : data.fatigueScore >= 55 ? '#f97316' : 
          data.fatigueScore >= 30 ? '#eab308' : '#22c55e'
        }">${data.fatigueScore}</span></div>
        <div style="margin: 4px 0;">飞行小时: ${data.flightHours}h</div>
        <div style="margin: 4px 0;">时差变化: ${data.timezoneDiff}h</div>
      `;
    },
  },
  grid: { left: '15%', right: '10%', bottom: '15%', top: 60 },
  xAxis: {
    type: 'category',
    data: chartData.value.dates,
    splitArea: { show: true },
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 45 },
  },
  yAxis: {
    type: 'category',
    data: chartData.value.crewNames,
    splitArea: { show: true },
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#94a3b8', fontSize: 11 },
  },
  visualMap: {
    min: 0,
    max: 100,
    calculable: true,
    orient: 'horizontal',
    left: 'center',
    bottom: '0%',
    textStyle: { color: '#94a3b8' },
    inRange: {
      color: ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'],
    },
  },
  series: [
    {
      name: '疲劳度热力图',
      type: 'heatmap',
      data: chartData.value.heatmapData,
      label: {
        show: true,
        color: '#fff',
        fontSize: 10,
        formatter: (params: any) => params.data[2],
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    },
  ],
}));
</script>

<template>
  <div :style="{ height: height || '500px' }">
    <VChart :option="option" autoresize />
  </div>
</template>
