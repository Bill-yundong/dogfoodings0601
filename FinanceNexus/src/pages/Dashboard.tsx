import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { useFinanceStore } from '../store';
import { GlassCard, StatCard } from '../components/ui/GlassCard';
import { CashFlowEngine, InflationEngine } from '../utils/cashFlowEngine';
import { formatCurrency, formatPercent } from '../utils/compoundEngine';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];

export default function Dashboard() {
  const { transactions, categories, assets, isInitialized, init } = useFinanceStore();
  const [currentMonth, setCurrentMonth] = useState('3');

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [isInitialized, init]);

  const cashFlowData = useMemo(() => {
    return CashFlowEngine.analyzeMonthly(transactions);
  }, [transactions]);

  const totals = useMemo(() => {
    const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
    const totalIncome = CashFlowEngine.calculateTotalIncome(transactions);
    const totalExpense = CashFlowEngine.calculateTotalExpense(transactions);
    const netCashFlow = CashFlowEngine.calculateNetCashFlow(transactions);
    const savingsRate = totalIncome > 0 ? (netCashFlow / totalIncome) * 100 : 0;

    return {
      totalAssets,
      totalIncome,
      totalExpense,
      netCashFlow,
      savingsRate,
    };
  }, [transactions, assets]);

  const categoryBreakdown = useMemo(() => {
    const expenseByCategory = CashFlowEngine.analyzeByCategory(transactions, 'expense');
    return expenseByCategory
      .map((item) => {
        const category = categories.find((c) => c.id === item.categoryId);
        return {
          name: category?.name || '未知',
          value: item.amount,
          color: category?.color || '#64748B',
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [transactions, categories]);

  const inflationData = useMemo(() => {
    return InflationEngine.calculatePurchasingPower(100000, 10, 0.025);
  }, []);

  const prediction = useMemo(() => {
    return CashFlowEngine.predictNextMonth(transactions);
  }, [transactions]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-primary-400">正在初始化...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white mb-1">财务概览</h1>
          <p className="text-primary-400 text-sm">实时监控您的财务健康状况</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-400" />
            <span className="text-sm text-white">2025年</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="总资产"
          value={formatCurrency(totals.totalAssets)}
          icon={<Wallet className="w-5 h-5 text-emerald-400" />}
          trend={8.5}
          delay={0}
        />
        <StatCard
          title="本月收入"
          value={formatCurrency(totals.totalIncome)}
          icon={<TrendingUp className="w-5 h-5 text-sky-400" />}
          trend={12.3}
          delay={0.1}
        />
        <StatCard
          title="本月支出"
          value={formatCurrency(totals.totalExpense)}
          icon={<TrendingDown className="w-5 h-5 text-rose-400" />}
          trend={-5.2}
          delay={0.2}
        />
        <StatCard
          title="储蓄率"
          value={formatPercent(totals.savingsRate)}
          subtitle={`净现金流 ${formatCurrency(totals.netCashFlow)}`}
          icon={<PiggyBank className="w-5 h-5 text-amber-400" />}
          delay={0.3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2" delay={0.4}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-display font-semibold text-white">现金流趋势</h3>
              <p className="text-sm text-primary-400">最近12个月收支情况</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-primary-400">收入</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-sm text-primary-400">支出</span>
              </div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis
                  dataKey="period"
                  stroke="#64748B"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area
                  type="monotone"
                  dataKey="totalIncome"
                  name="收入"
                  stroke="#10B981"
                  fill="url(#incomeGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="totalExpense"
                  name="支出"
                  stroke="#EF4444"
                  fill="url(#expenseGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard delay={0.5}>
          <div className="mb-6">
            <h3 className="text-lg font-display font-semibold text-white mb-1">支出分类</h3>
            <p className="text-sm text-primary-400">按类别统计</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {categoryBreakdown.slice(0, 4).map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-primary-300">{item.name}</span>
                </div>
                <span className="text-sm font-mono text-white">
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard delay={0.6}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-display font-semibold text-white">通胀侵蚀分析</h3>
              <p className="text-sm text-primary-400">10万元购买力随时间变化</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-primary-400">通胀率</p>
              <p className="text-lg font-bold text-amber-400">2.5%</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={inflationData}>
                <defs>
                  <linearGradient id="inflationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis
                  dataKey="year"
                  stroke="#64748B"
                  fontSize={12}
                  tickLine={false}
                  label={{ value: '年份', position: 'insideBottom', offset: -5, fill: '#64748B' }}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(value) => `¥${(value / 10000).toFixed(0)}万`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area
                  type="monotone"
                  dataKey="purchasingPower"
                  name="实际购买力"
                  stroke="#F59E0B"
                  fill="url(#inflationGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard delay={0.7}>
          <div className="mb-6">
            <h3 className="text-lg font-display font-semibold text-white mb-1">下月预测</h3>
            <p className="text-sm text-primary-400">基于历史数据的智能预测</p>
          </div>
          
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <DollarSign className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-primary-400 mb-1">预测收入</p>
                <p className="text-lg font-bold text-emerald-400">
                  {formatCurrency(prediction.projectedIncome)}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <TrendingDown className="w-6 h-6 text-rose-400 mx-auto mb-2" />
                <p className="text-xs text-primary-400 mb-1">预测支出</p>
                <p className="text-lg font-bold text-rose-400">
                  {formatCurrency(prediction.projectedExpense)}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <PiggyBank className="w-6 h-6 text-sky-400 mx-auto mb-2" />
                <p className="text-xs text-primary-400 mb-1">预测结余</p>
                <p className="text-lg font-bold text-sky-400">
                  {formatCurrency(prediction.projectedSavings)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-primary-400">预测置信度</span>
                <span className="text-sm font-medium text-white">{prediction.confidence.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full transition-all duration-1000"
                  style={{ width: `${prediction.confidence}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary-100/30">
              <p className="text-sm text-primary-300">
                💡 建议：根据您的消费习惯，建议在每月初预留 
                <span className="text-amber-400 font-medium"> {formatCurrency(prediction.projectedExpense * 1.1)} </span>
                作为当月预算，以应对意外支出。
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard delay={0.8}>
        <div className="mb-6">
          <h3 className="text-lg font-display font-semibold text-white mb-1">月度净现金流</h3>
          <p className="text-sm text-primary-400">每月收支差额</p>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                dataKey="period"
                stroke="#64748B"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar
                dataKey="netCashFlow"
                name="净现金流"
                radius={[4, 4, 0, 0]}
              >
                {cashFlowData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.netCashFlow >= 0 ? '#10B981' : '#EF4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}
