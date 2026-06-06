import { Component, createEffect, createSignal, For, onMount } from 'solid-js';
import { Motion } from '@motionone/solid';
import {
  Moon,
  Sun,
  Thermometer,
  Volume2,
  Droplets,
  Brain,
  Play,
  Square,
  RefreshCw,
  Database,
  Download,
} from 'lucide-solid';
import { v4 as uuidv4 } from 'uuid';
import { MainLayout } from '@/components/layout';
import { StatCard, EnvDataCard, SleepStageCard, AlignmentCard } from '@/components/cards';
import { TimeSeriesChart } from '@/components/charts';
import { Button } from '@/components/controls';
import { realtimeStore, realtimeActions } from '@/stores/realtime';
import { analysisStore, analysisActions } from '@/stores/analysis';
import { devicesActions } from '@/stores/devices';
import { configStore, configActions } from '@/stores/config';
import {
  generateEnvData,
  generateSleepData,
  generateRealtimeEnvPoint,
  generateRealtimeSleepPoint,
  generateHistoricalSessions,
} from '@/mock';
import { TimestampAlignmentEngine } from '@/engine/alignment';
import type { EnvDataPoint, SleepStagePoint, AlignedDataPoint } from '@/types/data';
import { cn } from '@/lib/utils';

const Dashboard: Component = () => {
  const [latestEnv, setLatestEnv] = createSignal<EnvDataPoint | null>(null);
  const [latestSleep, setLatestSleep] = createSignal<SleepStagePoint | null>(null);
  const [isGenerating, setIsGenerating] = createSignal(false);
  let dataInterval: number | null = null;

  const userId = 'user-001';
  const deviceId = 'device-001';

  onMount(async () => {
    await configActions.loadConfig();
    await devicesActions.loadDevices(userId);

    const sessionId = uuidv4();
    const startTime = Date.now() - 8 * 60 * 60 * 1000;
    const durationMs = 7.5 * 60 * 60 * 1000;

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

    realtimeActions.setEnvData(envData);
    realtimeActions.setSleepData(sleepData);
    realtimeActions.setAlignedData(alignmentResult.alignedData);

    if (envData.length > 0) {
      setLatestEnv(envData[envData.length - 1]);
    }
    if (sleepData.length > 0) {
      setLatestSleep(sleepData[sleepData.length - 1]);
    }

    await analysisActions.runAnalysis(alignmentResult.alignedData, sessionId);
  });

  const startRealtimeGeneration = () => {
    if (dataInterval) return;

    setIsGenerating(true);
    realtimeActions.setRecording(true);
    realtimeActions.setConnected(true);

    const sessionId = realtimeStore.currentSession?.id ?? uuidv4();
    let lastEnv = latestEnv() ?? undefined;
    let lastSleep = latestSleep() ?? undefined;

    dataInterval = window.setInterval(() => {
      const timestamp = Date.now();

      const newEnv = generateRealtimeEnvPoint(sessionId, timestamp, lastEnv);
      const newSleep = generateRealtimeSleepPoint(sessionId, timestamp, lastSleep);

      realtimeActions.addEnvData(newEnv);
      realtimeActions.addSleepData(newSleep);

      const alignedPoint: AlignedDataPoint = {
        timestamp,
        env: newEnv,
        sleep: newSleep,
        alignmentScore: 0.85 + Math.random() * 0.15,
      };
      realtimeActions.addAlignedData(alignedPoint);

      setLatestEnv(newEnv);
      setLatestSleep(newSleep);
      lastEnv = newEnv;
      lastSleep = newSleep;
    }, configActions.getRefreshRateMs());
  };

  const stopRealtimeGeneration = () => {
    if (dataInterval) {
      clearInterval(dataInterval);
      dataInterval = null;
    }
    setIsGenerating(false);
    realtimeActions.setRecording(false);
  };

  const runFullAnalysis = async () => {
    if (realtimeStore.alignedData.length > 0) {
      const sessionId = realtimeStore.currentSession?.id || 'session-' + Date.now();
      await analysisActions.runAnalysis(realtimeStore.alignedData, sessionId);
    }
  };

  const exportData = async () => {
    const data = {
      session: realtimeStore.currentSession,
      envData: realtimeStore.envData,
      sleepData: realtimeStore.sleepData,
      alignedData: realtimeStore.alignedData,
      analysis: analysisStore.analysisResult,
      exportedAt: Date.now(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sleepmatrix-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  createEffect(() => {
    return () => {
      if (dataInterval) {
        clearInterval(dataInterval);
      }
    };
  });

  const sleepScore = () => realtimeStore.currentSession?.sleepScore ?? 0;
  const dataPoints = () => realtimeStore.alignedData.length;
  const avgAlignment = () => {
    const data = realtimeStore.alignedData;
    if (data.length === 0) return 0;
    const avg = data.reduce((sum: number, d) => sum + d.alignmentScore, 0) / data.length;
    return Math.round(avg * 100);
  };

  const selectedVariables = ['lightLux', 'temperatureC', 'noiseDb', 'stage'];

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
              睡眠环境质量分析仪表盘
            </Motion.h1>
            <Motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              class="text-midnight-400 mt-1"
            >
              实时监测睡眠环境参数与生理数据的多维关联分析
            </Motion.p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            {!isGenerating() ? (
              <Button
                variant="success"
                icon={Play}
                onClick={startRealtimeGeneration}
              >
                开始记录
              </Button>
            ) : (
              <Button
                variant="danger"
                icon={Square}
                onClick={stopRealtimeGeneration}
              >
                停止记录
              </Button>
            )}
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={runFullAnalysis}
              loading={analysisStore.isAnalyzing}
            >
              运行分析
            </Button>
            <Button
              variant="ghost"
              icon={Download}
              onClick={exportData}
            >
              导出数据
            </Button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="睡眠质量评分"
            value={sleepScore()}
            subtitle="基于多维度分析"
            icon={Moon}
            color="moon"
            trend={{ value: 5.2, isPositive: true }}
          />
          <StatCard
            title="已对齐数据点"
            value={dataPoints()}
            subtitle="时间戳对齐引擎"
            icon={Database}
            color="mint"
            trend={{ value: 12.8, isPositive: true }}
          />
          <StatCard
            title="平均对齐质量"
            value={`${avgAlignment()}%`}
            subtitle="滑动时间窗算法"
            icon={Brain}
            color="blue"
          />
          <StatCard
            title="在线设备"
            value={devicesActions.getOnlineDevices().length}
            subtitle="个设备连接正常"
            icon={Sun}
            color="amber"
          />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-1">
            <EnvDataCard data={latestEnv()} />
          </div>
          <div class="lg:col-span-1">
            <SleepStageCard data={latestSleep()} />
          </div>
          <div class="lg:col-span-1">
            <AlignmentCard alignedData={realtimeStore.alignedData} />
          </div>
        </div>

        <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-lg font-semibold text-white font-display">多维度时序数据</h3>
              <p class="text-sm text-midnight-400 mt-1">
                环境参数与睡眠生理数据的实时对齐展示
              </p>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1.5 px-3 py-1.5 bg-midnight-800/40 rounded-xl">
                <div class={cn(
                  'w-2 h-2 rounded-full',
                  isGenerating() ? 'bg-mint-400 animate-pulse' : 'bg-midnight-500'
                )} />
                <span class="text-xs text-midnight-300">
                  {isGenerating() ? '实时流' : '历史数据'}
                </span>
              </div>
            </div>
          </div>

          <TimeSeriesChart
            data={realtimeStore.alignedData}
            variables={selectedVariables}
            height="400px"
          />
        </div>

        {analysisStore.analysisResult && (
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
              <h3 class="text-lg font-semibold text-white font-display mb-4">关键发现</h3>
              <div class="space-y-3">
                <For each={analysisStore.analysisResult.keyInsights.slice(0, 4)}>
                  {(insight, idx) => (
                    <Motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx() * 0.1 }}
                      class="flex items-start gap-3 p-3 bg-midnight-800/40 rounded-xl border border-midnight-700/30"
                    >
                      <div class={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                        insight.severity === 'positive' ? 'bg-mint-500/20 text-mint-400' :
                        insight.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-rose-500/20 text-rose-400'
                      )}>
                        <span class="text-xs font-bold">{idx() + 1}</span>
                      </div>
                      <div>
                        <p class="text-sm text-white">{insight.message}</p>
                        <p class="text-xs text-midnight-400 mt-1">
                          相关系数: {Math.round(insight.correlation * 100)}%
                        </p>
                      </div>
                    </Motion.div>
                  )}
                </For>
              </div>
            </div>

            <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
              <h3 class="text-lg font-semibold text-white font-display mb-4">优化建议</h3>
              <div class="space-y-3">
                <For each={analysisStore.analysisResult.recommendations.slice(0, 4)}>
                  {(rec, idx) => (
                    <Motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx() * 0.1 }}
                      class="flex items-start gap-3 p-3 bg-midnight-800/40 rounded-xl border border-midnight-700/30"
                    >
                      <div class="w-6 h-6 rounded-full bg-moon-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Brain class="w-3.5 h-3.5 text-moon-400" />
                      </div>
                      <div>
                        <p class="text-sm text-white font-medium">{rec.parameter}</p>
                        <p class="text-xs text-midnight-400 mt-1">
                          预计提升: {Math.round(rec.expectedImprovement * 100)}%
                        </p>
                      </div>
                    </Motion.div>
                  )}
                </For>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Dashboard;
