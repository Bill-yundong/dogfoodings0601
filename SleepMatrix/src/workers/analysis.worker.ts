/// <reference lib="webworker" />

import { TimestampAlignmentEngine, type AlignmentConfig } from '@/engine/alignment';
import { CorrelationAnalysisEngine, type CorrelationAnalysisConfig } from '@/engine/correlation';
import type { EnvDataPoint, SleepStagePoint, AlignedDataPoint } from '@/types/data';
import type { AnalysisResult, AnalysisTask } from '@/types/analysis';

type WorkerMessage =
  | { type: 'alignData'; payload: { envData: EnvDataPoint[]; sleepData: SleepStagePoint[]; config?: Partial<AlignmentConfig> } }
  | { type: 'runAnalysis'; payload: { alignedData: AlignedDataPoint[]; sessionId: string; config?: Partial<CorrelationAnalysisConfig> } }
  | { type: 'fullPipeline'; payload: { envData: EnvDataPoint[]; sleepData: SleepStagePoint[]; sessionId: string; alignmentConfig?: Partial<AlignmentConfig>; analysisConfig?: Partial<CorrelationAnalysisConfig> } }
  | { type: 'cancel' };

type WorkerResponse =
  | { type: 'progress'; payload: { taskId: string; progress: number; message: string } }
  | { type: 'alignmentComplete'; payload: { alignedData: AlignedDataPoint[]; stats: unknown } }
  | { type: 'analysisComplete'; payload: AnalysisResult }
  | { type: 'pipelineComplete'; payload: { alignedData: AlignedDataPoint[]; analysis: AnalysisResult } }
  | { type: 'error'; payload: { message: string; error?: unknown } };

let alignmentEngine: TimestampAlignmentEngine | null = null;
let analysisEngine: CorrelationAnalysisEngine | null = null;
let isCancelled = false;

const taskProgress = new Map<string, number>();

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const message = e.data;
  isCancelled = false;

  try {
    switch (message.type) {
      case 'alignData':
        await handleAlignData(message.payload);
        break;
      case 'runAnalysis':
        await handleRunAnalysis(message.payload);
        break;
      case 'fullPipeline':
        await handleFullPipeline(message.payload);
        break;
      case 'cancel':
        isCancelled = true;
        break;
    }
  } catch (error) {
    postMessage({
      type: 'error',
      payload: {
        message: 'Analysis worker error',
        error: error instanceof Error ? error.message : String(error),
      },
    } as WorkerResponse);
  }
};

async function handleAlignData(payload: {
  envData: EnvDataPoint[];
  sleepData: SleepStagePoint[];
  config?: Partial<AlignmentConfig>;
}): Promise<void> {
  if (!alignmentEngine) {
    alignmentEngine = new TimestampAlignmentEngine(payload.config);
  }

  postProgress('align', 0, '正在对齐数据...');

  const result = alignmentEngine.alignData(payload.envData, payload.sleepData);

  postProgress('align', 100, '数据对齐完成');

  postMessage({
    type: 'alignmentComplete',
    payload: {
      alignedData: result.alignedData,
      stats: result.alignmentStats,
    },
  } as WorkerResponse);
}

async function handleRunAnalysis(payload: {
  alignedData: AlignedDataPoint[];
  sessionId: string;
  config?: Partial<CorrelationAnalysisConfig>;
}): Promise<void> {
  if (!analysisEngine) {
    analysisEngine = new CorrelationAnalysisEngine(payload.config);
  }

  postProgress('analysis', 0, '正在计算相关性矩阵...');
  await delay(50);

  if (isCancelled) return;

  postProgress('analysis', 30, '正在计算敏感度分数...');
  await delay(50);

  if (isCancelled) return;

  postProgress('analysis', 60, '正在生成优化建议...');
  await delay(50);

  if (isCancelled) return;

  const result = await analysisEngine.runFullAnalysis(payload.alignedData, payload.sessionId);

  postProgress('analysis', 100, '分析完成');

  postMessage({
    type: 'analysisComplete',
    payload: result,
  } as WorkerResponse);
}

async function handleFullPipeline(payload: {
  envData: EnvDataPoint[];
  sleepData: SleepStagePoint[];
  sessionId: string;
  alignmentConfig?: Partial<AlignmentConfig>;
  analysisConfig?: Partial<CorrelationAnalysisConfig>;
}): Promise<void> {
  if (!alignmentEngine) {
    alignmentEngine = new TimestampAlignmentEngine(payload.alignmentConfig);
  }
  if (!analysisEngine) {
    analysisEngine = new CorrelationAnalysisEngine(payload.analysisConfig);
  }

  postProgress('pipeline', 0, '正在对齐时间戳...');
  await delay(30);

  if (isCancelled) return;

  const alignmentResult = alignmentEngine.alignData(payload.envData, payload.sleepData);

  postProgress('pipeline', 30, '数据对齐完成，开始相关性分析...');
  await delay(30);

  if (isCancelled) return;
  if (alignmentResult.alignedData.length < 30) {
    throw new Error('对齐后数据点不足，无法进行分析');
  }

  postProgress('pipeline', 50, '正在计算相关性矩阵...');
  await delay(30);

  if (isCancelled) return;

  postProgress('pipeline', 70, '正在计算敏感度分数...');
  await delay(30);

  if (isCancelled) return;

  postProgress('pipeline', 85, '正在生成优化建议...');
  await delay(30);

  if (isCancelled) return;

  const analysisResult = await analysisEngine.runFullAnalysis(
    alignmentResult.alignedData,
    payload.sessionId
  );

  postProgress('pipeline', 100, '分析完成');

  postMessage({
    type: 'pipelineComplete',
    payload: {
      alignedData: alignmentResult.alignedData,
      analysis: analysisResult,
    },
  } as WorkerResponse);
}

function postProgress(taskId: string, progress: number, message: string): void {
  taskProgress.set(taskId, progress);
  postMessage({
    type: 'progress',
    payload: { taskId, progress, message },
  } as WorkerResponse);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanup(): void {
  alignmentEngine = null;
  analysisEngine = null;
  taskProgress.clear();
}

self.addEventListener('beforeunload', cleanup);
