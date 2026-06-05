import { Transaction, CashFlowAnalysis, InflationData } from '../types';

export class CashFlowEngine {
  static analyzeMonthly(transactions: Transaction[]): CashFlowAnalysis[] {
    const monthlyData: Record<string, CashFlowAnalysis> = {};

    transactions.forEach((tx) => {
      const date = new Date(tx.date);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[period]) {
        monthlyData[period] = {
          period,
          totalIncome: 0,
          totalExpense: 0,
          netCashFlow: 0,
          savingsRate: 0,
        };
      }

      if (tx.type === 'income') {
        monthlyData[period].totalIncome += tx.amount;
      } else {
        monthlyData[period].totalExpense += tx.amount;
      }
    });

    Object.values(monthlyData).forEach((data) => {
      data.netCashFlow = data.totalIncome - data.totalExpense;
      data.savingsRate = data.totalIncome > 0 
        ? (data.netCashFlow / data.totalIncome) * 100 
        : 0;
    });

    return Object.values(monthlyData).sort((a, b) => a.period.localeCompare(b.period));
  }

  static analyzeByCategory(transactions: Transaction[], type: 'income' | 'expense') {
    const categoryData: Record<string, number> = {};

    transactions
      .filter((tx) => tx.type === type)
      .forEach((tx) => {
        if (!categoryData[tx.categoryId]) {
          categoryData[tx.categoryId] = 0;
        }
        categoryData[tx.categoryId] += tx.amount;
      });

    return Object.entries(categoryData).map(([categoryId, amount]) => ({
      categoryId,
      amount,
    }));
  }

  static calculateTotalIncome(transactions: Transaction[]): number {
    return transactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }

  static calculateTotalExpense(transactions: Transaction[]): number {
    return transactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }

  static calculateNetCashFlow(transactions: Transaction[]): number {
    return this.calculateTotalIncome(transactions) - this.calculateTotalExpense(transactions);
  }

  static getMonthlyAverage(transactions: Transaction[], months?: number): {
    avgIncome: number;
    avgExpense: number;
    avgSavings: number;
  } {
    const monthlyData = this.analyzeMonthly(transactions);
    const recentData = months ? monthlyData.slice(-months) : monthlyData;

    if (recentData.length === 0) {
      return { avgIncome: 0, avgExpense: 0, avgSavings: 0 };
    }

    const totalIncome = recentData.reduce((sum, d) => sum + d.totalIncome, 0);
    const totalExpense = recentData.reduce((sum, d) => sum + d.totalExpense, 0);
    const count = recentData.length;

    return {
      avgIncome: totalIncome / count,
      avgExpense: totalExpense / count,
      avgSavings: (totalIncome - totalExpense) / count,
    };
  }

  static predictNextMonth(transactions: Transaction[]): {
    projectedIncome: number;
    projectedExpense: number;
    projectedSavings: number;
    confidence: number;
  } {
    const monthlyData = this.analyzeMonthly(transactions);
    
    if (monthlyData.length < 3) {
      return {
        projectedIncome: 0,
        projectedExpense: 0,
        projectedSavings: 0,
        confidence: 0,
      };
    }

    const recent3 = monthlyData.slice(-3);
    const recent6 = monthlyData.slice(-6);

    const avg3Income = recent3.reduce((s, d) => s + d.totalIncome, 0) / 3;
    const avg3Expense = recent3.reduce((s, d) => s + d.totalExpense, 0) / 3;
    const avg6Income = recent6.reduce((s, d) => s + d.totalIncome, 0) / Math.min(6, recent6.length);
    const avg6Expense = recent6.reduce((s, d) => s + d.totalExpense, 0) / Math.min(6, recent6.length);

    const projectedIncome = (avg3Income * 0.7 + avg6Income * 0.3);
    const projectedExpense = (avg3Expense * 0.7 + avg6Expense * 0.3);

    const variance = recent3.reduce((s, d) => {
      return s + Math.pow(d.totalIncome - avg3Income, 2) + Math.pow(d.totalExpense - avg3Expense, 2);
    }, 0) / (3 * 2);
    const stdDev = Math.sqrt(variance);
    const confidence = Math.max(0, 100 - (stdDev / projectedIncome) * 100);

    return {
      projectedIncome,
      projectedExpense,
      projectedSavings: projectedIncome - projectedExpense,
      confidence: Math.min(95, confidence),
    };
  }
}

export class InflationEngine {
  private static readonly DEFAULT_INFLATION_RATE = 0.025;

  static calculatePurchasingPower(
    initialAmount: number,
    years: number,
    inflationRate: number = this.DEFAULT_INFLATION_RATE
  ): InflationData[] {
    const results: InflationData[] = [];
    let cumulativeInflation = 1;

    for (let i = 0; i <= years; i++) {
      cumulativeInflation = Math.pow(1 + inflationRate, i);
      results.push({
        year: i,
        purchasingPower: initialAmount / cumulativeInflation,
        cumulativeInflation: (cumulativeInflation - 1) * 100,
      });
    }

    return results;
  }

  static calculateInflationAdjustedReturn(
    nominalReturn: number,
    inflationRate: number = this.DEFAULT_INFLATION_RATE
  ): number {
    return ((1 + nominalReturn) / (1 + inflationRate)) - 1;
  }

  static calculateFutureValueInTodayDollars(
    futureValue: number,
    years: number,
    inflationRate: number = this.DEFAULT_INFLATION_RATE
  ): number {
    return futureValue / Math.pow(1 + inflationRate, years);
  }

  static calculateRequiredReturnToBeatInflation(
    targetRealReturn: number,
    inflationRate: number = this.DEFAULT_INFLATION_RATE
  ): number {
    return (1 + targetRealReturn) * (1 + inflationRate) - 1;
  }

  static getHistoricalInflationData(): { year: number; rate: number }[] {
    return [
      { year: 2018, rate: 2.1 },
      { year: 2019, rate: 2.9 },
      { year: 2020, rate: 2.5 },
      { year: 2021, rate: 0.9 },
      { year: 2022, rate: 2.8 },
      { year: 2023, rate: 0.7 },
      { year: 2024, rate: 0.3 },
      { year: 2025, rate: 1.5 },
    ];
  }
}
