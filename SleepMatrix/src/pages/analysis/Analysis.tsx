import { Component, createMemo, createSignal, For } from 'solid-js';
import { Motion } from '@motionone/solid';
import {
  Play,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Brain,
  Zap,
  Target,
  ChevronDown,
  ChevronUp,
  X,
  Droplets,
} from 'lucide-solid';
import { MainLayout } from '@/components/layout';
import { CorrelationHeatmap } from '@/components/charts';
import { StatCard } from '@/components/cards';
import { Button, Toggle } from '@/components/controls';
import { realtimeStore, realtimeActions } from '@/stores/realtime';
import { analysisStore, analysisActions } from '@/stores/analysis';
import { configStore, configActions } from '@/stores/config';
import type { CorrelationResult, SensitivityScore, Recommendation } from '@/types/analysis';
import { VARIABLE_LABELS, PARAMETER_UNITS, OPTIMAL_RANGES } from '@/types/analysis';
import { cn } from '@/lib/utils';

const Analysis: Component = () => {
  const [showOnlySignificant, setShowOnlySignificant] = createSignal(true);
  const [expandedRecommendations, setExpandedRecommendations] = createSignal<Set<string>>(new Set());
  const [variableDropdownOpen, setVariableDropdownOpen] = createSignal(false);

  const availableVariables = [
    { key: 'lightLux', label: '光照', category: '环境' },
    { key: 'temperatureC', label: '温度', category: '环境' },
    { key: 'noiseDb', label: '噪音', category: '环境' },
    { key: 'humidity', label: '湿度', category: '环境' },
    { key: 'sleepStage', label: '睡眠分期', category: '睡眠' },
    { key: 'sleepScore', label: '睡眠评分', category: '睡眠' },
    { key: 'deepSleepRatio', label: '深睡比例', category: '睡眠' },
    { key: 'remSleepRatio', label: 'REM比例', category: '睡眠' },
    { key: 'sleepEfficiency', label: '睡眠效率', category: '睡眠' },
    { key: 'heartRate', label: '心率', category: '生理' },
    { key: 'respiration', label: '呼吸频率', category: '生理' },
  ];

  const allCorrelations = createMemo((): CorrelationResult[] => {
    const matrix = analysisStore.correlationMatrix;
    if (!matrix?.matrix) return [];

    const results: CorrelationResult[] = [];
    const n = matrix.matrix.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        results.push(matrix.matrix[i][j]);
      }
    }

    return results.sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson));
  });

  const significantCorrelations = createMemo(() => {
    return allCorrelations().filter(c => c.significant && Math.abs(c.pearson) >= 0.3);
  });

  const displayCorrelations = createMemo(() => {
    return showOnlySignificant() ? significantCorrelations() : allCorrelations();
  });

  const stats = createMemo(() => {
    const correlations = allCorrelations();
    if (correlations.length === 0) {
      return {
        significantCount: 0,
        maxPositive: 0,
        maxNegative: 0,
        avgStrength: 0,
      };
    }

    const significantCount = significantCorrelations().length;
    const maxPositive = Math.max(...correlations.map(c => c.pearson), 0);
    const maxNegative = Math.min(...correlations.map(c => c.pearson), 0);
    const avgStrength = correlations.reduce((sum, c) => sum + Math.abs(c.pearson), 0) / correlations.length;

    return {
      significantCount,
      maxPositive,
      maxNegative,
      avgStrength,
    };
  });

  const sensitivityScoresList = createMemo((): SensitivityScore[] => {
    const scores = analysisStore.sensitivityScores;
    if (Array.isArray(scores)) {
      return scores.sort((a, b) => b.score - a.score);
    }
    return Object.values(scores || {}).sort((a, b) => b.score - a.score);
  });

  const handleVariableToggle = (variableKey: string) => {
    const current = analysisStore.selectedVariables;
    const isSelected = current.includes(variableKey);

    if (isSelected) {
      if (current.length > 2) {
        analysisActions.setSelectedVariables(current.filter(v => v !== variableKey));
      }
    } else {
      analysisActions.setSelectedVariables([...current, variableKey]);
    }
  };

  const handleRunAnalysis = async () => {
    if (realtimeStore.alignedData.length > 0) {
      const sessionId = realtimeStore.currentSession?.id || 'session-' + Date.now();
      await analysisActions.runAnalysis(realtimeStore.alignedData, sessionId);
    }
  };

  const toggleRecommendation = (id: string) => {
    const newSet = new Set(expandedRecommendations());
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRecommendations(newSet);
  };

  const getCorrelationColor = (value: number) => {
    if (value >= 0.7) return 'text-rose-400';
    if (value >= 0.4) return 'text-amber-400';
    if (value >= 0.1) return 'text-midnight-400';
    if (value >= -0.1) return 'text-midnight-500';
    if (value >= -0.4) return 'text-blue-400';
    if (value >= -0.7) return 'text-indigo-400';
    return 'text-purple-400';
  };

  const getCorrelationBg = (value: number) => {
    if (value >= 0.7) return 'bg-rose-500/20 border-rose-500/30';
    if (value >= 0.4) return 'bg-amber-500/20 border-amber-500/30';
    if (value >= 0.1) return 'bg-midnight-700/50 border-midnight-600/30';
    if (value >= -0.1) return 'bg-midnight-800/50 border-midnight-700/30';
    if (value >= -0.4) return 'bg-blue-500/20 border-blue-500/30';
    if (value >= -0.7) return 'bg-indigo-500/20 border-indigo-500/30';
    return 'bg-purple-500/20 border-purple-500/30';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', label: '高' };
      case 'medium': return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', label: '中' };
      case 'low': return { bg: 'bg-mint-500/20', text: 'text-mint-400', border: 'border-mint-500/30', label: '低' };
      default: return { bg: 'bg-midnight-700/50', text: 'text-midnight-400', border: 'border-midnight-600/30', label: '未知' };
    }
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'positive': return <TrendingUp class="w-4 h-4 text-rose-400" />;
      case 'negative': return <TrendingDown class="w-4 h-4 text-blue-400" />;
      default: return <Activity class="w-4 h-4 text-midnight-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'light': return <Zap class="w-5 h-5" />;
      case 'temperature': return <TrendingUp class="w-5 h-5" />;
      case 'noise': return <Activity class="w-5 h-5" />;
      case 'humidity': return <Droplets class="w-5 h-5" />;
      case 'combined': return <Brain class="w-5 h-5" />;
      default: return <Target class="w-5 h-5" />;
    }
  };

  const groupedVariables = createMemo(() => {
    const groups: Record<string, typeof availableVariables> = {
      '环境参数': [],
      '睡眠指标': [],
      '生理指标': [],
    };

    availableVariables.forEach(v => {
      if (v.category === '环境') groups['环境参数'].push(v);
      else if (v.category === '睡眠') groups['睡眠指标'].push(v);
      else groups['生理指标'].push(v);
    });

    return groups;
  });

  return (
    <MainLayout>
      <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <Motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              class="text-2xl font-bold text-white font-display"
            >
              关联分析
            </Motion.h1>
            <Motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              class="text-midnight-400 mt-1"
            >
              多维度变量相关性分析与敏感度评估
            </Motion.p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <div class="relative">
              <Button
                variant="secondary"
                onClick={() => setVariableDropdownOpen(!variableDropdownOpen())}
                class="min-w-[180px] justify-between"
              >
                <span>变量选择 ({analysisStore.selectedVariables.length})</span>
                {variableDropdownOpen() ? <ChevronUp class="w-4 h-4" /> : <ChevronDown class="w-4 h-4" />}
              </Button>

              {variableDropdownOpen() && (
                <Motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  class="absolute top-full right-0 mt-2 w-72 bg-midnight-900/95 backdrop-blur-xl border border-midnight-700/50 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div class="p-3 border-b border-midnight-700/50">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium text-white">选择分析变量</span>
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
                                const isSelected = analysisStore.selectedVariables.includes(variable.key);
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
                                      {isSelected && <CheckCircle class="w-3 h-3 text-white" />}
                                    </div>
                                    <span class="text-sm">{variable.label}</span>
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
              variant="primary"
              icon={Play}
              onClick={handleRunAnalysis}
              loading={analysisStore.isAnalyzing}
            >
              运行分析
            </Button>
          </div>
        </div>

        {analysisStore.isAnalyzing && (
          <Motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            class="bg-moon-500/10 border border-moon-500/30 rounded-xl p-4"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-moon-500/20 flex items-center justify-center">
                <RefreshCw class="w-4 h-4 text-moon-400 animate-spin" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium text-white">正在进行关联分析...</p>
                <div class="mt-2 h-1.5 bg-midnight-700 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-moon-500 to-moon-400 rounded-full animate-pulse" style={{ width: '65%' }} />
                </div>
              </div>
            </div>
          </Motion.div>
        )}

        {analysisStore.error && (
          <Motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            class="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                <AlertCircle class="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <p class="text-sm font-medium text-rose-400">分析失败</p>
                <p class="text-xs text-midnight-400 mt-0.5">{analysisStore.error}</p>
              </div>
            </div>
          </Motion.div>
        )}

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="显著相关性"
            value={stats().significantCount}
            subtitle="|r| ≥ 0.3 且统计显著"
            icon={BarChart3}
            color="moon"
          />
          <StatCard
            title="最高正相关"
            value={`${Math.round(stats().maxPositive * 100)}%`}
            subtitle="Pearson 相关系数"
            icon={TrendingUp}
            color="rose"
          />
          <StatCard
            title="最高负相关"
            value={`${Math.round(stats().maxNegative * 100)}%`}
            subtitle="Pearson 相关系数"
            icon={TrendingDown}
            color="blue"
          />
          <StatCard
            title="平均相关强度"
            value={`${Math.round(stats().avgStrength * 100)}%`}
            subtitle="绝对值平均"
            icon={Activity}
            color="mint"
          />
        </div>

        <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-lg font-semibold text-white font-display">相关性热力图</h3>
              <p class="text-sm text-midnight-400 mt-1">
                变量间 Pearson 相关系数矩阵可视化
              </p>
            </div>
            {analysisStore.lastAnalysisTime && (
              <div class="text-xs text-midnight-500">
                上次分析: {new Date(analysisStore.lastAnalysisTime).toLocaleString('zh-CN')}
              </div>
            )}
          </div>

          <CorrelationHeatmap
            data={analysisStore.correlationMatrix}
            height="450px"
          />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-lg font-semibold text-white font-display">敏感度评分</h3>
                <p class="text-sm text-midnight-400 mt-1">
                  环境参数对睡眠质量的影响程度
                </p>
              </div>
            </div>

            {sensitivityScoresList().length > 0 ? (
              <div class="space-y-4">
                <For each={sensitivityScoresList()}>
                  {(score, index) => (
                    <Motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index() * 0.1 }}
                      class="p-4 bg-midnight-800/40 rounded-xl border border-midnight-700/30"
                    >
                      <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-xl bg-moon-500/20 flex items-center justify-center">
                            {getTypeIcon(score.parameter.replace(/[A-Z].*/, ''))}
                          </div>
                          <div>
                            <p class="font-medium text-white">
                              {VARIABLE_LABELS[score.parameter] || score.parameter}
                            </p>
                            <p class="text-xs text-midnight-500">
                              单位: {score.unit}
                            </p>
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          {getDirectionIcon(score.direction)}
                          <span class={cn(
                            'text-lg font-bold font-display',
                            score.score >= 50 ? 'text-rose-400' :
                            score.score >= 30 ? 'text-amber-400' : 'text-mint-400'
                          )}>
                            {score.score.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div class="space-y-2">
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-midnight-400">敏感度</span>
                          <span class="text-midnight-300">{score.score.toFixed(0)}%</span>
                        </div>
                        <div class="h-2 bg-midnight-700/50 rounded-full overflow-hidden">
                          <div
                            class={cn(
                              'h-full rounded-full transition-all duration-500',
                              score.score >= 50 ? 'bg-gradient-to-r from-rose-500 to-rose-400' :
                              score.score >= 30 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                              'bg-gradient-to-r from-mint-500 to-mint-400'
                            )}
                            style={{ width: `${Math.min(100, score.score)}%` }}
                          />
                        </div>

                        <div class="flex items-center justify-between text-xs pt-1">
                          <span class="text-midnight-400">置信度</span>
                          <span class="text-midnight-300">{(score.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div class="h-1.5 bg-midnight-700/50 rounded-full overflow-hidden">
                          <div
                            class="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                            style={{ width: `${score.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </Motion.div>
                  )}
                </For>
              </div>
            ) : (
              <div class="py-12 text-center">
                <Brain class="w-12 h-12 text-midnight-600 mx-auto mb-3" />
                <p class="text-midnight-400">暂无敏感度数据</p>
                <p class="text-sm text-midnight-500 mt-1">点击"运行分析"开始计算</p>
              </div>
            )}
          </div>

          <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-lg font-semibold text-white font-display">优化建议</h3>
                <p class="text-sm text-midnight-400 mt-1">
                  基于数据分析的个性化睡眠环境优化方案
                </p>
              </div>
              {analysisStore.analysisResult && (
                <div class="flex items-center gap-1.5 px-3 py-1 bg-moon-500/20 rounded-full">
                  <span class="text-xs font-medium text-moon-400">
                    综合评分: {analysisStore.analysisResult.overallScore.toFixed(0)}
                  </span>
                </div>
              )}
            </div>

            {analysisStore.recommendations.length > 0 ? (
              <div class="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                <For each={analysisStore.recommendations}>
                  {(rec, index) => {
                    const priority = getPriorityColor(rec.priority);
                    const isExpanded = expandedRecommendations().has(rec.id);

                    return (
                      <Motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index() * 0.1 }}
                        class={cn(
                          'rounded-xl border overflow-hidden transition-all duration-300',
                          priority.bg,
                          priority.border
                        )}
                      >
                        <button
                          onClick={() => toggleRecommendation(rec.id)}
                          class="w-full p-4 flex items-start gap-3 text-left"
                        >
                          <div class={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                            priority.bg
                          )}>
                            <span class={priority.text}>{getTypeIcon(rec.type)}</span>
                          </div>

                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                              <span class="font-medium text-white">
                                {VARIABLE_LABELS[rec.parameter] || rec.parameter}
                              </span>
                              <span class={cn(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                priority.bg,
                                priority.text
                              )}>
                                {priority.label}优先级
                              </span>
                            </div>
                            <p class="text-sm text-midnight-300 line-clamp-2">
                              {rec.description}
                            </p>
                          </div>

                          <div class="flex-shrink-0 ml-2">
                            {isExpanded ? (
                              <ChevronUp class="w-5 h-5 text-midnight-400" />
                            ) : (
                              <ChevronDown class="w-5 h-5 text-midnight-400" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <Motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            class="border-t border-midnight-700/30 px-4 pb-4 pt-3"
                          >
                            <div class="grid grid-cols-2 gap-4 mb-4">
                              <div class="bg-midnight-800/50 rounded-lg p-3">
                                <p class="text-xs text-midnight-400 mb-1">当前值</p>
                                <p class="text-lg font-bold text-white font-display">
                                  {rec.currentValue.toFixed(1)}
                                  <span class="text-sm text-midnight-400 ml-1">
                                    {PARAMETER_UNITS[rec.parameter] || ''}
                                  </span>
                                </p>
                              </div>
                              <div class="bg-midnight-800/50 rounded-lg p-3">
                                <p class="text-xs text-midnight-400 mb-1">目标范围</p>
                                <p class="text-lg font-bold text-mint-400 font-display">
                                  {rec.targetRange[0]} - {rec.targetRange[1]}
                                  <span class="text-sm text-midnight-400 ml-1">
                                    {PARAMETER_UNITS[rec.parameter] || ''}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div class="flex items-center gap-4 text-sm">
                              <div class="flex items-center gap-2">
                                <TrendingUp class="w-4 h-4 text-mint-400" />
                                <span class="text-midnight-300">
                                  预计提升: <span class="text-mint-400 font-medium">{rec.expectedImprovement.toFixed(1)}%</span>
                                </span>
                              </div>
                              <div class="flex items-center gap-2">
                                <Target class="w-4 h-4 text-blue-400" />
                                <span class="text-midnight-300">
                                  置信度: <span class="text-blue-400 font-medium">{(rec.confidence * 100).toFixed(0)}%</span>
                                </span>
                              </div>
                            </div>

                            {rec.actionable && rec.type !== 'combined' && (
                              <div class="mt-4 pt-3 border-t border-midnight-700/30">
                                <div class="flex items-center gap-2 text-xs text-midnight-400">
                                  <ArrowRight class="w-3.5 h-3.5" />
                                  <span>
                                    {rec.currentValue < rec.targetRange[0]
                                      ? `建议将${VARIABLE_LABELS[rec.parameter] || rec.parameter}从 ${rec.currentValue.toFixed(1)} 提高到 ${rec.targetRange[0]} - ${rec.targetRange[1]} 范围`
                                      : rec.currentValue > rec.targetRange[1]
                                      ? `建议将${VARIABLE_LABELS[rec.parameter] || rec.parameter}从 ${rec.currentValue.toFixed(1)} 降低到 ${rec.targetRange[0]} - ${rec.targetRange[1]} 范围`
                                      : `${VARIABLE_LABELS[rec.parameter] || rec.parameter}已在最佳范围内，保持当前状态`
                                    }
                                  </span>
                                </div>
                              </div>
                            )}
                          </Motion.div>
                        )}
                      </Motion.div>
                    );
                  }}
                </For>
              </div>
            ) : (
              <div class="py-12 text-center">
                <Target class="w-12 h-12 text-midnight-600 mx-auto mb-3" />
                <p class="text-midnight-400">暂无优化建议</p>
                <p class="text-sm text-midnight-500 mt-1">完成分析后将显示个性化建议</p>
              </div>
            )}
          </div>
        </div>

        <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h3 class="text-lg font-semibold text-white font-display">相关系数详情</h3>
              <p class="text-sm text-midnight-400 mt-1">
                变量对之间的详细相关性统计
              </p>
            </div>
            <div class="flex items-center gap-3">
              <Toggle
                checked={showOnlySignificant()}
                onChange={setShowOnlySignificant}
                label="仅显示显著相关"
              />
            </div>
          </div>

          {displayCorrelations().length > 0 ? (
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-midnight-700/50">
                    <th class="text-left py-3 px-4 text-xs font-medium text-midnight-400 uppercase tracking-wider">
                      变量 X
                    </th>
                    <th class="text-center py-3 px-4 text-xs font-medium text-midnight-400 uppercase tracking-wider">
                      关系
                    </th>
                    <th class="text-left py-3 px-4 text-xs font-medium text-midnight-400 uppercase tracking-wider">
                      变量 Y
                    </th>
                    <th class="text-right py-3 px-4 text-xs font-medium text-midnight-400 uppercase tracking-wider">
                      Pearson 系数
                    </th>
                    <th class="text-right py-3 px-4 text-xs font-medium text-midnight-400 uppercase tracking-wider">
                      Spearman 系数
                    </th>
                    <th class="text-right py-3 px-4 text-xs font-medium text-midnight-400 uppercase tracking-wider">
                      P 值
                    </th>
                    <th class="text-right py-3 px-4 text-xs font-medium text-midnight-400 uppercase tracking-wider">
                      样本量
                    </th>
                    <th class="text-center py-3 px-4 text-xs font-medium text-midnight-400 uppercase tracking-wider">
                      显著性
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-midnight-700/30">
                  <For each={displayCorrelations()}>
                    {(corr, index) => (
                      <Motion.tr
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index() * 0.03 }}
                        class="hover:bg-midnight-800/30 transition-colors"
                      >
                        <td class="py-3 px-4">
                          <span class="text-sm font-medium text-white">
                            {VARIABLE_LABELS[corr.variableX] || corr.variableX}
                          </span>
                        </td>
                        <td class="py-3 px-4 text-center">
                          <ArrowRight class="w-4 h-4 text-midnight-500 mx-auto" />
                        </td>
                        <td class="py-3 px-4">
                          <span class="text-sm font-medium text-white">
                            {VARIABLE_LABELS[corr.variableY] || corr.variableY}
                          </span>
                        </td>
                        <td class="py-3 px-4 text-right">
                          <span class={cn(
                            'text-sm font-bold font-display',
                            getCorrelationColor(corr.pearson)
                          )}>
                            {(corr.pearson * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td class="py-3 px-4 text-right">
                          <span class={cn(
                            'text-sm font-medium',
                            getCorrelationColor(corr.spearman)
                          )}>
                            {(corr.spearman * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td class="py-3 px-4 text-right">
                          <span class={cn(
                            'text-sm',
                            corr.pValue < 0.01 ? 'text-mint-400 font-medium' :
                            corr.pValue < 0.05 ? 'text-amber-400' : 'text-midnight-400'
                          )}>
                            {corr.pValue < 0.001 ? '< 0.001' : corr.pValue.toFixed(3)}
                          </span>
                        </td>
                        <td class="py-3 px-4 text-right">
                          <span class="text-sm text-midnight-300">
                            {corr.sampleSize.toLocaleString()}
                          </span>
                        </td>
                        <td class="py-3 px-4 text-center">
                          {corr.significant ? (
                            <span class={cn(
                              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                              getCorrelationBg(corr.pearson),
                              'border'
                            )}>
                              <CheckCircle class="w-3 h-3" />
                              显著
                            </span>
                          ) : (
                            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-midnight-700/30 text-midnight-400 border border-midnight-600/30">
                              <X class="w-3 h-3" />
                              不显著
                            </span>
                          )}
                        </td>
                      </Motion.tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          ) : (
            <div class="py-12 text-center">
              <BarChart3 class="w-12 h-12 text-midnight-600 mx-auto mb-3" />
              <p class="text-midnight-400">暂无相关性数据</p>
              <p class="text-sm text-midnight-500 mt-1">运行分析后将显示详细的相关性统计</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Analysis;
