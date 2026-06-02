import { Component, createSignal, createEffect } from 'solid-js';
import { GlassCard } from '@/components/GlassCard';
import { ProgressRing } from '@/components/ProgressRing';
import { StatusIndicator } from '@/components/StatusIndicator';
import { LineChart } from '@/components/LineChart';
import type { RabiParams } from '@/types';
import { workerManager } from '@/utils/workerManager';
import { protocolSync } from '@/utils/protocolSync';

export const RabiOscillation: Component = () => {
  const [params, setParams] = createSignal<RabiParams>({
    omega: 2 * Math.PI,
    delta: 0,
    gamma: 0.1,
    duration: 5,
    samples: 200,
  });

  const [chartData, setChartData] = createSignal<{ x: string; y: number }[]>([]);
  const [isCalculating, setIsCalculating] = createSignal(false);
  const [syncStatus, setSyncStatus] = createSignal<'idle' | 'syncing' | 'success' | 'failed'>('idle');
  const [progress, setProgress] = createSignal(0);

  const calculateRabi = async () => {
    setIsCalculating(true);
    setProgress(0);

    try {
      const result = await workerManager.simulateRabi(params(), (p) => {
        setProgress(p);
      });
      
      setChartData(result.map(r => ({
        x: r.time.toFixed(2),
        y: r.probability,
      })));
    } catch (error) {
      console.error('Rabi calculation failed:', error);
    } finally {
      setIsCalculating(false);
      setProgress(100);
    }
  };

  const syncToHardware = async () => {
    setSyncStatus('syncing');
    try {
      const result = await protocolSync.syncRabiConfig(params());
      setSyncStatus(result.success ? 'success' : 'failed');
    } catch {
      setSyncStatus('failed');
    }
    setTimeout(() => setSyncStatus('idle'), 2000);
  };

  createEffect(() => {
    calculateRabi();
  });

  const updateParam = (key: keyof RabiParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div class="p-6 space-y-6 overflow-y-auto h-full">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-white neon-text">拉比振荡</h1>
          <p class="text-white/50 font-mono text-sm mt-1">配置并模拟拉比振荡概率模型</p>
        </div>
        <div class="flex items-center gap-3">
          <StatusIndicator 
            status={syncStatus() === 'syncing' ? 'syncing' : syncStatus() === 'success' ? 'online' : syncStatus() === 'failed' ? 'warning' : 'online'} 
            label={syncStatus() === 'syncing' ? '同步中...' : syncStatus() === 'success' ? '同步成功' : '协议就绪'}
          />
        </div>
      </div>

      <div class="grid grid-cols-3 gap-6">
        <div class="col-span-2">
          <GlassCard title="概率演化曲线" subtitle="|1⟩ 态概率随时间的变化">
            <LineChart 
              data={chartData()} 
              color="#00D4FF"
              height={300}
            />
          </GlassCard>
        </div>

        <div class="space-y-6">
          <GlassCard title="计算状态">
            <div class="flex items-center justify-center py-4">
              <ProgressRing 
                progress={isCalculating() ? progress() : 100}
                label={isCalculating() ? '计算中...' : '已完成'}
                color={isCalculating() ? '#00D4FF' : '#39FF14'}
              />
            </div>
            <div class="mt-4 space-y-2 text-center">
              <p class="text-xs text-white/50 font-mono">采样点数: {params().samples}</p>
              <p class="text-xs text-white/50 font-mono">时间范围: 0 ~ {params().duration} s</p>
            </div>
          </GlassCard>

          <GlassCard title="快速操作">
            <div class="space-y-3">
              <button 
                class="w-full btn-primary"
                onClick={calculateRabi}
                disabled={isCalculating()}
              >
                重新计算
              </button>
              <button 
                class="w-full btn-secondary"
                onClick={syncToHardware}
                disabled={syncStatus() === 'syncing'}
              >
                {syncStatus() === 'syncing' ? '同步中...' : '同步到硬件'}
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      <GlassCard title="参数配置" subtitle="调整拉比振荡模型参数">
        <div class="grid grid-cols-5 gap-6">
          <div class="space-y-3">
            <label class="block">
              <span class="text-sm text-white/70 font-mono">拉比频率 (Ω)</span>
              <input 
                type="range" 
                min="0.1" 
                max="10" 
                step="0.1"
                value={params().omega}
                onInput={(e) => updateParam('omega', parseFloat(e.currentTarget.value))}
                class="w-full mt-2 accent-quantum-cyan"
              />
            </label>
            <p class="text-quantum-cyan font-mono text-center">{params().omega.toFixed(2)} rad/s</p>
          </div>

          <div class="space-y-3">
            <label class="block">
              <span class="text-sm text-white/70 font-mono">失谐量 (Δ)</span>
              <input 
                type="range" 
                min="-5" 
                max="5" 
                step="0.1"
                value={params().delta}
                onInput={(e) => updateParam('delta', parseFloat(e.currentTarget.value))}
                class="w-full mt-2 accent-quantum-cyan"
              />
            </label>
            <p class="text-quantum-cyan font-mono text-center">{params().delta.toFixed(2)} rad/s</p>
          </div>

          <div class="space-y-3">
            <label class="block">
              <span class="text-sm text-white/70 font-mono">弛豫率 (γ)</span>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={params().gamma}
                onInput={(e) => updateParam('gamma', parseFloat(e.currentTarget.value))}
                class="w-full mt-2 accent-quantum-cyan"
              />
            </label>
            <p class="text-quantum-cyan font-mono text-center">{params().gamma.toFixed(3)} s⁻¹</p>
          </div>

          <div class="space-y-3">
            <label class="block">
              <span class="text-sm text-white/70 font-mono">持续时间</span>
              <input 
                type="range" 
                min="1" 
                max="20" 
                step="1"
                value={params().duration}
                onInput={(e) => updateParam('duration', parseFloat(e.currentTarget.value))}
                class="w-full mt-2 accent-quantum-cyan"
              />
            </label>
            <p class="text-quantum-cyan font-mono text-center">{params().duration} s</p>
          </div>

          <div class="space-y-3">
            <label class="block">
              <span class="text-sm text-white/70 font-mono">采样数</span>
              <input 
                type="range" 
                min="50" 
                max="500" 
                step="10"
                value={params().samples}
                onInput={(e) => updateParam('samples', parseInt(e.currentTarget.value))}
                class="w-full mt-2 accent-quantum-cyan"
              />
            </label>
            <p class="text-quantum-cyan font-mono text-center">{params().samples} 点</p>
          </div>
        </div>

        <div class="mt-6 p-4 bg-white/5 rounded-lg">
          <p class="text-xs text-white/50 font-mono mb-2">拉比振荡公式:</p>
          <p class="font-mono text-quantum-cyan text-sm">
            P(|1⟩) = e^(-γt) · (Ω² / Ω'²) · sin²(Ω't / 2)
          </p>
          <p class="text-xs text-white/40 font-mono mt-1">
            其中 Ω' = √(Ω² + Δ²)
          </p>
        </div>
      </GlassCard>
    </div>
  );
};
