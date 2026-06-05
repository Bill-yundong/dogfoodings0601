import { useState, useMemo } from 'react';
import {
  Calculator,
  FileText,
  Lightbulb,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { GlassCard } from '../components/ui/GlassCard';
import { TaxEngine, TaxOptimizationSuggestion } from '../utils/taxEngine';
import { TaxDeductions } from '../types';
import { formatCurrency, formatPercent } from '../utils/compoundEngine';

const defaultDeductions: TaxDeductions = {
  basic: 60000,
  socialInsurance: 0,
  housingFund: 0,
  special: {
    childrenEducation: 0,
    continuingEducation: 0,
    medicalTreatment: 0,
    housingLoan: 0,
    housingRent: 0,
    elderlyCare: 0,
    infantCare: 0,
  },
};

export default function Tax() {
  const [annualIncome, setAnnualIncome] = useState(200000);
  const [deductions, setDeductions] = useState<TaxDeductions>(defaultDeductions);
  const [showOptimizations, setShowOptimizations] = useState(true);
  const [showSpecialDeductions, setShowSpecialDeductions] = useState(false);

  const taxResult = useMemo(() => {
    return TaxEngine.calculateAnnualTax(annualIncome, deductions);
  }, [annualIncome, deductions]);

  const optimizationSuggestions = useMemo(() => {
    return TaxEngine.getOptimizationSuggestions(annualIncome, deductions);
  }, [annualIncome, deductions]);

  const taxBracket = useMemo(() => {
    return TaxEngine.getTaxBracketInfo(taxResult.taxableIncome);
  }, [taxResult.taxableIncome]);

  const totalDeductions = useMemo(() => {
    return TaxEngine.calculateTotalDeductions(deductions);
  }, [deductions]);

  const updateSpecialDeduction = (field: keyof typeof deductions.special, value: number) => {
    setDeductions({
      ...deductions,
      special: {
        ...deductions.special,
        [field]: value,
      },
    });
  };

  const monthlyChartData = useMemo(() => {
    return taxResult.monthlyBreakdown.map((item) => ({
      month: `${item.month}月`,
      tax: item.monthlyTax,
      netIncome: item.netIncome,
    }));
  }, [taxResult.monthlyBreakdown]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white mb-1">税务计算</h1>
        <p className="text-primary-400 text-sm">智能计算个人所得税，提供优化建议</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-sky-500/20">
              <Calculator className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">税务计算器</h3>
              <p className="text-sm text-primary-400">输入您的收入信息</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-primary-400 mb-2">年度税前收入</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400">¥</span>
                <input
                  type="number"
                  value={annualIncome}
                  onChange={(e) => setAnnualIncome(parseFloat(e.target.value) || 0)}
                  className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 pl-10 pr-4 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-primary-400 mb-2">月社保</label>
                <input
                  type="number"
                  value={deductions.socialInsurance}
                  onChange={(e) =>
                    setDeductions({ ...deductions, socialInsurance: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 px-4 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-primary-400 mb-2">月公积金</label>
                <input
                  type="number"
                  value={deductions.housingFund}
                  onChange={(e) =>
                    setDeductions({ ...deductions, housingFund: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 px-4 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                />
              </div>
            </div>

            <button
              onClick={() => setShowSpecialDeductions(!showSpecialDeductions)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-primary-100/30 hover:bg-primary-100/50 transition-colors"
            >
              <span className="text-white font-medium">专项附加扣除</span>
              {showSpecialDeductions ? (
                <ChevronUp className="w-5 h-5 text-primary-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-primary-400" />
              )}
            </button>

            {showSpecialDeductions && (
              <div className="space-y-3 p-4 rounded-xl bg-primary-100/20">
                {[
                  { key: 'childrenEducation', label: '子女教育(月)', max: 2000 },
                  { key: 'continuingEducation', label: '继续教育(年)', max: 4800 },
                  { key: 'housingLoan', label: '住房贷款(月)', max: 1000 },
                  { key: 'housingRent', label: '住房租金(月)', max: 1500 },
                  { key: 'elderlyCare', label: '赡养老人(月)', max: 3000 },
                  { key: 'infantCare', label: '婴幼儿照护(月)', max: 2000 },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="text-sm text-primary-400 w-28 flex-shrink-0">
                      {item.label}
                    </span>
                    <input
                      type="number"
                      value={deductions.special[item.key as keyof typeof deductions.special]}
                      onChange={(e) =>
                        updateSpecialDeduction(
                          item.key as keyof typeof deductions.special,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      max={item.max}
                      className="flex-1 bg-primary-100/50 border border-primary-200/30 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 font-mono"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard className="text-center">
              <div className="p-3 rounded-xl bg-emerald-500/20 w-fit mx-auto mb-3">
                <TrendingDown className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm text-primary-400 mb-1">应纳税额</p>
              <p className="text-2xl font-display font-bold text-emerald-400">
                {formatCurrency(taxResult.taxAmount)}
              </p>
              <p className="text-xs text-primary-500 mt-2">
                有效税率 {formatPercent(taxResult.effectiveRate)}
              </p>
            </GlassCard>

            <GlassCard className="text-center">
              <div className="p-3 rounded-xl bg-sky-500/20 w-fit mx-auto mb-3">
                <FileText className="w-6 h-6 text-sky-400" />
              </div>
              <p className="text-sm text-primary-400 mb-1">应税所得</p>
              <p className="text-2xl font-display font-bold text-sky-400">
                {formatCurrency(taxResult.taxableIncome)}
              </p>
              <p className="text-xs text-primary-500 mt-2">
                {taxBracket.bracket}税率 {formatPercent(taxBracket.rate)}
              </p>
            </GlassCard>

            <GlassCard className="text-center">
              <div className="p-3 rounded-xl bg-amber-500/20 w-fit mx-auto mb-3">
                <Calculator className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-sm text-primary-400 mb-1">扣除总额</p>
              <p className="text-2xl font-display font-bold text-amber-400">
                {formatCurrency(totalDeductions)}
              </p>
              <p className="text-xs text-primary-500 mt-2">
                节税 {formatCurrency(totalDeductions * (taxBracket.rate / 100))}
              </p>
            </GlassCard>
          </div>

          <GlassCard>
            <h3 className="font-display font-semibold text-white mb-4">月度税额分布</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="month" stroke="#64748B" fontSize={12} tickLine={false} />
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
                  <Bar dataKey="tax" name="个税" radius={[4, 4, 0, 0]}>
                    {monthlyChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill="#3B82F6" fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      </div>

      <GlassCard>
        <button
          onClick={() => setShowOptimizations(!showOptimizations)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/20">
              <Lightbulb className="w-6 h-6 text-amber-400" />
            </div>
            <div className="text-left">
              <h3 className="font-display font-semibold text-white">税务优化建议</h3>
              <p className="text-sm text-primary-400">
                基于您的收入情况，发现 {optimizationSuggestions.length} 个可优化项
              </p>
            </div>
          </div>
          {showOptimizations ? (
            <ChevronUp className="w-5 h-5 text-primary-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-primary-400" />
          )}
        </button>

        {showOptimizations && (
          <div className="mt-6 space-y-4">
            {optimizationSuggestions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <Lightbulb className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-emerald-400 font-medium">您的税务结构已很优化！</p>
                <p className="text-sm text-primary-400 mt-1">继续保持良好的税务规划习惯</p>
              </div>
            ) : (
              optimizationSuggestions.map((suggestion, index) => (
                <OptimizationCard key={index} suggestion={suggestion} />
              ))
            )}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="font-display font-semibold text-white mb-4">税档速查表</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-primary-400">
                <th className="pb-3 font-medium">级数</th>
                <th className="pb-3 font-medium">全年应纳税所得额</th>
                <th className="pb-3 font-medium">税率</th>
                <th className="pb-3 font-medium">速算扣除数</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { level: 1, range: '不超过36,000元', rate: '3%', deduction: '0' },
                { level: 2, range: '36,000-144,000元', rate: '10%', deduction: '2,520' },
                { level: 3, range: '144,000-300,000元', rate: '20%', deduction: '16,920' },
                { level: 4, range: '300,000-420,000元', rate: '25%', deduction: '31,920' },
                { level: 5, range: '420,000-660,000元', rate: '30%', deduction: '52,920' },
                { level: 6, range: '660,000-960,000元', rate: '35%', deduction: '85,920' },
                { level: 7, range: '超过960,000元', rate: '45%', deduction: '181,920' },
              ].map((row) => (
                <tr
                  key={row.level}
                  className={`border-t border-primary-200/20 ${
                    taxBracket.bracket === `${row.level}档` ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <td className="py-3 text-white font-medium">{row.level}</td>
                  <td className="py-3 text-primary-300">{row.range}</td>
                  <td className="py-3 text-white font-mono">{row.rate}</td>
                  <td className="py-3 text-white font-mono">¥{row.deduction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

function OptimizationCard({ suggestion }: { suggestion: TaxOptimizationSuggestion }) {
  const priorityColors = {
    high: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  };

  const priorityLabels = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
  };

  return (
    <div className="p-4 rounded-xl bg-primary-100/30 hover:bg-primary-100/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-white">{suggestion.title}</h4>
            <span
              className={`px-2 py-0.5 rounded-full text-xs border ${priorityColors[suggestion.priority]}`}
            >
              {priorityLabels[suggestion.priority]}
            </span>
          </div>
          <p className="text-sm text-primary-400">{suggestion.description}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-primary-400 mb-1">预计节税</p>
          <p className="text-lg font-bold text-emerald-400 font-mono">
            {formatCurrency(suggestion.potentialSavings)}
          </p>
        </div>
      </div>
    </div>
  );
}
