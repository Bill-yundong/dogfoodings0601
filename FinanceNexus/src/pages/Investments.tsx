import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import {
  PiggyBank,
  TrendingUp,
  Shield,
  Target,
  Plus,
  Trash2,
  PieChart as PieIcon,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { useFinanceStore } from '../store';
import { formatCurrency, formatPercent } from '../utils/compoundEngine';
import { Asset } from '../types';

const ASSET_CLASSES = [
  { id: 'cash', name: '现金', color: '#64748B', risk: 1, return: 2 },
  { id: 'fixed', name: '固定收益', color: '#3B82F6', risk: 2, return: 4 },
  { id: 'equity', name: '股票', color: '#10B981', risk: 4, return: 8 },
  { id: 'fund', name: '基金', color: '#8B5CF6', risk: 3, return: 6 },
  { id: 'realEstate', name: '房产', color: '#F59E0B', risk: 3, return: 5 },
  { id: 'alternative', name: '另类投资', color: '#EC4899', risk: 5, return: 10 },
];

export default function Investments() {
  const { assets, addAsset, updateAsset, deleteAsset } = useFinanceStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: '',
    typeId: 'cash',
    value: '',
    growthRate: '',
    acquiredDate: new Date().toISOString().split('T')[0],
  });

  const totalAssets = useMemo(() => {
    return assets.reduce((sum, a) => sum + a.value, 0);
  }, [assets]);

  const assetAllocation = useMemo(() => {
    const allocation: Record<string, number> = {};
    assets.forEach((a) => {
      if (!allocation[a.typeId]) {
        allocation[a.typeId] = 0;
      }
      allocation[a.typeId] += a.value;
    });

    return ASSET_CLASSES.map((cls) => ({
      ...cls,
      value: allocation[cls.id] || 0,
      percentage: totalAssets > 0 ? ((allocation[cls.id] || 0) / totalAssets) * 100 : 0,
    }));
  }, [assets, totalAssets]);

  const radarData = useMemo(() => {
    return ASSET_CLASSES.map((cls) => {
      const allocated = assetAllocation.find((a) => a.id === cls.id);
      return {
        subject: cls.name,
        配置占比: allocated?.percentage || 0,
        风险水平: cls.risk * 20,
        预期收益: cls.return * 10,
      };
    });
  }, [assetAllocation]);

  const portfolioStats = useMemo(() => {
    const weightedReturn = assetAllocation.reduce((sum, cls) => {
      return sum + (cls.percentage / 100) * cls.return;
    }, 0);

    const weightedRisk = assetAllocation.reduce((sum, cls) => {
      return sum + (cls.percentage / 100) * cls.risk;
    }, 0);

    return {
      expectedReturn: weightedReturn,
      riskLevel: weightedRisk,
      sharpeRatio: weightedRisk > 0 ? weightedReturn / weightedRisk : 0,
    };
  }, [assetAllocation]);

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.name || !newAsset.value) return;

    addAsset({
      name: newAsset.name,
      typeId: newAsset.typeId,
      value: parseFloat(newAsset.value),
      growthRate: parseFloat(newAsset.growthRate) || 0,
      acquiredDate: newAsset.acquiredDate,
    });

    setNewAsset({
      name: '',
      typeId: 'cash',
      value: '',
      growthRate: '',
      acquiredDate: new Date().toISOString().split('T')[0],
    });
    setShowAddForm(false);
  };

  const getAssetClass = (typeId: string) => {
    return ASSET_CLASSES.find((c) => c.id === typeId);
  };

  const riskLevelText = (level: number) => {
    if (level <= 1.5) return { text: '保守', color: 'text-sky-400' };
    if (level <= 2.5) return { text: '稳健', color: 'text-emerald-400' };
    if (level <= 3.5) return { text: '平衡', color: 'text-amber-400' };
    if (level <= 4.5) return { text: '成长', color: 'text-orange-400' };
    return { text: '激进', color: 'text-rose-400' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white mb-1">理财规划</h1>
          <p className="text-primary-400 text-sm">资产配置与投资组合管理</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          添加资产
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="text-center">
          <div className="p-3 rounded-xl bg-emerald-500/20 w-fit mx-auto mb-3">
            <PiggyBank className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-sm text-primary-400 mb-1">总资产</p>
          <p className="text-2xl font-display font-bold text-white">{formatCurrency(totalAssets)}</p>
        </GlassCard>

        <GlassCard className="text-center">
          <div className="p-3 rounded-xl bg-sky-500/20 w-fit mx-auto mb-3">
            <TrendingUp className="w-6 h-6 text-sky-400" />
          </div>
          <p className="text-sm text-primary-400 mb-1">预期年化收益</p>
          <p className="text-2xl font-display font-bold text-sky-400">
            {formatPercent(portfolioStats.expectedReturn)}
          </p>
        </GlassCard>

        <GlassCard className="text-center">
          <div className="p-3 rounded-xl bg-amber-500/20 w-fit mx-auto mb-3">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-sm text-primary-400 mb-1">风险等级</p>
          <p className={`text-2xl font-display font-bold ${riskLevelText(portfolioStats.riskLevel).color}`}>
            {riskLevelText(portfolioStats.riskLevel).text}
          </p>
        </GlassCard>

        <GlassCard className="text-center">
          <div className="p-3 rounded-xl bg-rose-500/20 w-fit mx-auto mb-3">
            <Target className="w-6 h-6 text-rose-400" />
          </div>
          <p className="text-sm text-primary-400 mb-1">夏普比率</p>
          <p className="text-2xl font-display font-bold text-rose-400">
            {portfolioStats.sharpeRatio.toFixed(2)}
          </p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-emerald-500/20">
              <PieIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">资产配置</h3>
              <p className="text-sm text-primary-400">各类资产占比分布</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetAllocation.filter((a) => a.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {assetAllocation
                    .filter((a) => a.value > 0)
                    .map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, _name, props) => [
                    `${formatCurrency(value)} (${props.payload.percentage.toFixed(1)}%)`,
                    props.payload.name,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-sky-500/20">
              <Target className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">风险收益分析</h3>
              <p className="text-sm text-primary-400">组合特征雷达图</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" stroke="#64748B" fontSize={11} />
                <PolarRadiusAxis stroke="#334155" />
                <Radar
                  name="配置占比"
                  dataKey="配置占比"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.3}
                />
                <Radar
                  name="风险水平"
                  dataKey="风险水平"
                  stroke="#F59E0B"
                  fill="#F59E0B"
                  fillOpacity={0.2}
                />
                <Radar
                  name="预期收益"
                  dataKey="预期收益"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.2}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="font-display font-semibold text-white mb-4">资产列表</h3>
        
        {assets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-100/50 flex items-center justify-center">
              <PiggyBank className="w-8 h-8 text-primary-400" />
            </div>
            <p className="text-primary-400">暂无资产记录</p>
            <p className="text-sm text-primary-500 mt-1">点击"添加资产"开始管理您的投资组合</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-primary-400 border-b border-primary-200/20">
                  <th className="pb-3 font-medium">资产名称</th>
                  <th className="pb-3 font-medium">类别</th>
                  <th className="pb-3 font-medium">当前价值</th>
                  <th className="pb-3 font-medium">预期增速</th>
                  <th className="pb-3 font-medium">配置占比</th>
                  <th className="pb-3 font-medium">购入日期</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {assets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    assetClass={getAssetClass(asset.typeId)}
                    totalAssets={totalAssets}
                    onDelete={() => deleteAsset(asset.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-lg relative">
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute top-4 right-4 p-2 hover:bg-primary-100/50 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-display font-bold text-white mb-6">添加资产</h2>

            <form onSubmit={handleAddAsset} className="space-y-4">
              <div>
                <label className="block text-sm text-primary-400 mb-2">资产名称</label>
                <input
                  type="text"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 px-4 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="例如：招商银行存款"
                />
              </div>

              <div>
                <label className="block text-sm text-primary-400 mb-2">资产类别</label>
                <div className="grid grid-cols-3 gap-2">
                  {ASSET_CLASSES.map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setNewAsset({ ...newAsset, typeId: cls.id })}
                      className={`p-3 rounded-xl text-center transition-all ${
                        newAsset.typeId === cls.id
                          ? 'bg-emerald-500/20 border border-emerald-500/50 text-white'
                          : 'bg-primary-100/50 text-primary-400 hover:bg-primary-100/70'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-lg mx-auto mb-1"
                        style={{ backgroundColor: cls.color }}
                      />
                      <span className="text-xs">{cls.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-primary-400 mb-2">当前价值</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400">¥</span>
                    <input
                      type="number"
                      value={newAsset.value}
                      onChange={(e) => setNewAsset({ ...newAsset, value: e.target.value })}
                      className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 pl-10 pr-4 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-primary-400 mb-2">预期年增速</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={newAsset.growthRate}
                      onChange={(e) => setNewAsset({ ...newAsset, growthRate: e.target.value })}
                      className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 px-4 pr-10 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                      placeholder="5.0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400">%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-3 bg-primary-100/50 text-primary-400 rounded-xl font-medium hover:bg-primary-100/70 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newAsset.name || !newAsset.value}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function AssetRow({
  asset,
  assetClass,
  totalAssets,
  onDelete,
}: {
  asset: Asset;
  assetClass?: typeof ASSET_CLASSES[0];
  totalAssets: number;
  onDelete: () => void;
}) {
  const percentage = totalAssets > 0 ? (asset.value / totalAssets) * 100 : 0;

  return (
    <tr className="border-b border-primary-200/10 hover:bg-primary-100/20 transition-colors group">
      <td className="py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: (assetClass?.color || '#64748B') + '30' }}
          >
            <PiggyBank
              className="w-4 h-4"
              style={{ color: assetClass?.color || '#64748B' }}
            />
          </div>
          <span className="text-white font-medium">{asset.name}</span>
        </div>
      </td>
      <td className="py-3">
        <span
          className="px-2 py-1 rounded-full text-xs"
          style={{
            backgroundColor: (assetClass?.color || '#64748B') + '20',
            color: assetClass?.color || '#64748B',
          }}
        >
          {assetClass?.name || '其他'}
        </span>
      </td>
      <td className="py-3 text-white font-mono">{formatCurrency(asset.value)}</td>
      <td className="py-3">
        <span className={asset.growthRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {asset.growthRate >= 0 ? '+' : ''}
          {formatPercent(asset.growthRate)}
        </span>
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-primary-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: assetClass?.color }}
            />
          </div>
          <span className="text-primary-300 text-xs">{percentage.toFixed(1)}%</span>
        </div>
      </td>
      <td className="py-3 text-primary-300">{asset.acquiredDate}</td>
      <td className="py-3">
        <button
          onClick={onDelete}
          className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 rounded-lg transition-all text-rose-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
