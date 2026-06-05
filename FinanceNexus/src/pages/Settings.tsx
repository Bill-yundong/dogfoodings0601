import { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Lock,
  Unlock,
  Database,
  Shield,
  Trash2,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { useFinanceStore } from '../store';

export default function Settings() {
  const { exportData, importData, clearAllData, encryptionEnabled, enableEncryption, disableEncryption } = useFinanceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-nexus-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      setError('导出失败，请重试');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        await importData(content);
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (err) {
        setError('导入失败，请检查文件格式');
        setTimeout(() => setError(''), 3000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEnableEncryption = async () => {
    if (!password || !confirmPassword) {
      setError('请输入密码并确认');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (password !== confirmPassword) {
      setError('两次密码不一致');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (password.length < 6) {
      setError('密码长度至少6位');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      await enableEncryption(password);
      setPassword('');
      setConfirmPassword('');
      setError('');
    } catch (err) {
      setError('启用加密失败');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDisableEncryption = async () => {
    if (!password) {
      setError('请输入密码');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      await disableEncryption(password);
      setPassword('');
      setError('');
    } catch (err) {
      setError('密码错误或禁用加密失败');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleClearData = async () => {
    try {
      await clearAllData();
      setShowClearConfirm(false);
    } catch (err) {
      setError('清空数据失败');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white mb-1">系统设置</h1>
        <p className="text-primary-400 text-sm">管理您的数据与安全设置</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/20 border border-rose-500/30">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <p className="text-rose-400">{error}</p>
        </div>
      )}

      {exportSuccess && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-400">数据导出成功！</p>
        </div>
      )}

      {importSuccess && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-400">数据导入成功！</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-sky-500/20">
              <Database className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">数据管理</h3>
              <p className="text-sm text-primary-400">导入导出您的财务数据</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-primary-100/30">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-white mb-1">导出数据</h4>
                  <p className="text-sm text-primary-400">将所有数据导出为 JSON 文件备份</p>
                </div>
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500/20 text-sky-400 rounded-xl hover:bg-sky-500/30 transition-colors"
              >
                <Download className="w-4 h-4" />
                导出备份
              </button>
            </div>

            <div className="p-4 rounded-xl bg-primary-100/30">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-white mb-1">导入数据</h4>
                  <p className="text-sm text-primary-400">从备份文件恢复数据</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-colors"
              >
                <Upload className="w-4 h-4" />
                选择文件
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-white mb-1">清空数据</h4>
                  <p className="text-sm text-primary-400">删除所有本地存储的数据</p>
                </div>
              </div>
              {!showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  清空所有
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-rose-400">
                    ⚠️ 确定要清空所有数据吗？此操作不可恢复！
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-4 py-2 bg-primary-100/50 text-primary-400 rounded-xl hover:bg-primary-100/70 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleClearData}
                      className="px-4 py-2 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors"
                    >
                      确认清空
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">加密设置</h3>
              <p className="text-sm text-primary-400">保护您的敏感财务数据</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-primary-100/30 mb-4">
              <div className={`p-2 rounded-lg ${encryptionEnabled ? 'bg-emerald-500/20' : 'bg-primary-100/50'}`}>
                {encryptionEnabled ? (
                  <Lock className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Unlock className="w-5 h-5 text-primary-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">
                  {encryptionEnabled ? '加密已启用' : '加密未启用'}
                </p>
                <p className="text-sm text-primary-400">
                  {encryptionEnabled
                    ? '数据已使用 AES-GCM 加密存储'
                    : '启用加密以保护您的敏感数据'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-sky-300">
                启用加密后，所有财务数据将在本地使用您设置的密码进行加密。
                请务必牢记密码，密码丢失将导致数据无法恢复。
              </p>
            </div>
          </div>

          {!encryptionEnabled ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-primary-400 mb-2">设置加密密码</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入密码"
                    className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 pl-12 pr-12 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-primary-400 mb-2">确认密码</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 pl-12 pr-4 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>

              <button
                onClick={handleEnableEncryption}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <Lock className="w-4 h-4" />
                启用加密
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-primary-400 mb-2">输入当前密码</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入密码以禁用加密"
                    className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 pl-12 pr-12 text-white placeholder-primary-400 focus:outline-none focus:border-rose-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleDisableEncryption}
                className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500/20 text-rose-400 rounded-xl font-medium hover:bg-rose-500/30 transition-colors"
              >
                <Unlock className="w-4 h-4" />
                禁用加密
              </button>
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-amber-500/20">
            <Info className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-white">关于 FinanceNexus</h3>
            <p className="text-sm text-primary-400">系统信息与数据主权声明</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-primary-400">版本</span>
              <span className="text-white font-mono">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-400">构建时间</span>
              <span className="text-white font-mono">2025-06-01</span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-400">数据存储</span>
              <span className="text-emerald-400">本地 IndexedDB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-400">加密算法</span>
              <span className="text-white font-mono">AES-GCM 256-bit</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-primary-100/30">
            <h4 className="font-medium text-white mb-2">🔒 数据主权声明</h4>
            <p className="text-sm text-primary-400 leading-relaxed">
              您的所有财务数据仅存储在您的设备本地，绝不会上传到任何服务器。
              启用加密后，数据将使用您设置的密码进行端到端加密。
              您完全拥有并控制自己的数据。
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
