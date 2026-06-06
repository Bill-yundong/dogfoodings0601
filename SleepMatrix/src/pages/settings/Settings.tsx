import { Component, ParentProps, createSignal, For } from 'solid-js';
import { Motion } from '@motionone/solid';
import {
  Moon,
  Sun,
  Monitor,
  Volume2,
  BarChart3,
  LineChart,
  AreaChart,
  Flame,
  Bell,
  AlertTriangle,
  Activity,
  Database,
  Download,
  Trash2,
  Brain,
  Info,
  RotateCcw,
} from 'lucide-solid';
import { MainLayout } from '@/components/layout';
import { Button, Toggle } from '@/components/controls';
import { configStore, configActions } from '@/stores/config';
import type { AppConfig, ThemeMode, TimeUnit, ChartType } from '@/stores/config';
import { cn } from '@/lib/utils';

const Settings: Component = () => {
  const [showClearConfirm, setShowClearConfirm] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [isClearing, setIsClearing] = createSignal(false);

  const updateConfig = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    configActions.updateConfig({ [key]: value });
  };

  const handleReset = async () => {
    await configActions.resetConfig();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = {
        config: configStore.config,
        exportedAt: Date.now(),
        version: '1.0.0',
      };

      const format = configStore.config.exportFormat;
      let blob: Blob;
      let filename: string;

      if (format === 'json') {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `sleepmatrix-config-${Date.now()}.json`;
      } else {
        const csvContent = Object.entries(data.config)
          .map(([key, value]) => `${key},${String(value)}`)
          .join('\n');
        blob = new Blob([csvContent], { type: 'text/csv' });
        filename = `sleepmatrix-config-${Date.now()}.csv`;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      localStorage.clear();
      await configActions.resetConfig();
      setShowClearConfirm(false);
    } finally {
      setIsClearing(false);
    }
  };

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Moon }[] = [
    { value: 'dark', label: '深色模式', icon: Moon },
    { value: 'light', label: '浅色模式', icon: Sun },
    { value: 'system', label: '跟随系统', icon: Monitor },
  ];

  const languageOptions: { value: AppConfig['language']; label: string }[] = [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en-US', label: 'English' },
  ];

  const refreshRateOptions: { value: TimeUnit; label: string }[] = [
    { value: '1s', label: '1 秒' },
    { value: '5s', label: '5 秒' },
    { value: '10s', label: '10 秒' },
    { value: '30s', label: '30 秒' },
    { value: '1m', label: '1 分钟' },
  ];

  const chartTypeOptions: { value: ChartType; label: string; icon: typeof LineChart }[] = [
    { value: 'line', label: '折线图', icon: LineChart },
    { value: 'area', label: '面积图', icon: AreaChart },
    { value: 'heatmap', label: '热力图', icon: Flame },
  ];

  const autoSaveIntervalOptions: { value: number; label: string }[] = [
    { value: 10000, label: '10 秒' },
    { value: 30000, label: '30 秒' },
    { value: 60000, label: '1 分钟' },
    { value: 300000, label: '5 分钟' },
  ];

  const maxDataPointsOptions: { value: number; label: string }[] = [
    { value: 1000, label: '1,000' },
    { value: 5000, label: '5,000' },
    { value: 10000, label: '10,000' },
    { value: 50000, label: '50,000' },
    { value: 100000, label: '100,000' },
  ];

  const retentionDaysOptions: { value: number; label: string }[] = [
    { value: 7, label: '7 天' },
    { value: 30, label: '30 天' },
    { value: 90, label: '90 天' },
    { value: 180, label: '180 天' },
    { value: 365, label: '1 年' },
    { value: -1, label: '永久保留' },
  ];

  const SectionCard: Component<ParentProps<{ title: string; icon: typeof Moon; subtitle?: string }>> = (props) => (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      class="bg-midnight-900/60 backdrop-blur-xl border border-midnight-700/50 rounded-2xl p-6"
    >
      <div class="flex items-start gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-moon-500/15 flex items-center justify-center flex-shrink-0">
          <props.icon class="w-5 h-5 text-moon-400" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-white font-display">{props.title}</h3>
          {props.subtitle && (
            <p class="text-sm text-midnight-400 mt-0.5">{props.subtitle}</p>
          )}
        </div>
      </div>
      <div class="space-y-5">
        {props.children}
      </div>
    </Motion.div>
  );

  const SettingRow: Component<ParentProps<{ label: string; description?: string }>> = (props) => (
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <label class="text-sm font-medium text-white block">{props.label}</label>
        {props.description && (
          <p class="text-xs text-midnight-400 mt-0.5">{props.description}</p>
        )}
      </div>
      <div class="flex-shrink-0">
        {props.children}
      </div>
    </div>
  );

  const RadioGroup: Component<{
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string; icon?: typeof Moon }[];
  }> = (props) => (
    <div class="inline-flex bg-midnight-800/50 rounded-xl p-1">
      <For each={props.options}>
        {(option) => {
          const Icon = option.icon;
          return (
            <button
              type="button"
              onClick={() => props.onChange(option.value)}
              class={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                props.value === option.value
                  ? 'bg-moon-500 text-white shadow-md shadow-moon-500/25'
                  : 'text-midnight-300 hover:text-white hover:bg-midnight-700/50'
              )}
            >
              {Icon && <Icon class="w-3.5 h-3.5" />}
              {option.label}
            </button>
          );
        }}
      </For>
    </div>
  );

  const Select: Component<{
    value: string | number;
    onChange: (value: string) => void;
    options: { value: string | number; label: string }[];
  }> = (props) => (
    <select
      value={String(props.value)}
      onChange={(e) => props.onChange(e.target.value)}
      class={cn(
        'bg-midnight-800/50 border border-midnight-600/50 rounded-xl px-3 py-2 text-sm text-white',
        'focus:outline-none focus:ring-2 focus:ring-moon-500/50 focus:border-moon-500/50',
        'transition-all duration-200 cursor-pointer min-w-[140px]'
      )}
    >
      <For each={props.options}>
        {(option) => (
          <option value={option.value}>
            {option.label}
          </option>
        )}
      </For>
    </select>
  );

  const Slider: Component<{
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    unit?: string;
  }> = (props) => (
    <div class="flex items-center gap-3">
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={(e) => props.onChange(Number(e.target.value))}
        class={cn(
          'w-32 h-2 bg-midnight-700 rounded-full appearance-none cursor-pointer',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-moon-500',
          '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-moon-500/50',
          '[&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110'
        )}
      />
      <span class="text-sm text-moon-400 font-mono w-16 text-right">
        {props.value}{props.unit}
      </span>
    </div>
  );

  return (
    <MainLayout>
      <div class="space-y-6 pb-8">
        <Motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          class="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 class="text-2xl font-bold text-white font-display">系统设置</h1>
            <p class="text-midnight-400 mt-1">配置应用程序的各项参数和偏好设置</p>
          </div>
          <div class="flex items-center gap-3">
            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={handleReset}
            >
              重置默认
            </Button>
          </div>
        </Motion.div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            title="通用设置"
            icon={Monitor}
            subtitle="个性化您的使用体验"
          >
            <SettingRow
              label="主题模式"
              description="选择您喜欢的界面外观"
            >
              <RadioGroup
                value={configStore.config.theme}
                onChange={(v) => updateConfig('theme', v as ThemeMode)}
                options={themeOptions}
              />
            </SettingRow>

            <SettingRow
              label="语言"
              description="选择界面显示语言"
            >
              <RadioGroup
                value={configStore.config.language}
                onChange={(v) => updateConfig('language', v as AppConfig['language'])}
                options={languageOptions}
              />
            </SettingRow>

            <SettingRow
              label="动画效果"
              description="启用界面过渡动画"
            >
              <Toggle
                checked={configStore.config.animationEnabled}
                onChange={(v) => updateConfig('animationEnabled', v)}
              />
            </SettingRow>

            <SettingRow
              label="声音提示"
              description="操作时播放提示音效"
            >
              <Toggle
                checked={configStore.config.soundEnabled}
                onChange={(v) => updateConfig('soundEnabled', v)}
              />
            </SettingRow>
          </SectionCard>

          <SectionCard
            title="数据采集"
            icon={Activity}
            subtitle="配置实时数据采集参数"
          >
            <SettingRow
              label="实时刷新频率"
              description="数据界面的刷新间隔"
            >
              <Select
                value={configStore.config.realtimeRefreshRate}
                onChange={(v) => updateConfig('realtimeRefreshRate', v as TimeUnit)}
                options={refreshRateOptions}
              />
            </SettingRow>

            <SettingRow
              label="自动保存"
              description="自动将数据保存到本地存储"
            >
              <Toggle
                checked={configStore.config.autoSave}
                onChange={(v) => updateConfig('autoSave', v)}
              />
            </SettingRow>

            <SettingRow
              label="自动保存间隔"
              description="自动保存的时间间隔"
            >
              <Select
                value={configStore.config.autoSaveInterval}
                onChange={(v) => updateConfig('autoSaveInterval', Number(v))}
                options={autoSaveIntervalOptions}
              />
            </SettingRow>

            <SettingRow
              label="最大数据点数"
              description="内存中保留的最大数据点数量"
            >
              <Select
                value={configStore.config.maxDataPoints}
                onChange={(v) => updateConfig('maxDataPoints', Number(v))}
                options={maxDataPointsOptions}
              />
            </SettingRow>
          </SectionCard>

          <SectionCard
            title="图表显示"
            icon={BarChart3}
            subtitle="配置数据可视化选项"
          >
            <SettingRow
              label="默认图表类型"
              description="新建图表时使用的默认类型"
            >
              <RadioGroup
                value={configStore.config.defaultChartType}
                onChange={(v) => updateConfig('defaultChartType', v as ChartType)}
                options={chartTypeOptions}
              />
            </SettingRow>

            <SettingRow
              label="显示置信区间"
              description="在图表中显示置信区间阴影"
            >
              <Toggle
                checked={configStore.config.showConfidenceInterval}
                onChange={(v) => updateConfig('showConfidenceInterval', v)}
              />
            </SettingRow>

            <SettingRow
              label="显示数据点标签"
              description="在数据点上方显示数值标签"
            >
              <Toggle
                checked={configStore.config.showDataPointLabels}
                onChange={(v) => updateConfig('showDataPointLabels', v)}
              />
            </SettingRow>
          </SectionCard>

          <SectionCard
            title="通知设置"
            icon={Bell}
            subtitle="管理系统通知偏好"
          >
            <SettingRow
              label="启用通知"
              description="接收应用程序的所有通知"
            >
              <Toggle
                checked={configStore.config.enableNotifications}
                onChange={(v) => updateConfig('enableNotifications', v)}
              />
            </SettingRow>

            <SettingRow
              label="阈值告警通知"
              description="当数据超过预设阈值时提醒"
            >
              <Toggle
                checked={configStore.config.notificationThresholdAlerts}
                onChange={(v) => updateConfig('notificationThresholdAlerts', v)}
                disabled={!configStore.config.enableNotifications}
              />
            </SettingRow>

            <SettingRow
              label="分析完成通知"
              description="数据分析完成时发送通知"
            >
              <Toggle
                checked={configStore.config.notificationAnalysisComplete}
                onChange={(v) => updateConfig('notificationAnalysisComplete', v)}
                disabled={!configStore.config.enableNotifications}
              />
            </SettingRow>

            <SettingRow
              label="设备状态变更通知"
              description="设备连接或断开时提醒"
            >
              <Toggle
                checked={configStore.config.notificationDeviceStatus}
                onChange={(v) => updateConfig('notificationDeviceStatus', v)}
                disabled={!configStore.config.enableNotifications}
              />
            </SettingRow>
          </SectionCard>

          <SectionCard
            title="数据管理"
            icon={Database}
            subtitle="管理本地存储的数据"
          >
            <SettingRow
              label="数据保留天数"
              description="超过此时间的数据将被自动清除"
            >
              <Select
                value={configStore.config.dataRetentionDays}
                onChange={(v) => updateConfig('dataRetentionDays', Number(v))}
                options={retentionDaysOptions}
              />
            </SettingRow>

            <SettingRow
              label="导出格式"
              description="导出数据时使用的文件格式"
            >
              <RadioGroup
                value={configStore.config.exportFormat}
                onChange={(v) => updateConfig('exportFormat', v as 'json' | 'csv')}
                options={[
                  { value: 'json', label: 'JSON' },
                  { value: 'csv', label: 'CSV' },
                ]}
              />
            </SettingRow>

            <SettingRow
              label="导出配置数据"
              description="将当前配置导出为文件"
            >
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={handleExport}
                loading={isExporting()}
              >
                导出数据
              </Button>
            </SettingRow>

            <SettingRow
              label="清除本地数据"
              description="清除所有本地存储的数据和配置"
            >
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => setShowClearConfirm(true)}
              >
                清除数据
              </Button>
            </SettingRow>
          </SectionCard>

          <SectionCard
            title="高级分析"
            icon={Brain}
            subtitle="配置数据分析引擎参数"
          >
            <SettingRow
              label="相关性显著性阈值"
              description="被视为显著相关的最小相关系数"
            >
              <Slider
                value={configStore.config.correlationThreshold}
                onChange={(v) => updateConfig('correlationThreshold', v)}
                min={0.1}
                max={0.9}
                step={0.05}
              />
            </SettingRow>

            <SettingRow
              label="时间对齐窗口"
              description="时间戳对齐时使用的窗口大小（毫秒）"
            >
              <Select
                value={configStore.config.alignmentWindowMs}
                onChange={(v) => updateConfig('alignmentWindowMs', Number(v))}
                options={[
                  { value: 1000, label: '1,000 ms' },
                  { value: 2000, label: '2,000 ms' },
                  { value: 5000, label: '5,000 ms' },
                  { value: 10000, label: '10,000 ms' },
                  { value: 30000, label: '30,000 ms' },
                ]}
              />
            </SettingRow>

            <SettingRow
              label="自动运行分析"
              description="数据采集完成后自动运行分析"
            >
              <Toggle
                checked={configStore.config.autoRunAnalysis}
                onChange={(v) => updateConfig('autoRunAnalysis', v)}
              />
            </SettingRow>

            <SettingRow
              label="Web Worker 计算"
              description="使用后台线程执行计算密集型任务"
            >
              <Toggle
                checked={configStore.config.useWebWorker}
                onChange={(v) => updateConfig('useWebWorker', v)}
              />
            </SettingRow>
          </SectionCard>
        </div>

        <SectionCard
          title="关于"
          icon={Info}
          subtitle="应用程序信息"
        >
          <div class="space-y-3">
            <div class="flex items-center justify-between py-2 border-b border-midnight-700/30">
              <span class="text-sm text-midnight-400">版本号</span>
              <span class="text-sm text-white font-mono">1.0.0</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-midnight-700/30">
              <span class="text-sm text-midnight-400">构建时间</span>
              <span class="text-sm text-white font-mono">2025-06-01</span>
            </div>
            <div class="flex items-center justify-between py-2">
              <span class="text-sm text-midnight-400">版权信息</span>
              <span class="text-sm text-white">© 2025 SleepMatrix. All rights reserved.</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {showClearConfirm() && (
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            class="bg-midnight-900 border border-midnight-700/50 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle class="w-6 h-6 text-rose-400" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-white">确认清除数据</h3>
                <p class="text-sm text-midnight-400 mt-2">
                  此操作将清除所有本地存储的数据，包括历史记录、配置和缓存。此操作不可撤销。
                </p>
              </div>
            </div>
            <div class="flex items-center justify-end gap-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing()}
              >
                取消
              </Button>
              <Button
                variant="danger"
                onClick={handleClearData}
                loading={isClearing()}
              >
                确认清除
              </Button>
            </div>
          </Motion.div>
        </div>
      )}
    </MainLayout>
  );
};

export default Settings;
