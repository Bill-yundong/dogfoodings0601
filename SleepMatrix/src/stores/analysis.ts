import { createStore, produce } from 'solid-js/store';
import type { CorrelationResult, CorrelationMatrix, SensitivityScore, Recommendation, AnalysisResult } from '@/types/analysis';
import type { AlignedDataPoint } from '@/types/data';
import { CorrelationAnalysisEngine } from '@/engine/correlation';

interface AnalysisState {
  analysisResult: AnalysisResult | null;
  correlationMatrix: CorrelationMatrix | null;
  sensitivityScores: Record<string, SensitivityScore>;
  recommendations: Recommendation[];
  selectedVariables: string[];
  analysisHistory: AnalysisResult[];
  isAnalyzing: boolean;
  error: string | null;
  lastAnalysisTime: number | null;
}

const initialState: AnalysisState = {
  analysisResult: null,
  correlationMatrix: null,
  sensitivityScores: {},
  recommendations: [],
  selectedVariables: ['lightLux', 'temperatureC', 'noiseDb', 'humidity', 'sleepStage'],
  analysisHistory: [],
  isAnalyzing: false,
  error: null,
  lastAnalysisTime: null,
};

const [state, setState] = createStore<AnalysisState>(initialState);

export const analysisStore = state;

export const analysisActions = {
  setAnalyzing: (isAnalyzing: boolean) => {
    setState('isAnalyzing', isAnalyzing);
  },

  setError: (error: string | null) => {
    setState('error', error);
  },

  setSelectedVariables: (variables: string[]) => {
    setState('selectedVariables', variables);
  },

  runAnalysis: async (alignedData: AlignedDataPoint[], sessionId?: string) => {
    setState(produce(s => {
      s.isAnalyzing = true;
      s.error = null;
    }));

    try {
      const engine = new CorrelationAnalysisEngine();
      const result = await engine.runFullAnalysis(alignedData, sessionId || 'session-' + Date.now());

      setState(produce(s => {
        s.analysisResult = result;
        s.correlationMatrix = result.correlationMatrix;
        s.sensitivityScores = result.sensitivityScores;
        s.recommendations = result.recommendations;
        s.lastAnalysisTime = Date.now();
        s.isAnalyzing = false;

        if (s.analysisHistory.length >= 10) {
          s.analysisHistory.shift();
        }
        s.analysisHistory.push(result);
      }));

      return result;
    } catch (error) {
      setState(produce(s => {
        s.isAnalyzing = false;
        s.error = error instanceof Error ? error.message : '分析失败';
      }));
      throw error;
    }
  },

  runCorrelationMatrix: async (alignedData: AlignedDataPoint[]) => {
    setState(produce(s => {
      s.isAnalyzing = true;
      s.error = null;
    }));

    try {
      const engine = new CorrelationAnalysisEngine();
      const { DEFAULT_VARIABLES } = await import('@/engine/correlation');
      const matrix = engine.calculateCorrelationMatrix(alignedData, DEFAULT_VARIABLES);

      setState(produce(s => {
        s.correlationMatrix = matrix;
        s.isAnalyzing = false;
      }));

      return matrix;
    } catch (error) {
      setState(produce(s => {
        s.isAnalyzing = false;
        s.error = error instanceof Error ? error.message : '相关性矩阵计算失败';
      }));
      throw error;
    }
  },

  getSignificantCorrelations: (threshold: number = 0.5): CorrelationResult[] => {
    if (!state.correlationMatrix?.matrix) return [];
    const results: CorrelationResult[] = [];
    const n = state.correlationMatrix.matrix.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const c = state.correlationMatrix.matrix[i][j];
        if (Math.abs(c.pearson) >= threshold && c.significant) {
          results.push(c);
        }
      }
    }
    return results.sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson));
  },

  clearAnalysis: () => {
    setState(produce(s => {
      s.analysisResult = null;
      s.correlationMatrix = null;
      s.sensitivityScores = {};
      s.recommendations = [];
      s.error = null;
    }));
  },

  clearHistory: () => {
    setState('analysisHistory', []);
  },
};
