import { Component, createMemo, createSignal, onMount, For } from 'solid-js';
import { Motion } from '@motionone/solid';
import {
  Calendar,
  Clock,
  Moon,
  Star,
  TrendingUp,
  Filter,
  ChevronLeft,
  ChevronRight,
  Home,
  Briefcase,
  Plane,
  Building,
  X,
  BarChart3,
  PieChart,
  Thermometer,
  Volume2,
  Droplets,
  Sun,
  Sparkles,
  Brain,
} from 'lucide-solid';
import { MainLayout } from '@/components/layout';
import { BaseChart } from '@/components/charts';
import { StatCard } from '@/components/cards';
import { Button } from '@/components/controls';
import { generateHistoricalSessions, generateSleepData } from '@/mock';
import type { EChartsOption } from 'echarts';
import type { SleepSession, ScenarioType, SleepStagePoint } from '@/types/data';
import {
  SLEEP_STAGE_COLORS,
  SLEEP_STAGE_LABELS,
  SCENARIO_LABELS,
} from '@/types/data';
import { formatDate, formatDurationMs, formatTime, getRelativeTimeLabel, formatTimestamp } from '@/utils/time';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 7;

const scenarioIcons: Record<string, Component<{ class?: string }>> = {
  '居家': Home,
  '出差': Briefcase,
  '度假': Plane,
  '酒店': Building,
  '其他': Building,
};

const scenarioColors: Record<string, string> = {
  '居家': 'text-moon-400 bg-moon-500/20',
  '出差': 'text-amber-400 bg-amber-500/20',
  '度假': 'text-mint-400 bg-mint-500/20',
  '酒店': 'text-blue-400 bg-blue-500/20',
  '其他': 'text-midnight-400 bg-midnight-500/20',
};

const timeRanges = [
  { label: '最近7天', value: 7 },
  { label: '最近15天', value: 15 },
  { label: '最近30天', value: 30 },
];

const scoreColor = (score: number): string => {
  if (score >= 85) return 'text-mint-400';
  if (score >= 70) return 'text-moon-400';
  if (score >= 55) return 'text-amber-400';
  return 'text-rose-400';
};

const scoreLabel = (score: number): string => {
  if (score >= 85) return '优秀';
  if (score >= 70) return '良好';
  if (score >= 55) return '一般';
  return '较差';
};

const Archive: Component = () => {
  const [allSessions, setAllSessions] = createSignal<SleepSession[]>([]);
  const [selectedScenario, setSelectedScenario] = createSignal<string>('全部');
  const [timeRange, setTimeRange] = createSignal(30);
  const [currentPage, setCurrentPage] = createSignal(1);
  const [selectedSession, setSelectedSession] = createSignal<SleepSession | null>(null);
  const [sessionSleepData, setSessionSleepData] = createSignal<SleepStagePoint[]>([]);

  const userId = 'user-001';
  const deviceId = 'device-001';

  onMount(() => {
    const sessions = generateHistoricalSessions(userId, deviceId, 30);
    setAllSessions(sessions);
    if (sessions.length > 0) {
      setSelectedSession(sessions[0]);
      const sleepData = generateSleepData({
        sessionId: sessions[0].id,
        startTime: sessions[0].startTime,
        durationMs: sessions[0].endTime - sessions[0].startTime,
        sampleIntervalMs: 30000,
        sleepQuality: 'good',
      });
      setSessionSleepData(sleepData);
    }
  });

  const filteredSessions = createMemo(() => {
    return allSessions().filter((s) => {
      if (selectedScenario() !== '全部' && s.scenario !== selectedScenario()) {
        return false;
      }
      const daysAgo = (Date.now() - s.startTime) / (1000 * 60 * 60 * 24);
      return daysAgo <= timeRange();
    });
  });

  const paginatedSessions = createMemo(() => {
    const start = (currentPage() - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredSessions().slice(start, end);
  });

  const totalPages = createMemo(() => {
    return Math.max(1, Math.ceil(filteredSessions().length / PAGE_SIZE));
  });

  const stats = createMemo(() => {
    const sessions = filteredSessions();
    if (sessions.length === 0) {
      return {
        totalCount: 0,
        avgScore: 0,
        bestScore: 0,
        totalDuration: 0,
      };
    }

    const totalCount = sessions.length;
    const avgScore = Math.round(
      sessions.reduce((sum, s) => sum + s.sleepScore, 0) / totalCount
    );
    const bestScore = Math.max(...sessions.map((s) => s.sleepScore));
    const totalDuration = sessions.reduce(
      (sum, s) => sum + (s.endTime - s.startTime),
      0
    );

    return { totalCount, avgScore, bestScore, totalDuration };
  });

  const trendChartOption = createMemo((): EChartsOption => {
    const sessions = filteredSessions();
    const dates = sessions.map((s) => formatTimestamp(s.startTime, 'MM-dd'));
    const scores = sessions.map((s) => s.sleepScore);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F1F5F9', fontSize: 12 },
        formatter: (params: any) => {
          const param = params[0];
          return `${param.name}<br/>睡眠评分: <strong>${param.value}</strong> (${scoreLabel(param.value)})`;
        },
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
        data: dates,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94A3B8', fontSize: 10 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94A3B8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1E293B', type: 'dashed' } },
      },
      series: [
        {
          name: '睡眠评分',
          type: 'line',
          data: scores,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 3,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#8B5CF6' },
                { offset: 1, color: '#10B981' },
              ],
            },
          },
          itemStyle: {
            color: (params: any) => {
              const value = params.value;
              if (value >= 85) return '#10B981';
              if (value >= 70) return '#8B5CF6';
              if (value >= 55) return '#F59E0B';
              return '#EF4444';
            },
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
                { offset: 1, color: 'rgba(139, 92, 246, 0.02)' },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#475569', type: 'dashed' },
            data: [{ yAxis: 70, label: { formatter: '良好线', color: '#94A3B8', fontSize: 10 } }],
          },
        },
      ],
    };
  });

  const scoreDistributionOption = createMemo((): EChartsOption => {
    const sessions = filteredSessions();
    const distribution = { excellent: 0, good: 0, average: 0, poor: 0 };

    sessions.forEach((s) => {
      if (s.sleepScore >= 85) distribution.excellent++;
      else if (s.sleepScore >= 70) distribution.good++;
      else if (s.sleepScore >= 55) distribution.average++;
      else distribution.poor++;
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F1F5F9', fontSize: 12 },
        formatter: '{b}: {c} 次 ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: '#94A3B8', fontSize: 11 },
        itemWidth: 12,
        itemHeight: 12,
      },
      series: [
        {
          name: '评分分布',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#0F172A',
            borderWidth: 3,
          },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#fff' },
          },
          labelLine: { show: false },
          data: [
            { value: distribution.excellent, name: '优秀 (85+)', itemStyle: { color: '#10B981' } },
            { value: distribution.good, name: '良好 (70-84)', itemStyle: { color: '#8B5CF6' } },
            { value: distribution.average, name: '一般 (55-69)', itemStyle: { color: '#F59E0B' } },
            { value: distribution.poor, name: '较差 (<55)', itemStyle: { color: '#EF4444' } },
          ],
        },
      ],
    };
  });

  const sessionPieChartOption = createMemo((): EChartsOption => {
    const session = selectedSession();
    if (!session) {
      return { backgroundColor: 'transparent' };
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F1F5F9', fontSize: 12 },
        formatter: (params: any) => {
          return `${params.name}: ${formatDurationMs(params.value)} (${params.percent}%)`;
        },
      },
      series: [
        {
          name: '睡眠结构',
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#0F172A',
            borderWidth: 3,
          },
          label: {
            show: true,
            position: 'outside',
            color: '#94A3B8',
            fontSize: 11,
            formatter: '{b}\n{d}%',
          },
          labelLine: {
            length: 15,
            length2: 10,
            lineStyle: { color: '#475569' },
          },
          data: [
            {
              value: session.deepSleepDuration,
              name: '深睡',
              itemStyle: { color: SLEEP_STAGE_COLORS[3] },
            },
            {
              value: session.remSleepDuration,
              name: 'REM',
              itemStyle: { color: SLEEP_STAGE_COLORS[1] },
            },
            {
              value: session.lightSleepDuration,
              name: '浅睡',
              itemStyle: { color: SLEEP_STAGE_COLORS[2] },
            },
            {
              value: session.awakeDuration,
              name: '清醒',
              itemStyle: { color: SLEEP_STAGE_COLORS[0] },
            },
          ],
        },
      ],
    };
  });

  const handleSelectSession = (session: SleepSession) => {
    setSelectedSession(session);
    const sleepData = generateSleepData({
      sessionId: session.id,
      startTime: session.startTime,
      durationMs: session.endTime - session.startTime,
      sampleIntervalMs: 30000,
      sleepQuality: session.sleepScore >= 85 ? 'excellent' :
                    session.sleepScore >= 70 ? 'good' :
                    session.sleepScore >= 55 ? 'average' : 'poor',
    });
    setSessionSleepData(sleepData);
  };

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages(), p + 1));
  };

  const scenarioOptions = ['全部', '居家', '出差', '度假', '酒店'];

  return (
    <MainLayout>
      <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              class="text-2xl font-bold text-white font-display"
            >
              睡眠档案
            </Motion.h1>
            <Motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              class="text-midnight-400 mt-1"
            >
              查看历史睡眠记录，分析长期睡眠趋势
            </Motion.p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-2 bg-midnight-800/50 rounded-xl p-1">
              <For each={timeRanges}>
                {(range) => (
                  <button
                    onClick={() => {
                      setTimeRange(range.value);
                      setCurrentPage(1);
                    }}
                    class={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                      timeRange() === range.value
                        ? 'bg-moon-500 text-white'
                        : 'text-midnight-400 hover:text-white hover:bg-midnight-700/50'
                    )}
                  >
                    {range.label}
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>

        <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <Filter class="w-4 h-4 text-midnight-400" />
            <span class="text-sm text-midnight-300">场景筛选</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <For each={scenarioOptions}>
              {(scenario) => {
                const Icon = scenario === '全部' ? Sparkles : scenarioIcons[scenario];
                return (
                  <button
                    onClick={() => {
                      setSelectedScenario(scenario);
                      setCurrentPage(1);
                    }}
                    class={cn(
                      'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200',
                      selectedScenario() === scenario
                        ? 'bg-moon-500/20 text-moon-400 border border-moon-500/30'
                        : 'bg-midnight-800/50 text-midnight-400 hover:text-white hover:bg-midnight-700/50 border border-transparent'
                    )}
                  >
                    <Icon class="w-4 h-4" />
                    {scenario}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="总记录数"
            value={stats().totalCount}
            subtitle="次睡眠记录"
            icon={Calendar}
            color="moon"
          />
          <StatCard
            title="平均评分"
            value={stats().avgScore}
            subtitle={scoreLabel(stats().avgScore)}
            icon={Star}
            color="mint"
          />
          <StatCard
            title="最佳睡眠"
            value={stats().bestScore}
            subtitle="最高评分"
            icon={TrendingUp}
            color="amber"
          />
          <StatCard
            title="睡眠总时长"
            value={formatDurationMs(stats().totalDuration)}
            subtitle="累计时长"
            icon={Clock}
            color="blue"
          />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-white font-display">睡眠趋势</h3>
                <p class="text-sm text-midnight-400 mt-0.5">近期睡眠评分变化趋势</p>
              </div>
              <div class="p-2 bg-moon-500/10 rounded-xl">
                <BarChart3 class="w-5 h-5 text-moon-400" />
              </div>
            </div>
            <BaseChart option={trendChartOption()} height="300px" />
          </div>

          <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-white font-display">评分分布</h3>
                <p class="text-sm text-midnight-400 mt-0.5">各评分等级占比</p>
              </div>
              <div class="p-2 bg-mint-500/10 rounded-xl">
                <PieChart class="w-5 h-5 text-mint-400" />
              </div>
            </div>
            <BaseChart option={scoreDistributionOption()} height="300px" />
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-white font-display">历史记录</h3>
                <p class="text-sm text-midnight-400 mt-0.5">
                  共 {filteredSessions().length} 条记录 · 第 {currentPage()} / {totalPages()} 页
                </p>
              </div>
              <div class="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage() === 1}
                >
                  <ChevronLeft class="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage() === totalPages()}
                >
                  <ChevronRight class="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div class="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
              <For each={paginatedSessions()}>
                {(session) => {
                  const ScenarioIcon = scenarioIcons[session.scenario] || Building;
                  return (
                    <Motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => handleSelectSession(session)}
                      class={cn(
                        'p-4 rounded-xl border cursor-pointer transition-all duration-200',
                        selectedSession()?.id === session.id
                          ? 'bg-moon-500/10 border-moon-500/30'
                          : 'bg-midnight-800/30 border-midnight-700/30 hover:bg-midnight-800/60 hover:border-midnight-600/50'
                      )}
                    >
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                            <p class="text-sm font-medium text-white truncate">
                              {formatDate(session.startTime)}
                            </p>
                            <span class={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                              scenarioColors[session.scenario] || 'text-midnight-400 bg-midnight-500/20'
                            )}>
                              <ScenarioIcon class="w-3 h-3" />
                              {session.scenario}
                            </span>
                          </div>
                          <p class="text-xs text-midnight-400">
                            {formatTime(session.startTime)} - {formatTime(session.endTime)} · {formatDurationMs(session.endTime - session.startTime)}
                          </p>
                          <div class="flex items-center gap-4 mt-2">
                            <div class="flex items-center gap-1">
                              <Moon class="w-3.5 h-3.5 text-mint-400" />
                              <span class="text-xs text-midnight-300">
                                深睡 {formatDurationMs(session.deepSleepDuration)}
                              </span>
                            </div>
                            <div class="flex items-center gap-1">
                              <span class="text-xs text-midnight-300">
                                REM {formatDurationMs(session.remSleepDuration)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div class="text-right flex-shrink-0">
                          <p class={cn('text-2xl font-bold font-display', scoreColor(session.sleepScore))}>
                            {session.sleepScore}
                          </p>
                          <p class="text-xs text-midnight-400">{scoreLabel(session.sleepScore)}</p>
                        </div>
                      </div>
                    </Motion.div>
                  );
                }}
              </For>
            </div>
          </div>

          {selectedSession() && (
            <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h3 class="text-lg font-semibold text-white font-display">睡眠详情</h3>
                  <p class="text-sm text-midnight-400 mt-0.5">
                    {formatDate(selectedSession()!.startTime)} · {getRelativeTimeLabel(selectedSession()!.startTime)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  class="p-1.5 rounded-lg text-midnight-400 hover:text-white hover:bg-midnight-700/50 transition-colors"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>

              <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-midnight-800/40 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-1">
                    <Moon class="w-4 h-4 text-moon-400" />
                    <span class="text-xs text-midnight-400">深睡时长</span>
                  </div>
                  <p class="text-lg font-semibold text-white font-display">
                    {formatDurationMs(selectedSession()!.deepSleepDuration)}
                  </p>
                </div>
                <div class="bg-midnight-800/40 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-1">
                    <Brain class="w-4 h-4 text-purple-400" />
                    <span class="text-xs text-midnight-400">REM时长</span>
                  </div>
                  <p class="text-lg font-semibold text-white font-display">
                    {formatDurationMs(selectedSession()!.remSleepDuration)}
                  </p>
                </div>
                <div class="bg-midnight-800/40 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-1">
                    <Clock class="w-4 h-4 text-blue-400" />
                    <span class="text-xs text-midnight-400">浅睡时长</span>
                  </div>
                  <p class="text-lg font-semibold text-white font-display">
                    {formatDurationMs(selectedSession()!.lightSleepDuration)}
                  </p>
                </div>
                <div class="bg-midnight-800/40 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-1">
                    <Sun class="w-4 h-4 text-amber-400" />
                    <span class="text-xs text-midnight-400">清醒时长</span>
                  </div>
                  <p class="text-lg font-semibold text-white font-display">
                    {formatDurationMs(selectedSession()!.awakeDuration)}
                  </p>
                </div>
              </div>

              <div class="mb-6">
                <h4 class="text-sm font-medium text-midnight-300 mb-3">睡眠结构</h4>
                <BaseChart option={sessionPieChartOption()} height="220px" />
              </div>

              <div>
                <h4 class="text-sm font-medium text-midnight-300 mb-3">环境参数平均</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex items-center gap-3 p-3 bg-midnight-800/30 rounded-xl">
                    <div class="p-2 bg-amber-500/10 rounded-lg">
                      <Thermometer class="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p class="text-sm font-medium text-white">22.5°C</p>
                      <p class="text-xs text-midnight-400">温度</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-3 p-3 bg-midnight-800/30 rounded-xl">
                    <div class="p-2 bg-blue-500/10 rounded-lg">
                      <Droplets class="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p class="text-sm font-medium text-white">55%</p>
                      <p class="text-xs text-midnight-400">湿度</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-3 p-3 bg-midnight-800/30 rounded-xl">
                    <div class="p-2 bg-rose-500/10 rounded-lg">
                      <Volume2 class="w-4 h-4 text-rose-400" />
                    </div>
                    <div>
                      <p class="text-sm font-medium text-white">38 dB</p>
                      <p class="text-xs text-midnight-400">噪音</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-3 p-3 bg-midnight-800/30 rounded-xl">
                    <div class="p-2 bg-mint-500/10 rounded-lg">
                      <Sun class="w-4 h-4 text-mint-400" />
                    </div>
                    <div>
                      <p class="text-sm font-medium text-white">5 lux</p>
                      <p class="text-xs text-midnight-400">光照</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Archive;
