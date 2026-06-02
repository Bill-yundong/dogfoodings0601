import { Component, createSignal, createEffect, For } from 'solid-js';
import { GlassCard } from '@/components/GlassCard';
import { MetricCard } from '@/components/MetricCard';
import { ProgressRing } from '@/components/ProgressRing';
import type { SyndromeSnapshot } from '@/types';
import { workerManager } from '@/utils/workerManager';
import { getDBStats, getRecentSyndromeSnapshots } from '@/utils/db';

export const ErrorCorrection: Component = () => {
  const [snapshots, setSnapshots] = createSignal<SyndromeSnapshot[]>([]);
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [cycleCount, setCycleCount] = createSignal(100);
  const [dbStats, setDbStats] = createSignal<{
    laserCoherence: number;
    rabiOscillation: number;
    fidelityResults: number;
    syndromeSnapshots: number;
    protocolSync: number;
  } | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = createSignal<SyndromeSnapshot | null>(null);

  const loadData = async () => {
    try {
      const [stats, recent] = await Promise.all([
        getDBStats(),
        getRecentSyndromeSnapshots(50),
      ]);
      setDbStats(stats);
      setSnapshots(recent);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const generateSnapshots = async () => {
    setIsGenerating(true);
    setProgress(0);

    try {
      const result = await workerManager.generateSyndromeSnapshots(
        cycleCount(),
        (p) => setProgress(p)
      );
      setSnapshots(prev => [...result, ...prev].slice(0, 100));
      await loadData();
    } catch (error) {
      console.error('Failed to generate snapshots:', error);
    } finally {
      setIsGenerating(false);
      setProgress(100);
    }
  };

  const correctionRate = () => {
    if (snapshots().length === 0) return 0;
    const success = snapshots().filter(s => s.correctionResult === 'success').length;
    return success / snapshots().length;
  };

  createEffect(() => {
    loadData();
  });

  const getResultColor = (result: string) => {
    switch (result) {
      case 'success': return 'text-quantum-green';
      case 'partial': return 'text-quantum-orange';
      case 'failed': return 'text-red-500';
      default: return 'text-white/70';
    }
  };

  return (
    <div class="p-6 space-y-6 overflow-y-auto h-full">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-white neon-text">量子纠错</h1>
          <p class="text-white/50 font-mono text-sm mt-1">IndexedDB 存储校验子快照，支持万次纠错循环</p>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-sm text-white/60 font-mono">循环次数:</span>
            <input 
              type="number" 
              min="10" 
              max="10000" 
              value={cycleCount()}
              onInput={(e) => setCycleCount(parseInt(e.currentTarget.value) || 100)}
              class="w-24 input-field text-sm"
            />
          </div>
          <button 
            class="btn-primary"
            onClick={generateSnapshots}
            disabled={isGenerating()}
          >
            {isGenerating() ? '生成中...' : '生成纠错循环'}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-5 gap-4">
        <MetricCard 
          title="总快照数" 
          value={dbStats()?.syndromeSnapshots.toLocaleString() || '--'}
          icon="💾"
          color="cyan"
        />
        <MetricCard 
          title="纠错成功率" 
          value={(correctionRate() * 100).toFixed(1)} 
          unit="%"
          icon="✅"
          color="green"
        />
        <MetricCard 
          title="平均错误率" 
          value={snapshots().length > 0 
            ? (snapshots().reduce((s, r) => s + r.errorProbability, 0) / snapshots().length * 100).toFixed(2) 
            : '--'
          }
          unit="%"
          icon="📊"
          color="orange"
        />
        <MetricCard 
          title="保真度记录" 
          value={dbStats()?.fidelityResults.toLocaleString() || '--'}
          icon="🎯"
          color="purple"
        />
        <MetricCard 
          title="协议同步记录" 
          value={dbStats()?.protocolSync.toLocaleString() || '--'}
          icon="🔄"
          color="blue"
        />
      </div>

      <div class="grid grid-cols-3 gap-6">
        <div class="col-span-2">
          <GlassCard title="校验子快照" subtitle="最近的量子纠错循环记录">
            <div class="max-h-96 overflow-y-auto">
              <table class="w-full text-sm font-mono">
                <thead class="sticky top-0 bg-quantum-blue/90 backdrop-blur">
                  <tr class="text-white/50 border-b border-white/10">
                    <th class="text-left py-3 px-2">循环 #</th>
                    <th class="text-left py-3 px-2">结果</th>
                    <th class="text-left py-3 px-2">错误概率</th>
                    <th class="text-left py-3 px-2">量子比特状态</th>
                    <th class="text-left py-3 px-2">时间</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={snapshots().slice(0, 30)}>
                    {(snapshot) => (
                      <tr 
                        class={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${
                          selectedSnapshot()?.cycleNumber === snapshot.cycleNumber ? 'bg-quantum-cyan/10' : ''
                        }`}
                        onClick={() => setSelectedSnapshot(snapshot)}
                      >
                        <td class="py-2 px-2 text-white/70">{snapshot.cycleNumber}</td>
                        <td class={`py-2 px-2 ${getResultColor(snapshot.correctionResult)}`}>
                          {snapshot.correctionResult === 'success' ? '成功' : 
                           snapshot.correctionResult === 'partial' ? '部分' : '失败'}
                        </td>
                        <td class="py-2 px-2 text-quantum-orange">
                          {(snapshot.errorProbability * 100).toFixed(1)}%
                        </td>
                        <td class="py-2 px-2">
                          <div class="flex gap-1">
                            <For each={snapshot.qubitStates}>
                              {(state) => (
                                <span class={`w-4 h-4 rounded text-xs flex items-center justify-center ${
                                  state === 1 ? 'bg-quantum-orange/50 text-quantum-orange' : 'bg-quantum-cyan/50 text-quantum-cyan'
                                }`}>
                                  {state}
                                </span>
                              )}
                            </For>
                          </div>
                        </td>
                        <td class="py-2 px-2 text-white/50">
                          {new Date(snapshot.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        <div class="space-y-6">
          <GlassCard title="生成进度">
            <div class="flex items-center justify-center py-4">
              <ProgressRing 
                progress={isGenerating() ? progress() : 100}
                label={isGenerating() ? '生成中...' : '就绪'}
                color={isGenerating() ? '#00D4FF' : '#39FF14'}
              />
            </div>
            <div class="mt-4 text-center text-xs font-mono text-white/50">
              <p>将生成 {cycleCount()} 个校验子快照</p>
              <p>每个快照包含 8 个量子比特状态</p>
            </div>
          </GlassCard>

          <GlassCard title="校验子矩阵" subtitle="选中循环的错误模式">
            {selectedSnapshot() ? (
              <div class="space-y-4">
                <div class="flex justify-center">
                  <div class="grid gap-1" style={{ 'grid-template-columns': `repeat(${selectedSnapshot()!.syndromeData[0]?.length || 5}, 1fr)` }}>
                    <For each={selectedSnapshot()!.syndromeData}>
                      {(row) => (
                        <For each={row}>
                          {(cell) => (
                            <div 
                              class={`w-8 h-8 rounded flex items-center justify-center text-xs font-mono transition-all ${
                                cell === 1 
                                  ? 'bg-quantum-orange text-white shadow-lg shadow-quantum-orange/30' 
                                  : 'bg-white/5 text-white/30'
                              }`}
                            >
                              {cell}
                            </div>
                          )}
                        </For>
                      )}
                    </For>
                  </div>
                </div>
                <div class="text-center">
                  <p class="text-xs text-white/50 font-mono">
                    循环 #{selectedSnapshot()!.cycleNumber} - {
                      selectedSnapshot()!.correctionResult === 'success' ? '纠错成功' :
                      selectedSnapshot()!.correctionResult === 'partial' ? '部分纠错' : '纠错失败'
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div class="py-8 text-center text-white/30 text-sm">
                点击左侧列表查看校验子矩阵
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      <GlassCard title="数据库状态" subtitle="IndexedDB 存储统计">
        <div class="grid grid-cols-5 gap-4">
          <div class="p-4 bg-white/5 rounded-lg">
            <p class="text-xs text-white/50 font-mono mb-1">激光相干性数据</p>
            <p class="text-xl font-display font-bold text-quantum-cyan">
              {dbStats()?.laserCoherence.toLocaleString() || 0}
            </p>
          </div>
          <div class="p-4 bg-white/5 rounded-lg">
            <p class="text-xs text-white/50 font-mono mb-1">拉比振荡记录</p>
            <p class="text-xl font-display font-bold text-quantum-cyan">
              {dbStats()?.rabiOscillation.toLocaleString() || 0}
            </p>
          </div>
          <div class="p-4 bg-white/5 rounded-lg">
            <p class="text-xs text-white/50 font-mono mb-1">保真度结果</p>
            <p class="text-xl font-display font-bold text-quantum-cyan">
              {dbStats()?.fidelityResults.toLocaleString() || 0}
            </p>
          </div>
          <div class="p-4 bg-white/5 rounded-lg">
            <p class="text-xs text-white/50 font-mono mb-1">校验子快照</p>
            <p class="text-xl font-display font-bold text-quantum-cyan">
              {dbStats()?.syndromeSnapshots.toLocaleString() || 0}
            </p>
          </div>
          <div class="p-4 bg-white/5 rounded-lg">
            <p class="text-xs text-white/50 font-mono mb-1">协议同步记录</p>
            <p class="text-xl font-display font-bold text-quantum-cyan">
              {dbStats()?.protocolSync.toLocaleString() || 0}
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
