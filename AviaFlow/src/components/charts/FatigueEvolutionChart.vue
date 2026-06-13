<script setup lang="ts">
import { computed } from 'vue';
import * as echarts from 'echarts';
import VChart from 'vue-echarts';
import type { FatigueEvolutionPoint } from '../../types/algorithm';
import { getRiskColor } from '../../types/algorithm';
import dayjs from 'dayjs';

const props = defineProps<{
  data: FatigueEvolutionPoint[];
  height?: string;
}>();

const chartData = computed(() => {
  const times = props.data.map(d => dayjs(d.timestamp).format('MM-DD HH:mm'));
  const scores = props.data.map(d => d.fatigueScore);
  const flightHours = props.data.map(d => d.flightHoursAccumulated);
  const timezoneChanges = props.data.map(d => d.timezoneChanges);

  const visualMap = {
    pieces: [
      { gt: 75, color: '#ef4444' },
      { gt: 55, lte: 75, color: '#f97316' },
      { gt: 30, lte: 55, color: '#eab308' },
      { lte: 30, color: '#22c55e' },
    ],
  };

  return { times, scores, flightHours, timezoneChanges, visualMap };
});

const option = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderColor: '#334155',
    borderWidth: 1,
    textStyle: { color: '#e2e8f0' },
    axisPointer: { type: 'cross' },
    formatter: (params: any) => {
      let html = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].axisValue}</div>`;
      params.forEach((p: any) => {
        html += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${p.color};"></span>
          <span>${p.seriesName}:</span>
          <span style="font-weight: 600;">${p.value}</span>
        </div>`;
      });
      return html;
    },
  },
  legend: {
    data: ['疲劳评分', '累计飞行小时', '时区穿越次数'],
    top: 10,
    textStyle: { color: '#94a3b8' },
  },
  grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: chartData.value.times,
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#94a3b8', fontSize: 11, rotate: 45 },
  },
  yAxis: [
    {
      type: 'value',
      name: '疲劳评分',
      min: 0,
      max: 100,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    {
      type: 'value',
      name: '飞行小时',
      position: 'right',
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8' },
      splitLine: { show: false },
    },
  ],
  visualMap: {
    show: false,
    ...chartData.value.visualMap,
  },
  series: [
    {
      name: '疲劳评分',
      type: 'line',
      data: chartData.value.scores,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 3 },
      itemStyle: {
        color: (params: any) => {
          const score = params.data;
          return getRiskColor(
            score >= 75 ? 'critical' : score >= 55 ? 'high' : score >= 30 ? 'medium' : 'low'
          );
        },
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
          { offset: 0.5, color: 'rgba(234, 179, 8, 0.2)' },
          { offset: 1, color: 'rgba(34, 197, 94, 0.05)' },
        ]),
      },
      markLine: {
        silent: true,
        data: [
          { yAxis: 30, lineStyle: { color: '#22c55e', type: 'dashed' }, label: { formatter: '低风险', color: '#22c55e' } },
          { yAxis: 55, lineStyle: { color: '#eab308', type: 'dashed' }, label: { formatter: '中风险', color: '#eab308' } },
          { yAxis: 75, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: '高风险', color: '#ef4444' } },
        ],
      },
    },
    {
      name: '累计飞行小时',
      type: 'bar',
      yAxisIndex: 1,
      data: chartData.value.flightHours,
      barWidth: '40%',
      itemStyle: { color: 'rgba(59, 130, 246, 0.6)', borderRadius: [4, 4, 0, 0] },
    },
    {
      name: '时区穿越次数',
      type: 'line',
      yAxisIndex: 1,
      data: chartData.value.timezoneChanges,
      smooth: true,
      symbol: 'diamond',
      symbolSize: 10,
      lineStyle: { width: 2, color: '#a855f7', type: 'dashed' },
      itemStyle: { color: '#a855f7' },
    },
  ],
}));
</script>

<template>
  <div :style="{ height: height || '400px' }">
    <VChart :option="option" autoresize />
  </div>
</template>
