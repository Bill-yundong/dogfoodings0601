import { SimulationConfig, SimulationDataPoint, MonteCarloResult } from '../types';

export interface ScenarioConfig {
  name: string;
  rateAdjustment: number;
  color: string;
}

export interface MultiScenarioResult {
  scenario: string;
  color: string;
  data: SimulationDataPoint[];
}

export interface SimulationProgress {
  progress: number;
  status: string;
}

const DEFAULT_SCENARIOS: ScenarioConfig[] = [
  { name: '保守', rateAdjustment: -0.02, color: '#3B82F6' },
  { name: '基准', rateAdjustment: 0, color: '#10B981' },
  { name: '乐观', rateAdjustment: 0.02, color: '#F59E0B' },
  { name: '激进', rateAdjustment: 0.05, color: '#EF4444' },
];

export class CompoundEngine {
  static calculateCompoundInterest(
    principal: number,
    rate: number,
    years: number,
    compoundFrequency: 'annually' | 'quarterly' | 'monthly' | 'daily' = 'annually',
    monthlyContribution: number = 0,
    inflationRate: number = 0.025
  ): SimulationDataPoint[] {
    const frequencyMap: Record<string, number> = {
      annually: 1,
      quarterly: 4,
      monthly: 12,
      daily: 365,
    };

    const n = frequencyMap[compoundFrequency];
    const periodicRate = rate / n;
    const periodicContribution = monthlyContribution * (12 / n);

    const results: SimulationDataPoint[] = [];
    let totalContributions = principal;

    for (let year = 0; year <= years; year++) {
      const periods = year * n;
      
      let nominalValue = principal * Math.pow(1 + periodicRate, periods);
      
      if (periodicContribution > 0 && periods > 0) {
        const futureValueAnnuity = periodicContribution * 
          ((Math.pow(1 + periodicRate, periods) - 1) / periodicRate);
        nominalValue += futureValueAnnuity;
      }

      totalContributions = principal + (monthlyContribution * 12 * year);
      const totalInterest = nominalValue - totalContributions;
      const realValue = nominalValue / Math.pow(1 + inflationRate, year);

      results.push({
        year,
        nominalValue: Math.round(nominalValue * 100) / 100,
        realValue: Math.round(realValue * 100) / 100,
        totalContributions: Math.round(totalContributions * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
      });
    }

    return results;
  }

  static calculateMultiScenario(
    config: Omit<SimulationConfig, 'id' | 'createdAt'>
  ): MultiScenarioResult[] {
    return DEFAULT_SCENARIOS.map((scenario) => {
      const adjustedRate = config.rate + scenario.rateAdjustment;
      const data = this.calculateCompoundInterest(
        config.principal,
        Math.max(0, adjustedRate),
        config.years,
        config.compoundFrequency,
        config.monthlyContribution,
        config.inflationRate
      );

      return {
        scenario: scenario.name,
        color: scenario.color,
        data,
      };
    });
  }

  static runMonteCarloSimulation(
    principal: number,
    years: number,
    expectedReturn: number,
    volatility: number,
    simulations: number = 1000,
    monthlyContribution: number = 0
  ): MonteCarloResult[] {
    const results: number[] = [];
    const monthlyReturn = expectedReturn / 12;
    const monthlyVolatility = volatility / Math.sqrt(12);

    for (let i = 0; i < simulations; i++) {
      let value = principal;
      
      for (let month = 0; month < years * 12; month++) {
        const randomReturn = this.generateRandomNormal(monthlyReturn, monthlyVolatility);
        value = value * (1 + randomReturn) + monthlyContribution;
      }
      
      results.push(Math.max(0, value));
    }

    results.sort((a, b) => a - b);

    const percentiles: MonteCarloResult[] = [];
    const percentilePoints = [10, 25, 50, 75, 90];
    
    percentilePoints.forEach((p, index) => {
      const pos = Math.floor((simulations - 1) * (p / 100));
      percentiles.push({
        scenario: index,
        finalValue: Math.round(results[pos] * 100) / 100,
        probability: p,
      });
    });

    return percentiles;
  }

  private static generateRandomNormal(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + stdDev * z;
  }

  static async runAsyncSimulation(
    config: Omit<SimulationConfig, 'id' | 'createdAt'>,
    onProgress?: (progress: SimulationProgress) => void
  ): Promise<MultiScenarioResult[]> {
    return new Promise((resolve) => {
      const totalSteps = 4;
      let currentStep = 0;

      const results = DEFAULT_SCENARIOS.map((scenario, index) => {
        setTimeout(() => {
          currentStep++;
          onProgress?.({
            progress: (currentStep / totalSteps) * 100,
            status: `正在计算 ${scenario.name} 情景...`,
          });
        }, index * 100);

        const adjustedRate = config.rate + scenario.rateAdjustment;
        const data = this.calculateCompoundInterest(
          config.principal,
          Math.max(0, adjustedRate),
          config.years,
          config.compoundFrequency,
          config.monthlyContribution,
          config.inflationRate
        );

        return {
          scenario: scenario.name,
          color: scenario.color,
          data,
        };
      });

      setTimeout(() => {
        onProgress?.({ progress: 100, status: '模拟完成' });
        resolve(results);
      }, 500);
    });
  }

  static calculateTimeToGoal(
    principal: number,
    targetAmount: number,
    rate: number,
    monthlyContribution: number = 0
  ): number {
    if (principal >= targetAmount) return 0;

    const monthlyRate = rate / 12;
    let months = 0;
    let value = principal;

    while (value < targetAmount && months < 1200) {
      value = value * (1 + monthlyRate) + monthlyContribution;
      months++;
    }

    return months / 12;
  }

  static calculateRequiredReturn(
    principal: number,
    targetAmount: number,
    years: number,
    monthlyContribution: number = 0
  ): number {
    let low = 0;
    let high = 1;
    let mid = 0.5;

    for (let i = 0; i < 100; i++) {
      mid = (low + high) / 2;
      const result = this.calculateCompoundInterest(
        principal,
        mid,
        years,
        'monthly',
        monthlyContribution
      );
      const finalValue = result[result.length - 1].nominalValue;

      if (Math.abs(finalValue - targetAmount) < 1) break;
      
      if (finalValue < targetAmount) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return Math.round(mid * 10000) / 100;
  }

  static getWithdrawalRateAnalysis(
    portfolio: number,
    withdrawalRate: number,
    years: number,
    expectedReturn: number,
    inflationRate: number
  ): { year: number; balance: number; withdrawal: number }[] {
    const results = [];
    let balance = portfolio;
    const annualWithdrawal = portfolio * (withdrawalRate / 100);

    for (let year = 0; year <= years; year++) {
      const inflationAdjustedWithdrawal = annualWithdrawal * Math.pow(1 + inflationRate, year);
      
      results.push({
        year,
        balance: Math.round(Math.max(0, balance) * 100) / 100,
        withdrawal: Math.round(inflationAdjustedWithdrawal * 100) / 100,
      });

      balance = (balance - inflationAdjustedWithdrawal) * (1 + expectedReturn);
    }

    return results;
  }

  static generate3DChartData(
    minPrincipal: number,
    maxPrincipal: number,
    minRate: number,
    maxRate: number,
    years: number
  ): { principal: number; rate: number; value: number }[] {
    const data: { principal: number; rate: number; value: number }[] = [];
    const steps = 20;

    for (let i = 0; i <= steps; i++) {
      const principal = minPrincipal + (maxPrincipal - minPrincipal) * (i / steps);
      
      for (let j = 0; j <= steps; j++) {
        const rate = minRate + (maxRate - minRate) * (j / steps);
        const result = this.calculateCompoundInterest(principal, rate, years, 'annually', 0, 0);
        
        data.push({
          principal,
          rate: rate * 100,
          value: result[result.length - 1].nominalValue,
        });
      }
    }

    return data;
  }
}

export function formatCurrency(value: number, currency: string = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
