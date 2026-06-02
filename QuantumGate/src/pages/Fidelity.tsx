import { Component, createSignal, For } from 'solid-js';
import { GlassCard } from '@/components/GlassCard';
import { ProgressRing } from '@/components/ProgressRing';
import { MetricCard } from '@/components/MetricCard';
import type { QuantumGateType, GateParams, FidelityResult } from '@/types';
import { workerManager } from '@/utils/workerManager';

const GATES: QuantumGateType[] = ['X', 'Y', 'Z', 'H', 'S', 'T', 'Rx', 'Ry', 'Rz', 'CNOT'];

const gateDescriptions: Record<QuantumGateType, string> = {
  X: '泡利 X 门 (NOT)',
  Y: '泡利 Y 门',
  Z: '泡利 Z 门',
  H: '阿达马门',
  S: '相位门',
  T: 'π/8 门',
  Rx: 'X 轴旋转门',
  Ry: 'Y 轴旋转门',
  Rz: 'Z 轴旋转门',
  CNOT: '受控非门',
};

export const Fidelity: Component = () => {
  const [selectedGate, setSelectedGate] = createSignal<QuantumGateType>('H');
  const [iterations, setIterations] = createSignal(1000);
  const [noiseLevel, setNoiseLevel] = createSignal(0.01);
  const [decoherenceRate, setDecoherenceRate] = createSignal(0.001);
  const [isCalculating, setIsCalculating] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [results, setResults] = createSignal<FidelityResult[]>([]);
  const [currentResult, setCurrentResult] = createSignal<FidelityResult | null>(null);

  const calculateFidelity = async () => {
    setIsCalculating(true);
    setProgress(0);

    const params: GateParams = {
      theta: Math.PI / 4,
      noiseLevel: noiseLevel(),
      decoherenceRate: decoherenceRate(),
    };

    try {
      const result = await workerManager.calculateFidelity(
        selectedGate(),
        params,
        iterations(),
        (p) => setProgress(p)
      );

      setCurrentResult(result);
      setResults(prev => [result, ...prev].slice(0, 10));
    } catch (error) {
      console.error('Fidelity calculation failed:', error);
    } finally {
      setIsCalculating(false);
      setProgress(100);
    }
  };

  const avgFidelity = () => {
    if (results().length === 0) return 0;
    return results().reduce((sum, r) => sum + r.fidelity, 0) / results().length;
  };

  return (
    <div class="p-6 space-y-6 overflow-y-auto h-full">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-white neon-text">保真度计算</h1>
          <p class="text-white/50 font-mono text-sm mt-1">Web Worker 异步计算量子逻辑门保真度</p>
        </div>
        <button 
          class="btn-primary"
          onClick={calculateFidelity}
          disabled={isCalculating()}
        >
          {isCalculating() ? '计算中...' : '开始计算'}
        </button>
      </div>

      <div class="grid grid-cols-4 gap-4">
        <MetricCard 
          title="当前保真度" 
          value={currentResult() ? (currentResult()!.fidelity * 100).toFixed(2) : '--'}
          unit="%"
          icon="🎯"
          color="green"
        />
        <MetricCard 
          title="平均保真度" 
          value={(avgFidelity() * 100).toFixed(2)} 
          unit="%"
          icon="📊"
          color="cyan"
        />
        <MetricCard 
          title="误差率" 
          value={currentResult() ? (currentResult()!.errorRate * 100).toFixed(3) : '--'}
          unit="%"
          icon="⚠️"
          color="orange"
        />
        <MetricCard 
          title="计算耗时" 
          value={currentResult() ? currentResult()!.computeTime.toFixed(2) : '--'}
          unit="ms"
          icon="⏱️"
          color="purple"
        />
      </div>

      <div class="grid grid-cols-3 gap-6">
        <div>
          <GlassCard title="量子门选择">
            <div class="grid grid-cols-2 gap-2">
              <For each={GATES}>
                {(gate) => (
                  <button
                    class={`
                      p-3 rounded-lg text-center transition-all duration-300 font-mono
                      ${selectedGate() === gate 
                        ? 'bg-quantum-cyan/20 text-quantum-cyan border border-quantum-cyan/50' 
                        : 'bg-white/5 text-white/70 border border-white/10 hover:border-white/20'
                      }
                    `}
                    onClick={() => setSelectedGate(gate)}
                  >
                    <div class="text-lg font-bold">{gate}</div>
                  </button>
                )}
              </For>
            </div>
            <div class="mt-4 p-3 bg-white/5 rounded-lg">
              <p class="text-xs text-white/50 font-mono">当前选择</p>
              <p class="text-quantum-cyan font-mono">{selectedGate()} - {gateDescriptions[selectedGate()]}</p>
            </div>
          </GlassCard>
        </div>

        <div>
          <GlassCard title="参数配置">
            <div class="space-y-6">
              <div>
                <div class="flex justify-between mb-2">
                  <label class="text-sm text-white/70 font-mono">迭代次数</label>
                  <span class="text-quantum-cyan font-mono">{iterations()}</span>
                </div>
                <input 
                  type="range" 
                  min="100" 
                  max="10000" 
                  step="100"
                  value={iterations()}
                  onInput={(e) => setIterations(parseInt(e.currentTarget.value))}
                  class="w-full accent-quantum-cyan"
                />
              </div>

              <div>
                <div class="flex justify-between mb-2">
                  <label class="text-sm text-white/70 font-mono">噪声水平</label>
                  <span class="text-quantum-cyan font-mono">{(noiseLevel() * 100).toFixed(1)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="0.1" 
                  step="0.001"
                  value={noiseLevel()}
                  onInput={(e) => setNoiseLevel(parseFloat(e.currentTarget.value))}
                  class="w-full accent-quantum-cyan"
                />
              </div>

              <div>
                <div class="flex justify-between mb-2">
                  <label class="text-sm text-white/70 font-mono">退相干率</label>
                  <span class="text-quantum-cyan font-mono">{(decoherenceRate() * 1000).toFixed(1)}‰</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="0.01" 
                  step="0.0001"
                  value={decoherenceRate()}
                  onInput={(e) => setDecoherenceRate(parseFloat(e.currentTarget.value))}
                  class="w-full accent-quantum-cyan"
                />
              </div>
            </div>
          </GlassCard>
        </div>

        <div>
          <GlassCard title="计算进度">
            <div class="flex items-center justify-center py-6">
              <ProgressRing 
                progress={isCalculating() ? progress() : 100}
                label={isCalculating() ? '计算中...' : '就绪'}
                color={isCalculating() ? '#00D4FF' : '#39FF14'}
              />
            </div>
            <div class="mt-4 space-y-2 text-center text-xs font-mono text-white/50">
              <p>Worker: {workerManager.getActiveTaskCount()} 活跃任务</p>
              <p>已完成计算: {results().length} 次</p>
            </div>
          </GlassCard>
        </div>
      </div>

      <GlassCard title="历史结果" subtitle="最近 10 次保真度计算记录">
        <div class="overflow-x-auto">
          <table class="w-full text-sm font-mono">
            <thead>
              <tr class="text-white/50 border-b border-white/10">
                <th class="text-left py-3 px-2">量子门</th>
                <th class="text-left py-3 px-2">保真度</th>
                <th class="text-left py-3 px-2">误差率</th>
                <th class="text-left py-3 px-2">迭代次数</th>
                <th class="text-left py-3 px-2">耗时</th>
                <th class="text-left py-3 px-2">时间</th>
              </tr>
            </thead>
            <tbody>
              <For each={results()}>
                {(result) => (
                  <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="py-3 px-2 text-quantum-cyan">{result.gateType}</td>
                    <td class="py-3 px-2 text-quantum-green">{(result.fidelity * 100).toFixed(2)}%</td>
                    <td class="py-3 px-2 text-quantum-orange">{(result.errorRate * 100).toFixed(3)}%</td>
                    <td class="py-3 px-2 text-white/70">{result.iterations}</td>
                    <td class="py-3 px-2 text-white/70">{result.computeTime.toFixed(2)} ms</td>
                    <td class="py-3 px-2 text-white/50">{new Date(result.timestamp).toLocaleTimeString()}</td>
                  </tr>
                )}
              </For>
              {results().length === 0 && (
                <tr>
                  <td colspan="6" class="py-8 text-center text-white/30">
                    暂无计算记录，点击"开始计算"运行保真度计算
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
