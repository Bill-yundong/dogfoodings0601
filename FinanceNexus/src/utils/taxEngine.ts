import { SpecialDeductions, TaxDeductions } from '../types';

export interface TaxResult {
  taxableIncome: number;
  taxAmount: number;
  effectiveRate: number;
  monthlyBreakdown: MonthlyTax[];
}

export interface MonthlyTax {
  month: number;
  cumulativeIncome: number;
  cumulativeDeductions: number;
  cumulativeTaxable: number;
  cumulativeTax: number;
  monthlyTax: number;
  netIncome: number;
}

export interface TaxOptimizationSuggestion {
  category: string;
  title: string;
  description: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
}

const TAX_BRACKETS = [
  { min: 0, max: 36000, rate: 0.03, deduction: 0 },
  { min: 36000, max: 144000, rate: 0.10, deduction: 2520 },
  { min: 144000, max: 300000, rate: 0.20, deduction: 16920 },
  { min: 300000, max: 420000, rate: 0.25, deduction: 31920 },
  { min: 420000, max: 660000, rate: 0.30, deduction: 52920 },
  { min: 660000, max: 960000, rate: 0.35, deduction: 85920 },
  { min: 960000, max: Infinity, rate: 0.45, deduction: 181920 },
];

const STANDARD_DEDUCTION = 60000;
const MONTHLY_STANDARD_DEDUCTION = 5000;

export class TaxEngine {
  static calculateAnnualTax(
    annualIncome: number,
    deductions: TaxDeductions
  ): TaxResult {
    const totalDeductions = this.calculateTotalDeductions(deductions);
    const taxableIncome = Math.max(0, annualIncome - totalDeductions);
    
    const taxAmount = this.calculateProgressiveTax(taxableIncome);
    
    return {
      taxableIncome,
      taxAmount,
      effectiveRate: annualIncome > 0 ? (taxAmount / annualIncome) * 100 : 0,
      monthlyBreakdown: this.calculateMonthlyBreakdown(annualIncome, deductions),
    };
  }

  static calculateMonthlyBreakdown(
    annualIncome: number,
    deductions: TaxDeductions
  ): MonthlyTax[] {
    const monthlyIncome = annualIncome / 12;
    const monthlyDeductions = this.calculateMonthlyDeductions(deductions);
    const breakdown: MonthlyTax[] = [];

    let cumulativeIncome = 0;
    let cumulativeDeductions = 0;
    let cumulativeTax = 0;

    for (let month = 1; month <= 12; month++) {
      cumulativeIncome += monthlyIncome;
      cumulativeDeductions += monthlyDeductions;
      
      const cumulativeTaxable = Math.max(0, cumulativeIncome - cumulativeDeductions);
      const newCumulativeTax = this.calculateProgressiveTax(cumulativeTaxable);
      const monthlyTax = Math.max(0, newCumulativeTax - cumulativeTax);
      cumulativeTax = newCumulativeTax;

      breakdown.push({
        month,
        cumulativeIncome: Math.round(cumulativeIncome * 100) / 100,
        cumulativeDeductions: Math.round(cumulativeDeductions * 100) / 100,
        cumulativeTaxable: Math.round(cumulativeTaxable * 100) / 100,
        cumulativeTax: Math.round(cumulativeTax * 100) / 100,
        monthlyTax: Math.round(monthlyTax * 100) / 100,
        netIncome: Math.round((monthlyIncome - monthlyTax) * 100) / 100,
      });
    }

    return breakdown;
  }

  static calculateProgressiveTax(taxableIncome: number): number {
    for (let i = TAX_BRACKETS.length - 1; i >= 0; i--) {
      if (taxableIncome > TAX_BRACKETS[i].min) {
        return taxableIncome * TAX_BRACKETS[i].rate - TAX_BRACKETS[i].deduction;
      }
    }
    return 0;
  }

  static calculateTotalDeductions(deductions: TaxDeductions): number {
    return (
      deductions.basic +
      deductions.socialInsurance * 12 +
      deductions.housingFund * 12 +
      this.calculateSpecialDeductions(deductions.special)
    );
  }

  static calculateMonthlyDeductions(deductions: TaxDeductions): number {
    return (
      MONTHLY_STANDARD_DEDUCTION +
      deductions.socialInsurance +
      deductions.housingFund +
      this.calculateSpecialDeductions(deductions.special) / 12
    );
  }

  static calculateSpecialDeductions(special: SpecialDeductions): number {
    return (
      special.childrenEducation * 12 +
      special.continuingEducation +
      special.medicalTreatment +
      special.housingLoan * 12 +
      special.housingRent * 12 +
      special.elderlyCare * 12 +
      special.infantCare * 12
    );
  }

  static calculateMonthlyTax(
    monthlyIncome: number,
    previousIncome: number,
    previousTax: number,
    monthlyDeductions: number
  ): number {
    const cumulativeIncome = previousIncome + monthlyIncome;
    const cumulativeDeductions = monthlyDeductions * (Math.floor(previousIncome / monthlyIncome) + 1);
    const cumulativeTaxable = Math.max(0, cumulativeIncome - cumulativeDeductions);
    const cumulativeTax = this.calculateProgressiveTax(cumulativeTaxable);
    
    return Math.max(0, cumulativeTax - previousTax);
  }

  static calculateBonusTax(bonus: number, monthlyIncome: number): number {
    const monthlyBonus = bonus / 12;
    const combinedMonthly = monthlyIncome + monthlyBonus;
    
    let monthlyRate = 0;
    for (const bracket of TAX_BRACKETS) {
      if (combinedMonthly * 12 > bracket.min) {
        monthlyRate = bracket.rate;
      }
    }

    return bonus * monthlyRate;
  }

  static getOptimizationSuggestions(
    annualIncome: number,
    deductions: TaxDeductions
  ): TaxOptimizationSuggestion[] {
    const suggestions: TaxOptimizationSuggestion[] = [];
    const currentTax = this.calculateAnnualTax(annualIncome, deductions);

    if (deductions.special.childrenEducation < 2000 && annualIncome > 100000) {
      const newDeductions = {
        ...deductions,
        special: { ...deductions.special, childrenEducation: 2000 },
      };
      const newTax = this.calculateAnnualTax(annualIncome, newDeductions);
      suggestions.push({
        category: '子女教育',
        title: '最大化子女教育扣除',
        description: '每个子女每月可扣除1000-2000元，确保充分利用此项扣除。',
        potentialSavings: Math.round(currentTax.taxAmount - newTax.taxAmount),
        priority: 'high',
      });
    }

    if (deductions.housingFund < annualIncome * 0.12 / 12) {
      const optimalHousingFund = Math.min(annualIncome * 0.12 / 12, 5000);
      const newDeductions = {
        ...deductions,
        housingFund: optimalHousingFund,
      };
      const newTax = this.calculateAnnualTax(annualIncome, newDeductions);
      suggestions.push({
        category: '住房公积金',
        title: '优化住房公积金缴纳比例',
        description: '公积金缴纳可在5%-12%之间调整，提高比例可增加税前扣除。',
        potentialSavings: Math.round(currentTax.taxAmount - newTax.taxAmount),
        priority: 'high',
      });
    }

    if (deductions.special.elderlyCare < 3000 && annualIncome > 100000) {
      const newDeductions = {
        ...deductions,
        special: { ...deductions.special, elderlyCare: 3000 },
      };
      const newTax = this.calculateAnnualTax(annualIncome, newDeductions);
      suggestions.push({
        category: '赡养老人',
        title: '充分利用赡养老人扣除',
        description: '独生子女每月可扣除3000元，非独生子女分摊扣除。',
        potentialSavings: Math.round(currentTax.taxAmount - newTax.taxAmount),
        priority: 'medium',
      });
    }

    if (deductions.special.continuingEducation < 4800 && annualIncome > 80000) {
      const newDeductions = {
        ...deductions,
        special: { ...deductions.special, continuingEducation: 4800 },
      };
      const newTax = this.calculateAnnualTax(annualIncome, newDeductions);
      suggestions.push({
        category: '继续教育',
        title: '考虑继续教育支出',
        description: '学历教育每年可扣除4800元，职业资格教育可扣除3600元。',
        potentialSavings: Math.round(currentTax.taxAmount - newTax.taxAmount),
        priority: 'low',
      });
    }

    if (annualIncome > 500000) {
      suggestions.push({
        category: '税务筹划',
        title: '考虑设立个人独资企业',
        description: '高收入人群可考虑通过合规方式优化税务结构，建议咨询专业税务顾问。',
        potentialSavings: Math.round(currentTax.taxAmount * 0.15),
        priority: 'high',
      });
    }

    return suggestions
      .filter((s) => s.potentialSavings > 0)
      .sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  static getTaxBracketInfo(income: number): {
    bracket: string;
    rate: number;
    maxOfBracket: number;
  } {
    for (let i = TAX_BRACKETS.length - 1; i >= 0; i--) {
      if (income > TAX_BRACKETS[i].min) {
        return {
          bracket: `${i + 1}档`,
          rate: TAX_BRACKETS[i].rate * 100,
          maxOfBracket: TAX_BRACKETS[i].max,
        };
      }
    }
    return { bracket: '免税', rate: 0, maxOfBracket: 36000 };
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(amount);
  }
}
