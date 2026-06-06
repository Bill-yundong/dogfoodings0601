import { Component, createMemo } from 'solid-js';
import { BaseChart } from './BaseChart';
import type { AlignedDataPoint } from '@/types/data';
import { SLEEP_STAGE_COLORS } from '@/types/data';
import { formatTimestamp } from '@/utils/time';
import type { EChartsOption } from 'echarts';

interface TimeSeriesChartProps {
  data: AlignedDataPoint[];
  variables?: string[];
  height?: string;
  class?: string;
}

const VARIABLE_CONFIG: Record<string, { name: string; color: string; unit: string; yAxisIndex?: number }> = {
  lightLux: { name: '光照', color: '#F59E0B', unit: 'lux', yAxisIndex: 0 },
  temperatureC: { name: '温度', color: '#10B981', unit: '°C', yAxisIndex: 0 },
  noiseDb: { name: '噪音', color: '#EF4444', unit: 'dB', yAxisIndex: 0 },
  humidity: { name: '湿度', color: '#3B82F6', unit: '%', yAxisIndex: 0 },
  stage: { name: '睡眠分期', color: '#8B5CF6', unit: '', yAxisIndex: 1 },
  heartRate: { name: '心率', color: '#EC4899', unit: 'BPM', yAxisIndex: 1 },
  respiration: { name: '呼吸', color: '#06B6D4', unit: '次/分', yAxisIndex: 1 },
  alignmentScore: { name: '对齐质量', color: '#6366F1', unit: '%', yAxisIndex: 1 },
};

const STAGE_NAMES = ['清醒', 'REM', '浅睡', '深睡', '未知'];

export const TimeSeriesChart: Component<TimeSeriesChartProps> = (props) => {
  const defaultVariables = ['lightLux', 'temperatureC', 'noiseDb', 'stage'];
  const variables = createMemo(() => props.variables ?? defaultVariables);

  const option = createMemo((): EChartsOption => {
    const data = props.data;
    const times = data.map(d => formatTimestamp(d.timestamp, 'HH:mm:ss'));

    const series = variables().map(varName => {
      const config = VARIABLE_CONFIG[varName] ?? { name: varName, color: '#7C3AED', unit: '' };

      if (varName === 'stage') {
        return {
          name: config.name,
          type: 'line' as const,
          yAxisIndex: 1,
          data: data.map(d => d.sleep.stage),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            width: 3,
            color: config.color,
          },
          itemStyle: {
            color: (params: any) => SLEEP_STAGE_COLORS[params.value as keyof typeof SLEEP_STAGE_COLORS] || config.color,
          },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `${config.color}40` },
                { offset: 1, color: `${config.color}05` },
              ],
            },
          },
        };
      }

      if (varName === 'heartRate') {
        return {
          name: config.name,
          type: 'line' as const,
          yAxisIndex: 1,
          data: data.map(d => d.sleep.heartRate),
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: config.color,
          },
        };
      }

      if (varName === 'respiration') {
        return {
          name: config.name,
          type: 'line' as const,
          yAxisIndex: 1,
          data: data.map(d => d.sleep.respiration),
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: config.color,
          },
        };
      }

      if (varName === 'alignmentScore') {
        return {
          name: config.name,
          type: 'line' as const,
          yAxisIndex: 1,
          data: data.map(d => d.alignmentScore * 100),
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: config.color,
            type: 'dashed' as const,
          },
        };
      }

      const envData = data.map(d => {
        const key = varName as keyof typeof d.env;
        return d.env[key] as number;
      });

      return {
        name: config.name,
        type: 'line' as const,
        yAxisIndex: 0,
        data: envData,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 2,
          color: config.color,
        },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${config.color}30` },
              { offset: 1, color: `${config.color}02` },
            ],
          },
        },
      };
    });

    const hasEnvVar = variables().some(v => ['lightLux', 'temperatureC', 'noiseDb', 'humidity'].includes(v));
    const hasSleepVar = variables().some(v => ['stage', 'heartRate', 'respiration', 'alignmentScore'].includes(v));

    const yAxis = [];
    if (hasEnvVar) {
      yAxis.push({
        type: 'value' as const,
        name: '环境参数',
        position: 'left' as const,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94A3B8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1E293B', type: 'dashed' as const } },
      });
    }
    if (hasSleepVar) {
      const isStageOnly = variables().includes('stage') && !variables().some(v => ['heartRate', 'respiration', 'alignmentScore'].includes(v));
      yAxis.push({
        type: 'value' as const,
        name: isStageOnly ? '睡眠分期' : '生理参数',
        position: 'right' as const,
        min: isStageOnly ? -0.5 : undefined,
        max: isStageOnly ? 4.5 : undefined,
        interval: isStageOnly ? 1 : undefined,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: {
          color: '#94A3B8',
          fontSize: 10,
          formatter: isStageOnly
            ? (value: number) => STAGE_NAMES[Math.round(value)] || value.toString()
            : undefined,
        },
        splitLine: { show: false },
      });
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
      },
      legend: {
        data: variables().map(v => VARIABLE_CONFIG[v]?.name ?? v),
        textStyle: { color: '#94A3B8', fontSize: 11 },
        top: 0,
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
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
      yAxis,
      series,
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 0,
          borderColor: 'transparent',
          backgroundColor: '#1E293B',
          fillerColor: 'rgba(124, 58, 237, 0.2)',
          textStyle: { color: '#94A3B8' },
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
