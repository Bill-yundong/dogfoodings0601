import { onMount, createSignal } from 'solid-js'
import { Database, Download, Upload, Trash2, RefreshCw, FileJson, FileSpreadsheet, Info } from 'lucide-solid'
import { useSnapshots } from '@/stores/snapshotStore'
import { formatBytes } from '@/utils/time'
import CircularProgress from '@/components/charts/CircularProgress'
import type { SleepSnapshot } from '@/types'

export default function DataManage() {
  const { storageStats, snapshots, updateStorageStats, clearAllSnapshots, exportSnapshots, importSnapshots, initMockData } = useSnapshots()
  const [isExporting, setIsExporting] = createSignal(false)
  const [isImporting, setIsImporting] = createSignal(false)
  const [showConfirmClear, setShowConfirmClear] = createSignal(false)

  onMount(() => {
    updateStorageStats()
  })

  const storagePercent = () => {
    const quota = 50 * 1024 * 1024
    return Math.min(100, ((storageStats()?.totalSize || 0) / quota) * 100)
  }

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true)
    try {
      const data = await exportSnapshots()
      
      if (format === 'json') {
        const jsonStr = JSON.stringify(data, null, 2)
        const blob = new Blob([jsonStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `sleepmatrix-export-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const csvContent = generateCSV(data)
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `sleepmatrix-export-${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setIsExporting(false)
    }
  }

  const generateCSV = (data: SleepSnapshot[]): string => {
    const headers = ['ID', '开始时间', '结束时间', '时长(分钟)', '评分', '场景', '数据点数']
    const rows = data.map((s) => [
      s.id,
      new Date(s.startTime).toISOString(),
      new Date(s.endTime).toISOString(),
      (s.duration / 60000).toFixed(1),
      s.sleepScore,
      s.scene,
      s.envData.length,
    ])
    return [headers, ...rows].map((row) => row.join(',')).join('\n')
  }

  const handleImport = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (Array.isArray(data)) {
        await importSnapshots(data as SleepSnapshot[])
        await updateStorageStats()
      }
    } catch (err) {
      console.error('Import failed:', err)
      alert('导入失败，请检查文件格式')
    } finally {
      setIsImporting(false)
      input.value = ''
    }
  }

  const handleClearAll = async () => {
    await clearAllSnapshots()
    setShowConfirmClear(false)
    await updateStorageStats()
  }

  const handleInitMock = async () => {
    await initMockData()
    await updateStorageStats()
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-white">数据管理</h2>
          <p class="text-slate-400 text-sm mt-1">IndexedDB 存储管理与数据导入导出</p>
        </div>
        <button
          onClick={() => updateStorageStats()}
          class="flex items-center gap-2 px-4 py-2 glass-card hover:bg-white/10 rounded-xl transition-all"
        >
          <RefreshCw class="w-4 h-4 text-dream-purple" />
          <span class="text-sm text-white">刷新</span>
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="glass-card p-6 flex flex-col items-center">
          <CircularProgress
            value={storagePercent()}
            size={140}
            strokeWidth={12}
            color="#6366F1"
            label="已使用"
            sublabel={formatBytes(storageStats()?.totalSize || 0)}
          />
          <div class="mt-6 w-full">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-slate-400">存储配额</span>
              <span class="text-white">50 MB</span>
            </div>
            <div class="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                class="h-full rounded-full bg-gradient-to-r from-dream-purple to-calm-cyan transition-all"
                style={{ width: `${storagePercent()}%` }}
              />
            </div>
          </div>
        </div>

        <div class="lg:col-span-2 glass-card p-6">
          <h3 class="text-lg font-semibold text-white mb-4">数据统计</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="p-4 rounded-xl bg-white/5 text-center">
              <p class="text-2xl font-bold text-dream-purple font-mono">
                {storageStats()?.snapshotCount || 0}
              </p>
              <p class="text-xs text-slate-500 mt-1">睡眠快照</p>
            </div>
            <div class="p-4 rounded-xl bg-white/5 text-center">
              <p class="text-2xl font-bold text-calm-cyan font-mono">
                {storageStats()?.envDataCount || 0}
              </p>
              <p class="text-xs text-slate-500 mt-1">环境数据点</p>
            </div>
            <div class="p-4 rounded-xl bg-white/5 text-center">
              <p class="text-2xl font-bold text-amber-400 font-mono">
                {storageStats()?.sleepStageCount || 0}
              </p>
              <p class="text-xs text-slate-500 mt-1">睡眠阶段点</p>
            </div>
            <div class="p-4 rounded-xl bg-white/5 text-center">
              <p class="text-2xl font-bold text-pink-400 font-mono">
                {storageStats()?.analysisCount || 0}
              </p>
              <p class="text-xs text-slate-500 mt-1">分析结果</p>
            </div>
          </div>

          <div class="mt-6 p-4 rounded-xl bg-dream-purple/10 border border-dream-purple/20">
            <div class="flex items-start gap-3">
              <Info class="w-5 h-5 text-dream-purple flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm font-medium text-white mb-1">关于 IndexedDB 存储</p>
                <p class="text-xs text-slate-400 leading-relaxed">
                  所有睡眠数据都存储在浏览器本地的 IndexedDB 中，不会上传到任何服务器。
                  定期导出备份可以防止数据丢失。数据存储量取决于采样频率和记录时长。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="glass-card p-6">
          <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Download class="w-5 h-5 text-dream-purple" />
            导出数据
          </h3>
          <p class="text-sm text-slate-500 mb-6">
            将睡眠数据导出为 JSON 或 CSV 格式，用于备份或在其他设备上使用
          </p>
          <div class="space-y-3">
            <button
              onClick={() => handleExport('json')}
              disabled={isExporting() || snapshots().length === 0}
              class="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-dream-purple/20 hover:bg-dream-purple/30 border border-dream-purple/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileJson class="w-5 h-5 text-dream-purple" />
              <span class="text-white font-medium">导出 JSON 格式</span>
              {isExporting() && <RefreshCw class="w-4 h-4 animate-spin" />}
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting() || snapshots().length === 0}
              class="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-calm-cyan/20 hover:bg-calm-cyan/30 border border-calm-cyan/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet class="w-5 h-5 text-calm-cyan" />
              <span class="text-white font-medium">导出 CSV 格式</span>
            </button>
          </div>
        </div>

        <div class="glass-card p-6">
          <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Upload class="w-5 h-5 text-dream-purple" />
            导入数据
          </h3>
          <p class="text-sm text-slate-500 mb-6">
            从 JSON 文件导入睡眠数据，支持跨设备同步
          </p>
          <label
            class={`w-full flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              isImporting()
                ? 'border-dream-purple/50 bg-dream-purple/10'
                : 'border-white/20 hover:border-dream-purple/50 hover:bg-white/5'
            }`}
          >
            <input
              type="file"
              accept=".json"
              class="hidden"
              onChange={handleImport}
              disabled={isImporting()}
            />
            <Upload class={`w-5 h-5 ${isImporting() ? 'text-dream-purple animate-bounce' : 'text-slate-400'}`} />
            <span class="text-sm text-slate-400">
              {isImporting() ? '导入中...' : '点击选择 JSON 文件导入'}
            </span>
          </label>

          <div class="mt-6 pt-6 border-t border-white/10">
            <button
              onClick={handleInitMock}
              class="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm text-slate-400 hover:text-white"
            >
              <Database class="w-4 h-4" />
              <span>生成模拟测试数据</span>
            </button>
          </div>
        </div>
      </div>

      <div class="glass-card p-6 border-red-500/30">
        <h3 class="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Trash2 class="w-5 h-5 text-red-400" />
          危险操作
        </h3>
        <p class="text-sm text-slate-500 mb-4">
          清除所有数据将不可恢复，请谨慎操作
        </p>

        {!showConfirmClear() ? (
          <button
            onClick={() => setShowConfirmClear(true)}
            class="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all text-sm font-medium"
          >
            清除所有数据
          </button>
        ) : (
          <div class="flex items-center gap-3">
            <p class="text-sm text-red-400">确定要清除所有数据吗？</p>
            <button
              onClick={handleClearAll}
              class="px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all text-sm font-medium"
            >
              确认清除
            </button>
            <button
              onClick={() => setShowConfirmClear(false)}
              class="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all text-sm font-medium"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
