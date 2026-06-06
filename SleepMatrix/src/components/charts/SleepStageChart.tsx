import { Component, createMemo } from 'solid-js';
import { BaseChart } from './BaseChart';
import type { SleepStagePoint } from '@/types/data';
import type { EChartsOption } from 'echarts';
import { SLEEP_STAGE_COLORS, SLEEP_STAGE_LABELS } from '@/types/data';
import { formatTimestamp } from '@/utils/time';

interface SleepStageChartProps {
  data: SleepStagePoint[];
  height?: string;
  showMetrics?: boolean;
  class?: string;
}

export const SleepStageChart: Component<SleepStageChartProps> = (props) => {
  const option = createMemo((): EChartsOption => {
    const data = props.data;
    const times = data.map(d => formatTimestamp(d.timestamp, 'HH:mm:ss'));

    const stageData = data.map(d => d.stage);
    const hrData = data.map(d => d.heartRate);
    const respData = data.map(d => d.respiration);

    const series: any[] = [
      {
        name: '睡眠分期',
        type: 'line',
        data: stageData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 4,
          color: '#8B5CF6',
        },
        itemStyle: {
          color: (params: any) => SLEEP_STAGE_COLORS[params.value as keyof typeof SLEEP_STAGE_COLORS] || '#8B5CF6',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(139, 92, 246, 0.4)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0.05)' },
            ],
          },
        },
        yAxisIndex: 0,
      },
    ];

    if (props.showMetrics ?? true) {
      series.push(
        {
          name: '心率',
          type: 'line',
          data: hrData,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#EC4899' },
          yAxisIndex: 1,
        },
        {
          name: '呼吸',
          type: 'line',
          data: respData,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#06B6D4' },
          yAxisIndex: 1,
        }
      );
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F1F5F9', fontSize: 12 },
        axisPointer: {
          type: 'cross',
          lineStyle: { color: '#7C3AED', type: 'dashed' },
        },
        formatter: (params: any) => {
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((p: any) => {
            if (p.seriesName === '睡眠分期') {
              const stageLabel = SLEEP_STAGE_LABELS[p.value as keyof typeof SLEEP_STAGE_LABELS] || p.value;
              result += `${p.marker} ${p.seriesName}: <strong>${stageLabel}</strong><br/>`;
            } else {
              result += `${p.marker} ${p.seriesName}: <strong>${p.value}</strong><br/>`;
            }
          });
          return result;
        },
      },
      legend: {
        data: (props.showMetrics ?? true)
          ? ['睡眠分期', '心率', '呼吸']
          : ['睡眠分期'],
        textStyle: { color: '#94A3B8', fontSize: 11 },
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '12%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94A3B8', fontSize: 10, rotate: 45 },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: '睡眠分期',
          min: -0.5,
          max: 4.5,
          interval: 1,
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: {
            color: '#94A3B8',
            fontSize: 10,
            formatter: (value: number) => {
              const labels = ['清醒', 'REM', '浅睡', '深睡', '未知'];
              return labels[Math.round(value)] || value.toString();
            },
          },
          splitLine: { lineStyle: { color: '#1E293B', type: 'dashed' } },
        },
        {
          type: 'value',
          name: '生理参数',
          position: 'right',
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94A3B8', fontSize: 10 },
          splitLine: { show: false },
        },
      ],
      series,
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
      ],
    };
  });

  return (
    <BaseChart
      option={option()}
      height={props.height ?? '350px'}
      class={props.class}
    />
  );
};
