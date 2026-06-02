import { Component, createSignal, createEffect } from 'solid-js';
import { GlassCard } from '@/components/GlassCard';
import { StatusIndicator } from '@/components/StatusIndicator';
import { protocolSync } from '@/utils/protocolSync';
import { clearOldData } from '@/utils/db';

export const Settings: Component = () => {
  const [hardwareEndpoint, setHardwareEndpoint] = createSignal('ws://localhost:8080/quantum');
  const [autoSync, setAutoSync] = createSignal(true);
  const [syncInterval, setSyncInterval] = createSignal(5000);
  const [mockLatency, setMockLatency] = createSignal(150);
  const [mockErrorRate, setMockErrorRate] = createSignal(0.05);
  const [connectionStatus, setConnectionStatus] = createSignal<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [isClearing, setIsClearing] = createSignal(false);

  createEffect(() => {
    protocolSync.setMockLatency(mockLatency());
    protocolSync.setMockErrorRate(mockErrorRate());
  });

  const connect = async () => {
    setConnectionStatus('connecting');
    try {
      const success = await protocolSync.connect(hardwareEndpoint());
      setConnectionStatus(success ? 'connected' : 'disconnected');
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  const disconnect = () => {
    protocolSync.disconnect();
    setConnectionStatus('disconnected');
  };

  const clearDatabase = async () => {
    if (!confirm('确定要清除所有历史数据吗？此操作不可撤销。')) return;
    
    setIsClearing(true);
    try {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      await clearOldData(oneWeekAgo);
      alert('数据清除成功');
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('数据清除失败');
    } finally {
      setIsClearing(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('quantum-gate-settings', JSON.stringify({
      hardwareEndpoint: hardwareEndpoint(),
      autoSync: autoSync(),
      syncInterval: syncInterval(),
      mockLatency: mockLatency(),
      mockErrorRate: mockErrorRate(),
    }));
    alert('设置已保存');
  };

  const loadSettings = () => {
    const saved = localStorage.getItem('quantum-gate-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      setHardwareEndpoint(settings.hardwareEndpoint);
      setAutoSync(settings.autoSync);
      setSyncInterval(settings.syncInterval);
      setMockLatency(settings.mockLatency);
      setMockErrorRate(settings.mockErrorRate);
    }
  };

  createEffect(() => {
    loadSettings();
  });

  return (
    <div class="p-6 space-y-6 overflow-y-auto h-full">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-white neon-text">系统设置</h1>
          <p class="text-white/50 font-mono text-sm mt-1">配置硬件连接与系统参数</p>
        </div>
        <button class="btn-primary" onClick={saveSettings}>
          保存设置
        </button>
      </div>

      <div class="grid grid-cols-2 gap-6">
        <GlassCard title="硬件连接配置" subtitle="配置物理底层模块连接参数">
          <div class="space-y-6">
            <div>
              <label class="block text-sm text-white/70 font-mono mb-2">硬件端点地址</label>
              <input 
                type="text" 
                value={hardwareEndpoint()}
                onInput={(e) => setHardwareEndpoint(e.currentTarget.value)}
                class="input-field font-mono"
                placeholder="ws://localhost:8080/quantum"
              />
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-white/70 font-mono">连接状态</p>
                <p class="text-xs text-white/50 font-mono mt-1">当前与物理底层模块的连接状态</p>
              </div>
              <div class="flex items-center gap-3">
                <StatusIndicator 
                  status={connectionStatus() === 'connected' ? 'online' : connectionStatus() === 'connecting' ? 'syncing' : 'offline'}
                  label={connectionStatus() === 'connected' ? '已连接' : connectionStatus() === 'connecting' ? '连接中' : '未连接'}
                />
              </div>
            </div>

            <div class="flex gap-3">
              <button 
                class="flex-1 btn-primary"
                onClick={connect}
                disabled={connectionStatus() !== 'disconnected'}
              >
                连接
              </button>
              <button 
                class="flex-1 btn-secondary"
                onClick={disconnect}
                disabled={connectionStatus() === 'disconnected'}
              >
                断开
              </button>
            </div>

            <div class="pt-4 border-t border-white/10">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-white/70 font-mono">自动同步</p>
                  <p class="text-xs text-white/50 font-mono mt-1">自动同步数据到硬件模块</p>
                </div>
                <button 
                  class={`w-12 h-6 rounded-full transition-colors ${
                    autoSync() ? 'bg-quantum-cyan' : 'bg-white/20'
                  }`}
                  onClick={() => setAutoSync(!autoSync())}
                >
                  <div 
                    class={`w-5 h-5 rounded-full bg-white shadow-lg transform transition-transform ${
                      autoSync() ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {autoSync() && (
              <div>
                <div class="flex justify-between mb-2">
                  <label class="text-sm text-white/70 font-mono">同步间隔</label>
                  <span class="text-quantum-cyan font-mono">{syncInterval()} ms</span>
                </div>
                <input 
                  type="range" 
                  min="1000" 
                  max="30000" 
                  step="1000"
                  value={syncInterval()}
                  onInput={(e) => setSyncInterval(parseInt(e.currentTarget.value))}
                  class="w-full accent-quantum-cyan"
                />
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard title="模拟参数配置" subtitle="调整模拟环境的参数设置">
          <div class="space-y-6">
            <div>
              <div class="flex justify-between mb-2">
                <label class="text-sm text-white/70 font-mono">模拟延迟</label>
                <span class="text-quantum-cyan font-mono">{mockLatency()} ms</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1000" 
                step="10"
                value={mockLatency()}
                onInput={(e) => setMockLatency(parseInt(e.currentTarget.value))}
                class="w-full accent-quantum-cyan"
              />
              <p class="text-xs text-white/40 font-mono mt-2">
                模拟硬件通信延迟，用于测试异步处理
              </p>
            </div>

            <div>
              <div class="flex justify-between mb-2">
                <label class="text-sm text-white/70 font-mono">模拟错误率</label>
                <span class="text-quantum-cyan font-mono">{(mockErrorRate() * 100).toFixed(1)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="0.5" 
                step="0.01"
                value={mockErrorRate()}
                onInput={(e) => setMockErrorRate(parseFloat(e.currentTarget.value))}
                class="w-full accent-quantum-cyan"
              />
              <p class="text-xs text-white/40 font-mono mt-2">
                模拟通信错误概率，用于测试错误处理
              </p>
            </div>

            <div class="p-4 bg-quantum-cyan/10 border border-quantum-cyan/30 rounded-lg">
              <p class="text-sm text-quantum-cyan font-mono">💡 提示</p>
              <p class="text-xs text-white/60 font-mono mt-1">
                当前设置模拟了真实硬件环境的延迟和不稳定性。在生产环境中，这些值应设为 0 以使用真实硬件数据。
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard title="数据管理" subtitle="管理 IndexedDB 存储的数据">
          <div class="space-y-6">
            <div>
              <p class="text-sm text-white/70 font-mono mb-2">清除历史数据</p>
              <p class="text-xs text-white/50 font-mono mb-4">
                清除一周前的所有历史数据，释放存储空间
              </p>
              <button 
                class="btn-secondary text-quantum-orange border-quantum-orange/30 hover:bg-quantum-orange/10"
                onClick={clearDatabase}
                disabled={isClearing()}
              >
                {isClearing() ? '清除中...' : '清除旧数据'}
              </button>
            </div>

            <div class="pt-4 border-t border-white/10">
              <p class="text-sm text-white/70 font-mono mb-2">重置数据库</p>
              <p class="text-xs text-white/50 font-mono mb-4">
                警告：这将删除所有数据，包括当前会话的数据
              </p>
              <button class="btn-secondary text-red-400 border-red-400/30 hover:bg-red-400/10">
                重置所有数据
              </button>
            </div>
          </div>
        </GlassCard>

        <GlassCard title="系统信息" subtitle="关于 QuantumGate 监控系统">
          <div class="space-y-4">
            <div class="flex justify-between">
              <span class="text-white/50 font-mono text-sm">版本</span>
              <span class="text-white font-mono text-sm">1.0.0</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/50 font-mono text-sm">构建日期</span>
              <span class="text-white font-mono text-sm">2024-01-15</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/50 font-mono text-sm">框架</span>
              <span class="text-white font-mono text-sm">SolidJS 1.8</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/50 font-mono text-sm">存储引擎</span>
              <span class="text-white font-mono text-sm">IndexedDB</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/50 font-mono text-sm">计算引擎</span>
              <span class="text-white font-mono text-sm">Web Worker</span>
            </div>

            <div class="pt-4 border-t border-white/10">
              <p class="text-xs text-white/40 font-mono">
                QuantumGate 是一个用于监控离子阱量子计算机激光相干性演变的专业系统。
                实现了拉比振荡概率模型、量子逻辑门保真度计算、以及万次量子纠错循环的校验子存储。
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
