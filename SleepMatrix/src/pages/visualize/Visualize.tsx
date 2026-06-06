import { Component, createMemo, createSignal, For, onMount } from 'solid-js';
import { Motion } from '@motionone/solid';
import {
  BarChart3,
  LineChart,
  Activity,
  Thermometer,
  Droplets,
  Volume2,
  Sun,
  Heart,
  Wind,
  Brain,
  Clock,
  Filter,
  ChevronDown,
  Check,
  X,
  RefreshCw,
  Download,
  PieChart,
  Radar,
  TrendingUp,
  Sparkles,
  Target,
} from 'lucide-solid';
import type { EChartsOption } from 'echarts';
import { v4 as uuidv4 } from 'uuid';
import { MainLayout } from '@/components/layout';
import { TimeSeriesChart, SleepStageChart, CorrelationHeatmap, BaseChart } from '@/components/charts';
import { StatCard } from '@/components/cards';
import { Button, Toggle } from '@/components/controls';
import { realtimeStore, realtimeActions, setRealtimeState } from '@/stores/realtime';
import { analysisStore, analysisActions } from '@/stores/analysis';
import { configStore } from '@/stores/config';
import {
  generateEnvData,
  generateSleepData,
} from '@/mock';
import { TimestampAlignmentEngine } from '@/engine/alignment';
import type { AlignedDataPoint, SleepStage, EnvDataPoint, SleepStagePoint } from '@/types/data';
import { SLEEP_STAGE_LABELS, SLEEP_STAGE_COLORS } from '@/types/data';
import { formatTimestamp } from '@/utils/time';
import { cn } from '@/lib/utils';

type ChartType = 'timeseries' | 'sleepstage' | 'heatmap' | 'bar' | 'area';
type ViewPreset = 'environment' | 'physiology' | 'correlation' | 'comprehensive';
type TimeRange = '1h' | '4h' | '8h' | '24h' | 'all';

interface VariableOption {
  key: string;
  label: string;
  category: 'environment' | 'sleep' | 'physiology';
  color: string;
  unit: string;
}

const VARIABLE_OPTIONS: VariableOption[] = [
  { key: 'lightLux', label: '光照', category: 'environment', color: '#F59E0B', unit: 'lux' },
  { key: 'temperatureC', label: '温度', category: 'environment', color: '#10B981', unit: '°C' },
  { key: 'noiseDb', label: '噪音', category: 'environment', color: '#EF4444', unit: 'dB' },
  { key: 'humidity', label: '湿度', category: 'environment', color: '#3B82F6', unit: '%' },
  { key: 'stage', label: '睡眠分期', category: 'sleep', color: '#8B5CF6', unit: '' },
  { key: 'heartRate', label: '心率', category: 'physiology', color: '#EC4899', unit: 'BPM' },
  { key: 'respiration', label: '呼吸', category: 'physiology', color: '#06B6D4', unit: '次/分' },
  { key: 'alignmentScore', label: '对齐质量', category: 'physiology', color: '#6366F1', unit: '%' },
];

const CHART_TYPES: Array<{ value: ChartType; label: string; icon: Component<{ class?: string }> }> = [
  { value: 'timeseries', label: '时序图', icon: LineChart },
  { value: 'sleepstage', label: '睡眠分期', icon: Activity },
  { value: 'heatmap', label: '热力图', icon: BarChart3 },
  { value: 'bar', label: '柱状图', icon: BarChart3 },
  { value: 'area', label: '面积图', icon: AreaChart },
];

function AreaChart(props: { class?: string }) {
  return <LineChart {...props} />;
}

const VIEW_PRESETS: Array<{ value: ViewPreset; label: string; description: string; variables: string[] }> = [
  { value: 'environment', label: '环境概览', description: '温度、湿度、光照、噪音等环境参数', variables: ['lightLux', 'temperatureC', 'noiseDb', 'humidity'] },
  { value: 'physiology', label: '生理监测', description: '心率、呼吸、睡眠分期等生理指标', variables: ['stage', 'heartRate', 'respiration'] },
  { value: 'correlation', label: '相关性分析', description: '环境与生理参数的相关性矩阵', variables: ['lightLux', 'temperatureC', 'noiseDb', 'humidity', 'stage', 'heartRate'] },
  { value: 'comprehensive', label: '综合对比', description: '多维度数据综合对比分析', variables: ['lightLux', 'temperatureC', 'noiseDb', 'stage', 'heartRate'] },
];

const TIME_RANGES: Array<{ value: TimeRange; label: string }> = [
  { value: '1h', label: '最近1小时' },
  { value: '4h', label: '最近4小时' },
  { value: '8h', label: '最近8小时' },
  { value: '24h', label: '最近24小时' },
  { value: 'all', label: '全部数据' },
];

const Visualize: Component = () => {
  const [chartType, setChartType] = createSignal<ChartType>('timeseries');
  const [selectedVariables, setSelectedVariables] = createSignal<string[]>(['lightLux', 'temperatureC', 'noiseDb', 'stage']);
  const [activePreset, setActivePreset] = createSignal<ViewPreset>('comprehensive');
  const [timeRange, setTimeRange] = createSignal<TimeRange>('8h');
  const [variableDropdownOpen, setVariableDropdownOpen] = createSignal(false);
  const [showSmoothed, setShowSmoothed] = createSignal(true);
  const [showDataPoints, setShowDataPoints] = createSignal(false);
  const [isDataLoaded, setIsDataLoaded] = createSignal(false);

  const ensureData = async () => {
    if (realtimeStore.alignedData.length > 100) {
      setIsDataLoaded(true);
      return;
    }

    const sessionId = uuidv4();
    const userId = 'user-001';
    const deviceId = 'device-001';
    const startTime = Date.now() - 8 * 60 * 60 * 1000;
    const durationMs = 8 * 60 * 60 * 1000;

    const envData = generateEnvData({
      sessionId,
      startTime,
      durationMs,
      sampleIntervalMs: 30000,
    });

    const sleepData = generateSleepData({
      sessionId,
      startTime,
      durationMs,
      sampleIntervalMs: 30000,
      sleepQuality: 'good',
    });

    const alignmentEngine = new TimestampAlignmentEngine();
    const alignmentResult = alignmentEngine.alignData(envData, sleepData);

    realtimeActions.startSession(sessionId, {
      id: sessionId,
      userId,
      deviceId,
      startTime,
      endTime: startTime + durationMs,
      sleepScore: 78,
      scenario: '居家',
      createdAt: Date.now(),
      deepSleepDuration: Math.round(durationMs * 0.2),
      remSleepDuration: Math.round(durationMs * 0.22),
      lightSleepDuration: Math.round(durationMs * 0.48),
      awakeDuration: Math.round(durationMs * 0.1),
    });

    setRealtimeState('envData', envData);
    setRealtimeState('sleepData', sleepData);
    realtimeActions.setAlignedData(alignmentResult.alignedData);

    await analysisActions.runAnalysis(alignmentResult.alignedData, sessionId);
    setIsDataLoaded(true);
  };

  onMount(() => {
    ensureData();
  });

  const filteredData = createMemo(() => {
    const data = realtimeStore.alignedData;
    if (data.length === 0) return [];

    const now = Date.now();
    const rangeMs: Record<TimeRange, number> = {
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      'all': Infinity,
    };

    const cutoff = now - rangeMs[timeRange()];
    return data.filter((d: AlignedDataPoint) => d.timestamp >= cutoff);
  });

  const sleepStageDistribution = createMemo(() => {
    const data = filteredData();
    const counts: Record<SleepStage, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    data.forEach((d: AlignedDataPoint) => {
      const stage = d.sleep.stage as unknown as SleepStage;
      counts[stage]++;
    });
    const total = data.length || 1;
    return Object.entries(counts).map(([stage, count]) => ({
      name: SLEEP_STAGE_LABELS[stage as unknown as SleepStage],
      value: Math.round((count / total) * 100),
      count,
    }));
  });

  const environmentRadarData = createMemo(() => {
    const data = filteredData();
    if (data.length === 0) return [];

    const envData = data.map((d: AlignedDataPoint) => d.env);
    const avgLight = envData.reduce((s: number, d: EnvDataPoint) => s + d.lightLux, 0) / data.length;
    const avgTemp = envData.reduce((s: number, d: EnvDataPoint) => s + d.temperatureC, 0) / data.length;
    const avgNoise = envData.reduce((s: number, d: EnvDataPoint) => s + d.noiseDb, 0) / data.length;
    const avgHumidity = envData.reduce((s: number, d: EnvDataPoint) => s + (d.humidity ?? 50), 0) / data.length;

    const normalize = (value: number, min: number, max: number, invert = false) => {
      const normalized = ((value - min) / (max - min)) * 100;
      return invert ? 100 - Math.max(0, Math.min(100, normalized)) : Math.max(0, Math.min(100, normalized));
    };

    return [
      { name: '光照适宜度', value: normalize(avgLight, 0, 100, true) },
      { name: '温度适宜度', value: 100 - Math.abs(avgTemp - 22) * 10 },
      { name: '安静度', value: normalize(avgNoise, 20, 80, true) },
      { name: '湿度适宜度', value: 100 - Math.abs(avgHumidity - 50) * 2 },
    ];
  });

  const hrvAnalysisData = createMemo(() => {
    const data = filteredData();
    if (data.length === 0) return { times: [], rmssd: [], sdnn: [] };

    const times: string[] = [];
    const rmssd: number[] = [];
    const sdnn: number[] = [];

    const windowSize = 5;
    for (let i = windowSize; i < data.length; i += windowSize) {
      const window = data.slice(i - windowSize, i);
      const hrs = window.map((d: AlignedDataPoint) => d.sleep.heartRate ?? 65);
      const meanHr = hrs.reduce((a: number, b: number) => a + b, 0) / hrs.length;
      const diffs = hrs.slice(1).map((hr: number, j: number) => hr - hrs[j]);
      const squaredDiffs = diffs.map((d: number) => d * d);
      const rmssdVal = Math.sqrt(squaredDiffs.reduce((a: number, b: number) => a + b, 0) / diffs.length);
      const sdnnVal = Math.sqrt(hrs.reduce((a: number, b: number) => a + Math.pow(b - meanHr, 2), 0) / hrs.length);

      times.push(formatTimestamp(data[i].timestamp, 'HH:mm'));
      rmssd.push(Math.round(rmssdVal * 10) / 10);
      sdnn.push(Math.round(sdnnVal * 10) / 10);
    }

    return { times, rmssd, sdnn };
  });

  const dataQualityTrend = createMemo(() => {
    const data = filteredData();
    if (data.length === 0) return { times: [], quality: [] };

    const times: string[] = [];
    const quality: number[] = [];
    const windowSize = 10;

    for (let i = windowSize; i < data.length; i += windowSize) {
      const window = data.slice(i - windowSize, i);
      const avgQuality = window.reduce((s: number, d: AlignedDataPoint) => s + d.alignmentScore, 0) / window.length;
      times.push(formatTimestamp(data[i].timestamp, 'HH:mm'));
      quality.push(Math.round(avgQuality * 100));
    }

    return { times, quality };
  });

  const sleepStagePieOption = createMemo((): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      borderWidth: 1,
      textStyle: { color: '#F1F5F9', fontSize: 12 },
      formatter: '{b}: {c}% ({d}个数据点)',
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#94A3B8', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 12,
    },
    series: [{
      name: '睡眠分期分布',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#0F172A',
        borderWidth: 2,
      },
      label: {
        show: false,
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold',
          color: '#fff',
        },
        itemStyle: {
          shadowBlur: 20,
          shadowOffsetX: 0,
          shadowColor: 'rgba(124, 58, 237, 0.5)',
        },
      },
      data: sleepStageDistribution().map(item => ({
        value: item.value,
        name: item.name,
        itemStyle: {
          color: SLEEP_STAGE_COLORS[Number(Object.keys(SLEEP_STAGE_LABELS).find(k => SLEEP_STAGE_LABELS[k as unknown as SleepStage] === item.name)) as unknown as SleepStage] || '#6366F1',
        },
      })),
    }],
  }));

  const environmentRadarOption = createMemo((): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      borderWidth: 1,
      textStyle: { color: '#F1F5F9', fontSize: 12 },
    },
    radar: {
      indicator: environmentRadarData().map(d => ({
        name: d.name,
        max: 100,
      })),
      center: ['50%', '55%'],
      radius: '65%',
      splitNumber: 5,
      axisName: {
        color: '#94A3B8',
        fontSize: 11,
      },
      splitLine: {
        lineStyle: {
          color: '#1E293B',
        },
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(30, 41, 59, 0.3)', 'rgba(30, 41, 59, 0.1)'],
        },
      },
      axisLine: {
        lineStyle: {
          color: '#334155',
        },
      },
    },
    series: [{
      name: '环境质量评分',
      type: 'radar',
      data: [{
        value: environmentRadarData().map(d => Math.max(0, Math.min(100, d.value))),
        name: '当前环境',
        areaStyle: {
          color: 'rgba(124, 58, 237, 0.3)',
        },
        lineStyle: {
          color: '#8B5CF6',
          width: 2,
        },
        itemStyle: {
          color: '#8B5CF6',
        },
      }],
    }],
  }));

  const hrvChartOption = createMemo((): EChartsOption => ({
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
      data: ['RMSSD', 'SDNN'],
      textStyle: { color: '#94A3B8', fontSize: 11 },
      top: 0,
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
      boundaryGap: false,
      data: hrvAnalysisData().times,
      axisLine: { lineStyle: { color: '#475569' } },
      axisLabel: { color: '#94A3B8', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'HRV (ms)',
      axisLine: { lineStyle: { color: '#475569' } },
      axisLabel: { color: '#94A3B8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1E293B', type: 'dashed' } },
    },
    series: [
      {
        name: 'RMSSD',
        type: 'line',
        data: hrvAnalysisData().rmssd,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#EC4899', width: 2 },
        itemStyle: { color: '#EC4899' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(236, 72, 153, 0.3)' },
              { offset: 1, color: 'rgba(236, 72, 153, 0.02)' },
            ],
          },
        },
      },
      {
        name: 'SDNN',
        type: 'line',
        data: hrvAnalysisData().sdnn,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#06B6D4', width: 2 },
        itemStyle: { color: '#06B6D4' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(6, 182, 212, 0.3)' },
              { offset: 1, color: 'rgba(6, 182, 212, 0.02)' },
            ],
          },
        },
      },
    ],
  }));

  const dataQualityOption = createMemo((): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      borderWidth: 1,
      textStyle: { color: '#F1F5F9', fontSize: 12 },
      formatter: '{b}<br/>数据质量: {c}%',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dataQualityTrend().times,
      axisLine: { lineStyle: { color: '#475569' } },
      axisLabel: { color: '#94A3B8', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '质量评分',
      min: 0,
      max: 100,
      axisLine: { lineStyle: { color: '#475569' } },
      axisLabel: { color: '#94A3B8', fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#1E293B', type: 'dashed' } },
    },
    series: [{
      name: '数据质量',
      type: 'line',
      data: dataQualityTrend().quality,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#10B981', width: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0.02)' },
          ],
        },
      },
      markLine: {
        silent: true,
        lineStyle: { color: '#F59E0B', type: 'dashed' },
        data: [{ yAxis: 80, label: { formatter: '阈值 80%', color: '#F59E0B', fontSize: 10 } }],
      },
    }],
  }));

  const barChartOption = createMemo((): EChartsOption => {
    const data = filteredData();
    if (data.length === 0) return { backgroundColor: 'transparent' } as EChartsOption;

    const hours: Record<string, Record<string, number>> = {};
    data.forEach((d: AlignedDataPoint) => {
      const hour = formatTimestamp(d.timestamp, 'HH:00');
      if (!hours[hour]) {
        hours[hour] = { lightLux: 0, temperatureC: 0, noiseDb: 0, humidity: 0, count: 0 };
      }
      hours[hour].lightLux += d.env.lightLux;
      hours[hour].temperatureC += d.env.temperatureC;
      hours[hour].noiseDb += d.env.noiseDb;
      hours[hour].humidity += d.env.humidity ?? 0;
      hours[hour].count++;
    });

    const hourKeys = Object.keys(hours).sort();
    const selectedVars = selectedVariables().filter(v => ['lightLux', 'temperatureC', 'noiseDb', 'humidity'].includes(v));

    const series = selectedVars.map(varName => {
      const config = VARIABLE_OPTIONS.find(v => v.key === varName)!;
      return {
        name: config.label,
        type: 'bar' as const,
        data: hourKeys.map(h => Math.round((hours[h][varName as keyof typeof hours[string]] / hours[h].count) * 10) / 10),
        itemStyle: {
          color: config.color,
          borderRadius: [4, 4, 0, 0],
        },
        barGap: '20%',
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F1F5F9', fontSize: 12 },
        axisPointer: { type: 'shadow' },
      },
      legend: {
        data: selectedVars.map(v => VARIABLE_OPTIONS.find(o => o.key === v)?.label).filter(Boolean) as string[],
        textStyle: { color: '#94A3B8', fontSize: 11 },
        top: 0,
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
        data: hourKeys,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94A3B8', fontSize: 10 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94A3B8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1E293B', type: 'dashed' } },
      },
      series,
    };
  });

  const areaChartOption = createMemo((): EChartsOption => {
    const data = filteredData();
    if (data.length === 0) return { backgroundColor: 'transparent' } as EChartsOption;

    const times = data.map((d: AlignedDataPoint) => formatTimestamp(d.timestamp, 'HH:mm'));
    const selectedVars = selectedVariables().filter(v => ['lightLux', 'temperatureC', 'noiseDb', 'humidity', 'heartRate', 'respiration'].includes(v));

    const series = selectedVars.map(varName => {
      const config = VARIABLE_OPTIONS.find(v => v.key === varName)!;
      let seriesData: number[];

      if (['lightLux', 'temperatureC', 'noiseDb', 'humidity'].includes(varName)) {
        seriesData = data.map((d: AlignedDataPoint) => d.env[varName as keyof EnvDataPoint] as number);
      } else if (varName === 'heartRate') {
        seriesData = data.map((d: AlignedDataPoint) => d.sleep.heartRate ?? 65);
      } else if (varName === 'respiration') {
        seriesData = data.map((d: AlignedDataPoint) => d.sleep.respiration ?? 16);
      } else {
        seriesData = [];
      }

      return {
        name: config.label,
        type: 'line' as const,
        data: seriesData,
        smooth: true,
        symbol: showDataPoints() ? 'circle' : 'none',
        symbolSize: 4,
        lineStyle: { color: config.color, width: 2 },
        itemStyle: { color: config.color },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${config.color}40` },
              { offset: 1, color: `${config.color}02` },
            ],
          },
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F1F5F9', fontSize: 12 },
        axisPointer: { type: 'cross', lineStyle: { color: '#7C3AED', type: 'dashed' } },
      },
      legend: {
        data: selectedVars.map(v => VARIABLE_OPTIONS.find(o => o.key === v)?.label).filter(Boolean) as string[],
        textStyle: { color: '#94A3B8', fontSize: 11 },
        top: 0,
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
        boundaryGap: false,
        data: times,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94A3B8', fontSize: 10, rotate: 45 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94A3B8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1E293B', type: 'dashed' } },
      },
      series,
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, height: 20, bottom: 0, borderColor: 'transparent', backgroundColor: '#1E293B', fillerColor: 'rgba(124, 58, 237, 0.2)', textStyle: { color: '#94A3B8' } },
      ],
    };
  });

  const avgStats = createMemo(() => {
    const data = filteredData();
    if (data.length === 0) {
      return {
        avgTemp: 0,
        avgNoise: 0,
        avgLight: 0,
        avgHumidity: 0,
        avgHr: 0,
        avgResp: 0,
        avgQuality: 0,
      };
    }

    const sum = data.reduce((acc: { temp: number; noise: number; light: number; humidity: number; hr: number; resp: number; quality: number }, d: AlignedDataPoint) => ({
      temp: acc.temp + d.env.temperatureC,
      noise: acc.noise + d.env.noiseDb,
      light: acc.light + d.env.lightLux,
      humidity: acc.humidity + (d.env.humidity ?? 0),
      hr: acc.hr + (d.sleep.heartRate ?? 0),
      resp: acc.resp + (d.sleep.respiration ?? 0),
      quality: acc.quality + d.alignmentScore,
    }), { temp: 0, noise: 0, light: 0, humidity: 0, hr: 0, resp: 0, quality: 0 });

    return {
      avgTemp: Math.round((sum.temp / data.length) * 10) / 10,
      avgNoise: Math.round(sum.noise / data.length),
      avgLight: Math.round(sum.light / data.length),
      avgHumidity: Math.round(sum.humidity / data.length),
      avgHr: Math.round(sum.hr / data.length),
      avgResp: Math.round(sum.resp / data.length),
      avgQuality: Math.round((sum.quality / data.length) * 100),
    };
  });

  const handlePresetChange = (preset: ViewPreset) => {
    setActivePreset(preset);
    const presetConfig = VIEW_PRESETS.find(p => p.value === preset);
    if (presetConfig) {
      setSelectedVariables(presetConfig.variables);
    }
  };

  const handleVariableToggle = (variableKey: string) => {
    const current = selectedVariables();
    const isSelected = current.includes(variableKey);

    if (isSelected) {
      if (current.length > 1) {
        setSelectedVariables(current.filter(v => v !== variableKey));
      }
    } else {
      setSelectedVariables([...current, variableKey]);
    }
  };

  const handleRefresh = async () => {
    await ensureData();
    if (filteredData().length > 0) {
      const sessionId = realtimeStore.currentSession?.id || 'session-' + Date.now();
      await analysisActions.runAnalysis(filteredData(), sessionId);
    }
  };

  const handleExport = () => {
    const exportData = {
      dataPoints: filteredData().length,
      timeRange: timeRange(),
      variables: selectedVariables(),
      data: filteredData(),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sleepmatrix-visualize-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupedVariables = createMemo(() => {
    const groups: Record<string, VariableOption[]> = {
      '环境参数': [],
      '睡眠指标': [],
      '生理指标': [],
    };

    VARIABLE_OPTIONS.forEach(v => {
      if (v.category === 'environment') groups['环境参数'].push(v);
      else if (v.category === 'sleep') groups['睡眠指标'].push(v);
      else groups['生理指标'].push(v);
    });

    return groups;
  });

  const renderMainChart = () => {
    switch (chartType()) {
      case 'timeseries':
        return (
          <TimeSeriesChart
            data={filteredData()}
            variables={selectedVariables()}
            height="450px"
          />
        );
      case 'sleepstage':
        return (
          <SleepStageChart
            data={filteredData().map((d: AlignedDataPoint) => d.sleep)}
            height="450px"
            showMetrics={selectedVariables().includes('heartRate') || selectedVariables().includes('respiration')}
          />
        );
      case 'heatmap':
        return (
          <CorrelationHeatmap
            data={analysisStore.correlationMatrix}
            height="450px"
          />
        );
      case 'bar':
        return <BaseChart option={barChartOption()} height="450px" />;
      case 'area':
        return <BaseChart option={areaChartOption()} height="450px" />;
      default:
        return (
          <TimeSeriesChart
            data={filteredData()}
            variables={selectedVariables()}
            height="450px"
          />
        );
    }
  };

  return (
    <MainLayout>
      <div class="space-y-6">
        <Motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"
        >
          <div>
            <h1 class="text-2xl font-bold text-white font-display">数据可视化</h1>
            <p class="text-midnight-400 mt-1">多维度睡眠环境与生理数据综合分析看板</p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <div class="relative">
              <Button
                variant="secondary"
                icon={Filter}
                onClick={() => setVariableDropdownOpen(!variableDropdownOpen())}
                class="min-w-[180px] justify-between"
              >
                <span>变量选择 ({selectedVariables().length})</span>
                <ChevronDown class={cn('w-4 h-4 transition-transform', variableDropdownOpen() && 'rotate-180')} />
              </Button>

              {variableDropdownOpen() && (
                <Motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  class="absolute top-full right-0 mt-2 w-80 bg-midnight-900/95 backdrop-blur-xl border border-midnight-700/50 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div class="p-3 border-b border-midnight-700/50">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium text-white">选择展示变量</span>
                      <button
                        onClick={() => setVariableDropdownOpen(false)}
                        class="p-1 hover:bg-midnight-700/50 rounded-lg transition-colors"
                      >
                        <X class="w-4 h-4 text-midnight-400" />
                      </button>
                    </div>
                  </div>
                  <div class="max-h-80 overflow-y-auto p-3 space-y-4">
                    <For each={Object.entries(groupedVariables())}>
                      {([groupName, variables]) => (
                        <div>
                          <p class="text-xs font-medium text-midnight-400 mb-2 px-2">{groupName}</p>
                          <div class="space-y-1">
                            <For each={variables}>
                              {(variable) => {
                                const isSelected = selectedVariables().includes(variable.key);
                                return (
                                  <button
                                    onClick={() => handleVariableToggle(variable.key)}
                                    class={cn(
                                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left',
                                      isSelected
                                        ? 'bg-moon-500/20 text-moon-300 border border-moon-500/30'
                                        : 'hover:bg-midnight-700/50 text-midnight-300 border border-transparent'
                                    )}
                                  >
                                    <div class={cn(
                                      'w-4 h-4 rounded flex items-center justify-center transition-colors',
                                      isSelected ? 'bg-moon-500' : 'bg-midnight-700'
                                    )}>
                                      {isSelected && <Check class="w-3 h-3 text-white" />}
                                    </div>
                                    <div class="w-3 h-3 rounded-full" style={{ 'background-color': variable.color }} />
                                    <span class="text-sm flex-1">{variable.label}</span>
                                    <span class="text-xs text-midnight-500">{variable.unit}</span>
                                  </button>
                                );
                              }}
                            </For>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Motion.div>
              )}
            </div>

            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={handleRefresh}
              loading={analysisStore.isAnalyzing}
            >
              刷新数据
            </Button>
            <Button
              variant="ghost"
              icon={Download}
              onClick={handleExport}
            >
              导出
            </Button>
          </div>
        </Motion.div>

        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6"
        >
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm text-midnight-400">图表类型:</span>
              <div class="flex items-center bg-midnight-800/50 rounded-xl p-1">
                <For each={CHART_TYPES}>
                  {(ct) => {
                    const isActive = chartType() === ct.value;
                    return (
                      <button
                        onClick={() => setChartType(ct.value)}
                        class={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                          isActive
                            ? 'bg-moon-500 text-white shadow-lg shadow-moon-500/25'
                            : 'text-midnight-400 hover:text-white hover:bg-midnight-700/50'
                        )}
                      >
                        <ct.icon class="w-4 h-4" />
                        <span>{ct.label}</span>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            <div class="flex items-center gap-3 flex-wrap">
              <div class="flex items-center gap-2">
                <Clock class="w-4 h-4 text-midnight-400" />
                <select
                  value={timeRange()}
                  onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                  class="bg-midnight-800/50 border border-midnight-700/50 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-moon-500/50"
                >
                  <For each={TIME_RANGES}>
                    {(tr) => <option value={tr.value}>{tr.label}</option>}
                  </For>
                </select>
              </div>
              <div class="flex items-center gap-4">
                <Toggle
                  checked={showSmoothed()}
                  onChange={setShowSmoothed}
                  label="平滑曲线"
                />
                <Toggle
                  checked={showDataPoints()}
                  onChange={setShowDataPoints}
                  label="显示数据点"
                />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <For each={VIEW_PRESETS}>
              {(preset) => {
                const isActive = activePreset() === preset.value;
                return (
                  <button
                    onClick={() => handlePresetChange(preset.value)}
                    class={cn(
                      'p-4 rounded-xl text-left transition-all border',
                      isActive
                        ? 'bg-moon-500/20 border-moon-500/40'
                        : 'bg-midnight-800/30 border-midnight-700/30 hover:bg-midnight-700/40 hover:border-midnight-600/40'
                    )}
                  >
                    <div class="flex items-center gap-2 mb-1">
                      {preset.value === 'environment' && <Thermometer class={cn('w-4 h-4', isActive ? 'text-moon-400' : 'text-mint-400')} />}
                      {preset.value === 'physiology' && <Heart class={cn('w-4 h-4', isActive ? 'text-moon-400' : 'text-rose-400')} />}
                      {preset.value === 'correlation' && <Brain class={cn('w-4 h-4', isActive ? 'text-moon-400' : 'text-blue-400')} />}
                      {preset.value === 'comprehensive' && <Sparkles class={cn('w-4 h-4', isActive ? 'text-moon-400' : 'text-amber-400')} />}
                      <span class={cn('font-medium text-sm', isActive ? 'text-moon-300' : 'text-white')}>{preset.label}</span>
                    </div>
                    <p class="text-xs text-midnight-400">{preset.description}</p>
                  </button>
                );
              }}
            </For>
          </div>

          {renderMainChart()}
        </Motion.div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="平均温度"
            value={`${avgStats().avgTemp}°C`}
            subtitle="环境温度均值"
            icon={Thermometer}
            color="mint"
            trend={{ value: 2.1, isPositive: false }}
          />
          <StatCard
            title="平均噪音"
            value={`${avgStats().avgNoise} dB`}
            subtitle="环境噪音水平"
            icon={Volume2}
            color="rose"
            trend={{ value: 5.3, isPositive: false }}
          />
          <StatCard
            title="平均心率"
            value={`${avgStats().avgHr} BPM`}
            subtitle="静息心率均值"
            icon={Heart}
            color="amber"
            trend={{ value: 3.2, isPositive: true }}
          />
          <StatCard
            title="数据质量"
            value={`${avgStats().avgQuality}%`}
            subtitle="时间戳对齐质量"
            icon={Target}
            color="blue"
          />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6"
          >
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-white font-display flex items-center gap-2">
                  <PieChart class="w-5 h-5 text-moon-400" />
                  睡眠分期分布
                </h3>
                <p class="text-sm text-midnight-400 mt-1">各睡眠阶段占比统计</p>
              </div>
            </div>
            <BaseChart option={sleepStagePieOption()} height="300px" />
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6"
          >
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-white font-display flex items-center gap-2">
                  <Radar class="w-5 h-5 text-mint-400" />
                  环境质量雷达图
                </h3>
                <p class="text-sm text-midnight-400 mt-1">多维度环境参数综合评估</p>
              </div>
            </div>
            <BaseChart option={environmentRadarOption()} height="300px" />
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6"
          >
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-white font-display flex items-center gap-2">
                  <Activity class="w-5 h-5 text-rose-400" />
                  心率变异性分析
                </h3>
                <p class="text-sm text-midnight-400 mt-1">RMSSD 与 SDNN 时域分析</p>
              </div>
            </div>
            <BaseChart option={hrvChartOption()} height="300px" />
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6"
          >
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-white font-display flex items-center gap-2">
                  <TrendingUp class="w-5 h-5 text-blue-400" />
                  数据质量趋势
                </h3>
                <p class="text-sm text-midnight-400 mt-1">时间戳对齐质量评分变化</p>
              </div>
            </div>
            <BaseChart option={dataQualityOption()} height="300px" />
          </Motion.div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <For each={VARIABLE_OPTIONS}>
            {(variable) => {
              const isSelected = selectedVariables().includes(variable.key);
              return (
                <Motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleVariableToggle(variable.key)}
                  class={cn(
                    'p-3 rounded-xl border transition-all text-center',
                    isSelected
                      ? 'border-moon-500/50 bg-moon-500/10'
                      : 'border-midnight-700/30 bg-midnight-800/30 hover:border-midnight-600/50'
                  )}
                >
                  <div
                    class="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ 'background-color': `${variable.color}20` }}
                  >
                    {variable.key === 'lightLux' && <Sun class="w-4 h-4" style={{ color: variable.color }} />}
                    {variable.key === 'temperatureC' && <Thermometer class="w-4 h-4" style={{ color: variable.color }} />}
                    {variable.key === 'noiseDb' && <Volume2 class="w-4 h-4" style={{ color: variable.color }} />}
                    {variable.key === 'humidity' && <Droplets class="w-4 h-4" style={{ color: variable.color }} />}
                    {variable.key === 'stage' && <Brain class="w-4 h-4" style={{ color: variable.color }} />}
                    {variable.key === 'heartRate' && <Heart class="w-4 h-4" style={{ color: variable.color }} />}
                    {variable.key === 'respiration' && <Wind class="w-4 h-4" style={{ color: variable.color }} />}
                    {variable.key === 'alignmentScore' && <Target class="w-4 h-4" style={{ color: variable.color }} />}
                  </div>
                  <p class={cn('text-xs font-medium', isSelected ? 'text-moon-300' : 'text-midnight-300')}>
                    {variable.label}
                  </p>
                </Motion.button>
              );
            }}
          </For>
        </div>
      </div>
    </MainLayout>
  );
};

export default Visualize;
