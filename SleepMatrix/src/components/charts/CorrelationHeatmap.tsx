import { Component, createMemo } from 'solid-js';
import { BaseChart } from './BaseChart';
import type { CorrelationMatrix } from '@/types/analysis';
import type { EChartsOption } from 'echarts';
import { cn } from '@/lib/utils';

interface CorrelationHeatmapProps {
  data: CorrelationMatrix | null;
  height?: string;
  class?: string;
}

const VARIABLE_LABELS: Record<string, string> = {
  lightLux: '光照',
  temperatureC: '温度',
  noiseDb: '噪音',
  humidity: '湿度',
  sleepStage: '睡眠分期',
  confidence: '置信度',
  heartRate: '心率',
  respiration: '呼吸',
  deepSleepRatio: '深睡占比',
  sleepScore: '睡眠评分',
  remSleepRatio: 'REM比例',
  sleepEfficiency: '睡眠效率',
};

export const CorrelationHeatmap: Component<CorrelationHeatmapProps> = (props) => {
  const option = createMemo((): EChartsOption => {
    const matrix = props.data;
    if (!matrix) {
      return {
        backgroundColor: 'transparent',
        title: {
          text: '加载中...',
          left: 'center',
          textStyle: { color: '#94A3B8' },
        },
      };
    }

    const variables = matrix.variables;
    const labels = variables.map(v => VARIABLE_LABELS[v] ?? v);
    const data: [number, number, number][] = [];

    const n = matrix.matrix.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const corr = matrix.matrix[i][j];
        data.push([i, j, Number((corr.pearson * 100).toFixed(0))]);
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F1F5F9', fontSize: 12 },
        formatter: (params: any) => {
          const x = labels[params.data[0]];
          const y = labels[params.data[1]];
          const value = params.data[2];
          return `${x} × ${y}<br/>相关系数: <strong>${value}%</strong>`;
        },
      },
      grid: {
        left: '15%',
        right: '10%',
        top: '10%',
        bottom: '15%',
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          color: '#94A3B8',
          fontSize: 11,
          rotate: 45,
        },
        axisLine: { lineStyle: { color: '#475569' } },
        splitArea: { show: true, areaStyle: { color: ['rgba(30, 41, 59, 0.3)', 'transparent'] } },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#94A3B8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#475569' } },
        splitArea: { show: true, areaStyle: { color: ['rgba(30, 41, 59, 0.3)', 'transparent'] } },
      },
      visualMap: {
        min: -100,
        max: 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        textStyle: { color: '#94A3B8' },
        inRange: {
          color: [
            '#EF4444',
            '#F59E0B',
            '#10B981',
            '#3B82F6',
            '#8B5CF6',
          ].reverse(),
        },
        formatter: (value: any) => `${value}%`,
      },
      series: [
        {
          name: '相关系数',
          type: 'heatmap',
          data,
          label: {
            show: true,
            color: '#F1F5F9',
            fontSize: 11,
            formatter: (params: any) => `${params.data[2]}%`,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(124, 58, 237, 0.5)',
            },
          },
        },
      ],
    };
  });

  return (
    <BaseChart
      option={option()}
      height={props.height ?? '400px'}
      class={props.class}
    />
  );
};
