import { Component, createSignal, For, onMount } from 'solid-js';
import { Motion } from '@motionone/solid';
import {
  RefreshCw,
  Plus,
  Wifi,
  WifiOff,
  AlertTriangle,
  Cpu,
  Settings,
  Bell,
  Zap,
  Power,
  RotateCcw,
  Send,
  Clock,
  Thermometer,
  Volume2,
  Droplets,
  Sun,
  Gauge,
  ArrowRight,
} from 'lucide-solid';
import { MainLayout } from '@/components/layout';
import { DeviceCard, StatCard } from '@/components/cards';
import { Button, Toggle } from '@/components/controls';
import { devicesStore, devicesActions } from '@/stores/devices';
import { configActions } from '@/stores/config';
import type { Device, DeviceCommand } from '@/types/device';
import { DEVICE_STATUS_LABELS, DEVICE_STATUS_COLORS } from '@/types/device';
import { cn } from '@/lib/utils';

const Devices: Component = () => {
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [commandInput, setCommandInput] = createSignal('');
  const [parameterInput, setParameterInput] = createSignal('');
  const [valueInput, setValueInput] = createSignal('');

  const userId = 'user-001';

  onMount(async () => {
    await configActions.loadConfig();
    await devicesActions.loadDevices(userId);
  });

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await devicesActions.loadDevices(userId);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshDevice = async (deviceId: string) => {
    await devicesActions.refreshDevice(deviceId);
  };

  const handleSelectDevice = (device: Device) => {
    devicesActions.selectDevice(device.id);
  };

  const handleConfigureDevice = (device: Device) => {
    devicesActions.selectDevice(device.id);
  };

  const handleToggleAlert = (alertId: string, enabled: boolean) => {
    const selectedDevice = devicesActions.getSelectedDevice();
    if (!selectedDevice) return;

    const config = devicesActions.getDeviceConfig(selectedDevice.id);
    if (!config) return;

    const updatedAlerts = config.thresholdAlerts.map(alert =>
      alert.id === alertId ? { ...alert, enabled } : alert
    );

    devicesActions.updateDeviceConfig(selectedDevice.id, {
      thresholdAlerts: updatedAlerts,
    });
  };

  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    const selectedDevice = devicesActions.getSelectedDevice();
    if (!selectedDevice) return;

    const config = devicesActions.getDeviceConfig(selectedDevice.id);
    if (!config) return;

    const updatedRules = config.autoControlRules.map(rule =>
      rule.id === ruleId ? { ...rule, enabled } : rule
    );

    devicesActions.updateDeviceConfig(selectedDevice.id, {
      autoControlRules: updatedRules,
    });
  };

  const handleSendCommand = async () => {
    const selectedDevice = devicesActions.getSelectedDevice();
    if (!selectedDevice || !commandInput()) return;

    const command: DeviceCommand = {
      deviceId: selectedDevice.id,
      command: commandInput() as DeviceCommand['command'],
      parameter: parameterInput() || undefined,
      value: valueInput() ? parseFloat(valueInput()) : undefined,
      timestamp: Date.now(),
    };

    devicesActions.sendCommand(command);
    setCommandInput('');
    setParameterInput('');
    setValueInput('');
  };

  const handleQuickCommand = (commandType: DeviceCommand['command']) => {
    const selectedDevice = devicesActions.getSelectedDevice();
    if (!selectedDevice) return;

    const command: DeviceCommand = {
      deviceId: selectedDevice.id,
      command: commandType,
      timestamp: Date.now(),
    };

    devicesActions.sendCommand(command);
  };

  const onlineCount = () => devicesStore.devices.filter(d => d.status === 'online').length;
  const offlineCount = () => devicesStore.devices.filter(d => d.status === 'offline').length;
  const warningCount = () => devicesStore.devices.filter(d => d.status === 'warning' || d.status === 'error').length;
  const totalCount = () => devicesStore.devices.length;

  const selectedDevice = () => devicesActions.getSelectedDevice();
  const selectedConfig = () => {
    const device = selectedDevice();
    return device ? devicesActions.getDeviceConfig(device.id) : undefined;
  };

  const formatLastOnline = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    return `${days} 天前`;
  };

  const parameterIcons: Record<string, Component<{ class?: string }>> = {
    lightLux: Sun,
    temperatureC: Thermometer,
    noiseDb: Volume2,
    humidity: Droplets,
  };

  const parameterLabels: Record<string, string> = {
    lightLux: '光照强度',
    temperatureC: '温度',
    noiseDb: '噪音',
    humidity: '湿度',
  };

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
              设备管理
            </Motion.h1>
            <Motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              class="text-midnight-400 mt-1"
            >
              管理和配置所有连接的睡眠监测设备
            </Motion.p>
          </div>

          <div class="flex items-center gap-3">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={handleRefreshAll}
              loading={isRefreshing() || devicesStore.isLoading}
            >
              刷新列表
            </Button>
            <Button
              variant="primary"
              icon={Plus}
            >
              添加设备
            </Button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="在线设备"
            value={onlineCount()}
            subtitle="个设备正常连接"
            icon={Wifi}
            color="mint"
          />
          <StatCard
            title="离线设备"
            value={offlineCount()}
            subtitle="个设备需要检查"
            icon={WifiOff}
            color="amber"
          />
          <StatCard
            title="警告设备"
            value={warningCount()}
            subtitle="个设备状态异常"
            icon={AlertTriangle}
            color="rose"
          />
          <StatCard
            title="总设备数"
            value={totalCount()}
            subtitle="个设备已注册"
            icon={Cpu}
            color="moon"
          />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-1">
            <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-white font-display">设备列表</h3>
                <span class="text-xs text-midnight-400">{totalCount()} 个设备</span>
              </div>
              <div class="space-y-3">
                <For each={devicesStore.devices}>
                  {(device) => (
                    <DeviceCard
                      device={device}
                      selected={devicesStore.selectedDeviceId === device.id}
                      onSelect={handleSelectDevice}
                      onRefresh={handleRefreshDevice}
                      onConfigure={handleConfigureDevice}
                    />
                  )}
                </For>
                {devicesStore.devices.length === 0 && (
                  <div class="text-center py-12">
                    <Cpu class="w-12 h-12 text-midnight-600 mx-auto mb-3" />
                    <p class="text-midnight-400 text-sm">暂无设备</p>
                    <p class="text-midnight-500 text-xs mt-1">点击右上角添加设备</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div class="lg:col-span-2">
            {selectedDevice() && selectedConfig() ? (
              <div class="space-y-6">
                <Motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6"
                >
                  <div class="flex items-start justify-between mb-6">
                    <div class="flex items-center gap-4">
                      <div class="text-4xl">
                        {selectedDevice()!.type === 'sensor' ? '📡' :
                         selectedDevice()!.type === 'controller' ? '🎛️' : '🔄'}
                      </div>
                      <div>
                        <h3 class="text-xl font-bold text-white font-display">{selectedDevice()!.name}</h3>
                        <div class="flex items-center gap-3 mt-1">
                          <span
                            class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              'background-color': `${DEVICE_STATUS_COLORS[selectedDevice()!.status]}20`,
                              color: DEVICE_STATUS_COLORS[selectedDevice()!.status],
                            }}
                          >
                            <span
                              class="w-1.5 h-1.5 rounded-full animate-pulse"
                              style={{ 'background-color': DEVICE_STATUS_COLORS[selectedDevice()!.status] }}
                            />
                            {DEVICE_STATUS_LABELS[selectedDevice()!.status]}
                          </span>
                          <span class="text-xs text-midnight-400">{selectedDevice()!.model}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Settings}
                    >
                      高级配置
                    </Button>
                  </div>

                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-midnight-800/40 rounded-xl p-4">
                      <p class="text-xs text-midnight-400 mb-1">信号强度</p>
                      <p class="text-xl font-bold text-white font-mono">{selectedDevice()!.signalStrength}%</p>
                    </div>
                    {selectedDevice()!.batteryLevel !== undefined && (
                      <div class="bg-midnight-800/40 rounded-xl p-4">
                        <p class="text-xs text-midnight-400 mb-1">电量</p>
                        <p class="text-xl font-bold text-white font-mono">{selectedDevice()!.batteryLevel}%</p>
                      </div>
                    )}
                    <div class="bg-midnight-800/40 rounded-xl p-4">
                      <p class="text-xs text-midnight-400 mb-1">固件版本</p>
                      <p class="text-lg font-bold text-white font-mono">{selectedDevice()!.firmware}</p>
                    </div>
                    <div class="bg-midnight-800/40 rounded-xl p-4">
                      <p class="text-xs text-midnight-400 mb-1">最后在线</p>
                      <p class="text-sm font-medium text-midnight-300">{formatLastOnline(selectedDevice()!.lastOnline)}</p>
                    </div>
                  </div>

                  <div class="bg-midnight-800/30 rounded-xl p-4">
                    <div class="flex items-center gap-2 mb-3">
                      <Gauge class="w-4 h-4 text-moon-400" />
                      <h4 class="text-sm font-semibold text-white">采样配置</h4>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <p class="text-xs text-midnight-400">采样率</p>
                        <p class="text-sm text-white font-mono">{selectedConfig()!.sampleRate} Hz</p>
                      </div>
                      <div>
                        <p class="text-xs text-midnight-400">上报间隔</p>
                        <p class="text-sm text-white font-mono">{selectedConfig()!.reportInterval} 秒</p>
                      </div>
                    </div>
                  </div>
                </Motion.div>

                <Motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6"
                >
                  <div class="flex items-center gap-2 mb-4">
                    <Bell class="w-5 h-5 text-amber-400" />
                    <h3 class="text-lg font-semibold text-white font-display">阈值告警配置</h3>
                  </div>
                  <div class="space-y-3">
                    <For each={selectedConfig()!.thresholdAlerts}>
                      {(alert) => {
                        const Icon = parameterIcons[alert.parameter] || AlertTriangle;
                        return (
                          <div
                            class={cn(
                              'flex items-center justify-between p-4 rounded-xl border transition-all',
                              alert.enabled
                                ? 'bg-midnight-800/40 border-midnight-700/50'
                                : 'bg-midnight-800/20 border-midnight-700/30 opacity-60'
                            )}
                          >
                          <div class="flex items-center gap-3">
                            <div class={cn(
                              'p-2 rounded-lg',
                              alert.enabled ? 'bg-moon-500/20 text-moon-400' : 'bg-midnight-700/30 text-midnight-500'
                            )}>
                              <Icon class="w-4 h-4" />
                            </div>
                            <div>
                              <p class="text-sm font-medium text-white">{parameterLabels[alert.parameter]}</p>
                              <p class="text-xs text-midnight-400">
                                {alert.minValue !== undefined && `最小值: ${alert.minValue}`}
                                {alert.minValue !== undefined && alert.maxValue !== undefined && ' · '}
                                {alert.maxValue !== undefined && `最大值: ${alert.maxValue}`}
                              </p>
                            </div>
                          </div>
                          <Toggle
                            checked={alert.enabled}
                            onChange={(checked) => handleToggleAlert(alert.id, checked)}
                          />
                        </div>
                      );
                    }}
                    </For>
                  </div>
                </Motion.div>

                <Motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6"
                >
                  <div class="flex items-center gap-2 mb-4">
                    <Zap class="w-5 h-5 text-mint-400" />
                    <h3 class="text-lg font-semibold text-white font-display">自动控制规则</h3>
                  </div>
                  <div class="space-y-3">
                    <For each={selectedConfig()!.autoControlRules}>
                      {(rule) => (
                        <div
                          class={cn(
                            'p-4 rounded-xl border transition-all',
                            rule.enabled
                              ? 'bg-midnight-800/40 border-midnight-700/50'
                              : 'bg-midnight-800/20 border-midnight-700/30 opacity-60'
                          )}
                        >
                        <div class="flex items-start justify-between mb-3">
                          <div>
                            <p class="text-sm font-medium text-white">{rule.name}</p>
                            <p class="text-xs text-midnight-400 mt-0.5">优先级: {rule.priority}</p>
                          </div>
                          <Toggle
                            checked={rule.enabled}
                            onChange={(checked) => handleToggleRule(rule.id, checked)}
                          />
                        </div>
                        <div class="flex items-center gap-2 text-xs">
                          <div class="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-400 rounded-lg">
                            <Clock class="w-3 h-3" />
                            <span>
                              {rule.condition.type === 'schedule' && `定时 ${rule.condition.schedule}`}
                              {rule.condition.type === 'threshold' && `${parameterLabels[rule.condition.parameter!]} ${rule.condition.operator} ${rule.condition.value}`}
                              {rule.condition.type === 'correlation' && `关联 ${rule.condition.correlationTarget}`}
                            </span>
                          </div>
                          <ArrowRight class="w-3 h-3 text-midnight-500" />
                          <div class="flex items-center gap-1.5 px-2 py-1 bg-mint-500/10 text-mint-400 rounded-lg">
                            <Zap class="w-3 h-3" />
                            <span>
                              {rule.action.type === 'set_parameter' && `设置 ${parameterLabels[rule.action.parameter!]} = ${rule.action.value}`}
                              {rule.action.type === 'send_alert' && '发送告警'}
                              {rule.action.type === 'run_scene' && `执行场景 ${rule.action.sceneId}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    </For>
                  </div>
                </Motion.div>

                <Motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6"
                >
                  <div class="flex items-center gap-2 mb-4">
                    <Send class="w-5 h-5 text-moon-400" />
                    <h3 class="text-lg font-semibold text-white font-display">发送命令</h3>
                  </div>

                  <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Power}
                      onClick={() => handleQuickCommand('start_session')}
                    >
                      开始会话
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Power}
                      onClick={() => handleQuickCommand('stop_session')}
                    >
                      停止会话
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RotateCcw}
                      onClick={() => handleQuickCommand('calibrate')}
                    >
                      校准
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RefreshCw}
                      onClick={() => handleQuickCommand('reboot')}
                    >
                      重启
                    </Button>
                  </div>

                  <div class="bg-midnight-800/30 rounded-xl p-4">
                    <p class="text-xs text-midnight-400 mb-3">自定义命令</p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label class="text-xs text-midnight-400 mb-1 block">命令类型</label>
                        <select
                          value={commandInput()}
                          onInput={(e) => setCommandInput(e.target.value)}
                          class="w-full px-3 py-2 bg-midnight-800/60 border border-midnight-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-moon-500/50"
                        >
                          <option value="">选择命令</option>
                          <option value="set_parameter">设置参数</option>
                          <option value="calibrate">校准</option>
                          <option value="reboot">重启</option>
                          <option value="start_session">开始会话</option>
                          <option value="stop_session">停止会话</option>
                        </select>
                      </div>
                      <div>
                        <label class="text-xs text-midnight-400 mb-1 block">参数</label>
                        <input
                          type="text"
                          value={parameterInput()}
                          onInput={(e) => setParameterInput(e.target.value)}
                          placeholder="例如: temperatureC"
                          class="w-full px-3 py-2 bg-midnight-800/60 border border-midnight-700/50 rounded-lg text-sm text-white placeholder-midnight-500 focus:outline-none focus:border-moon-500/50"
                        />
                      </div>
                      <div>
                        <label class="text-xs text-midnight-400 mb-1 block">值</label>
                        <input
                          type="number"
                          value={valueInput()}
                          onInput={(e) => setValueInput(e.target.value)}
                          placeholder="例如: 22"
                          class="w-full px-3 py-2 bg-midnight-800/60 border border-midnight-700/50 rounded-lg text-sm text-white placeholder-midnight-500 focus:outline-none focus:border-moon-500/50"
                        />
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      icon={Send}
                      onClick={handleSendCommand}
                      disabled={!commandInput()}
                    >
                      发送命令
                    </Button>
                  </div>

                  {devicesStore.commands.length > 0 && (
                    <div class="mt-4">
                      <p class="text-xs text-midnight-400 mb-2">最近发送的命令</p>
                      <div class="space-y-2 max-h-40 overflow-y-auto">
                        <For each={devicesStore.commands.slice(0, 5)}>
                          {(cmd) => (
                            <div
                              class="flex items-center justify-between px-3 py-2 bg-midnight-800/20 rounded-lg text-xs"
                            >
                            <div class="flex items-center gap-2">
                              <Send class="w-3 h-3 text-moon-400" />
                              <span class="text-midnight-300 font-mono">{cmd.command}</span>
                              {cmd.parameter && (
                                <span class="text-midnight-400">
                                  {cmd.parameter} = {cmd.value}
                                </span>
                              )}
                            </div>
                            <span class="text-midnight-500 font-mono">
                              {new Date(cmd.timestamp).toLocaleTimeString('zh-CN')}
                            </span>
                          </div>
                        )}
                        </For>
                      </div>
                    </div>
                  )}
                </Motion.div>
              </div>
            ) : (
              <div class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-12 text-center">
                <Cpu class="w-16 h-16 text-midnight-600 mx-auto mb-4" />
                <h3 class="text-lg font-semibold text-white mb-2">选择一个设备</h3>
                <p class="text-midnight-400 text-sm">从左侧列表选择一个设备以查看详情和配置</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Devices;
