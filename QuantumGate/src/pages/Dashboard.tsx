import { Component, onMount, onCleanup, For } from 'solid-js';
import { GlassCard } from '@/components/GlassCard';
import { MetricCard } from '@/components/MetricCard';
import { QubitStatus } from '@/components/QubitStatus';
import { StatusIndicator } from '@/components/StatusIndicator';
import { LineChart } from '@/components/LineChart';
import { appState, actions } from '@/store/appStore';
import { initDB } from '@/utils/db';

export const Dashboard: Component = () => {
  let simulationInterval: number | undefined;

  onMount(() => {
    initDB().catch(console.error);
    startSimulation();
  });

  onCleanup(() => {
    if (simulationInterval) {
      clearInterval(simulationInterval);
    }
  });

  const startSimulation = () => {
    simulationInterval = window.setInterval(() => {
      if (!appState.isSimulationRunning) return;

      appState.qubitStates.forEach((qubit, i) => {
        const newCoherence = Math.max(0.8, Math.min(1, qubit.coherence + (Math.random() - 0.5) * 0.02));
        const newProb0 = 0.5 + Math.sin(Date.now() / 1000 + i) * 0.45;
        
        actions.updateQubitState(i, {
          coherence: newCoherence,
          probability0: newProb0,
          probability1: 1 - newProb0,
          state: newProb0 > 0.9 ? '|0⟩' : newProb0 < 0.1 ? '|1⟩' : 'superposition',
        });
      });

      actions.addCoherenceData({
        timestamp: Date.now(),
        coherenceValue: 0.9 + Math.random() * 0.1,
        qubitId: 0,
        phaseNoise: Math.random() * 0.01,
        amplitude: 0.95 + Math.random() * 0.05,
      });

      actions.updateSystemStatus({
        laserPower: 80 + Math.random() * 20,
        chamberTemperature: 0.01 + Math.random() * 0.005,
        uptime: appState.systemStatus.uptime + 0.1,
      });
    }, 500);
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const chartData = () => appState.coherenceData.slice(-50).map(d => ({
    x: new Date(d.timestamp).toLocaleTimeString(),
    y: d.coherenceValue,
  }));

  return (
    <div class="p-6 space-y-6 overflow-y-auto h-full">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-white neon-text">监控仪表盘</h1>
          <p class="text-white/50 font-mono text-sm mt-1">实时监控量子系统状态与激光相干性</p>
        </div>
        <div class="flex items-center gap-4">
          <StatusIndicator 
            status={appState.systemStatus.connectionStatus === 'connected' ? 'online' : 'offline'} 
            label="硬件连接"
          />
          <button 
            class={`px-4 py-2 rounded-md font-mono text-sm transition-all ${
              appState.isSimulationRunning 
                ? 'bg-quantum-green/20 text-quantum-green border border-quantum-green/50' 
                : 'bg-white/5 text-white/60 border border-white/20'
            }`}
            onClick={actions.toggleSimulation}
          >
            {appState.isSimulationRunning ? '● 模拟运行中' : '○ 模拟已暂停'}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-4">
        <MetricCard 
          title="激光功率" 
          value={appState.systemStatus.laserPower.toFixed(1)} 
          unit="mW"
          icon="💡"
          color="cyan"
          trend={2.3}
        />
        <MetricCard 
          title="腔体温度" 
          value={(appState.systemStatus.chamberTemperature * 1000).toFixed(2)} 
          unit="mK"
          icon="❄️"
          color="blue"
          trend={-1.5}
        />
        <MetricCard 
          title="活跃量子比特" 
          value={`${appState.systemStatus.activeQubits}/${appState.systemStatus.qubitCount}`}
          icon="⚛️"
          color="purple"
        />
        <MetricCard 
          title="运行时间" 
          value={formatUptime(appState.systemStatus.uptime)}
          icon="⏱️"
          color="green"
        />
      </div>

      <div class="grid grid-cols-3 gap-6">
        <div class="col-span-2">
          <GlassCard title="激光相干性演变" subtitle="实时监控相干性数值变化">
            <LineChart 
              data={chartData()} 
              color="#00D4FF"
              height={250}
            />
          </GlassCard>
        </div>

        <div>
          <GlassCard title="系统状态" subtitle="关键指标概览">
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <span class="text-sm text-white/60 font-mono">真空压力</span>
                <span class="text-quantum-cyan font-mono text-sm">1.2 × 10⁻¹¹ Torr</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-white/60 font-mono">磁场稳定性</span>
                <span class="text-quantum-green font-mono text-sm">99.97%</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-white/60 font-mono">相位噪声</span>
                <span class="text-quantum-cyan font-mono text-sm">-112 dBc/Hz</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-white/60 font-mono">门保真度</span>
                <span class="text-quantum-green font-mono text-sm">99.8%</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-white/60 font-mono">读取误差</span>
                <span class="text-quantum-orange font-mono text-sm">0.35%</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-white/60 font-mono">最后同步</span>
                <span class="text-white/70 font-mono text-sm">
                  {appState.systemStatus.lastSync ? new Date(appState.systemStatus.lastSync).toLocaleTimeString() : '--'}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <div>
        <h2 class="text-lg font-display font-semibold text-white mb-4">量子比特状态</h2>
        <div class="grid grid-cols-4 gap-4">
          <For each={appState.qubitStates}>
            {(qubit) => (
              <QubitStatus 
                qubit={qubit} 
                selected={appState.selectedQubit === qubit.id}
                onClick={() => actions.setSelectedQubit(qubit.id === appState.selectedQubit ? null : qubit.id)}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
};
