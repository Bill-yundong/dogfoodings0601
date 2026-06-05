export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  date: string;
  tags: string[];
  description: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
}

export interface Asset {
  id: string;
  name: string;
  typeId: string;
  value: number;
  growthRate: number;
  acquiredDate: string;
}

export interface AssetType {
  id: string;
  name: string;
  riskLevel: number;
  expectedReturn: number;
}

export interface TaxRecord {
  id: string;
  income: number;
  deductions: TaxDeductions;
  taxAmount: number;
  period: string;
  createdAt: number;
}

export interface TaxDeductions {
  basic: number;
  socialInsurance: number;
  housingFund: number;
  special: SpecialDeductions;
}

export interface SpecialDeductions {
  childrenEducation: number;
  continuingEducation: number;
  medicalTreatment: number;
  housingLoan: number;
  housingRent: number;
  elderlyCare: number;
  infantCare: number;
}

export interface SimulationConfig {
  id: string;
  principal: number;
  rate: number;
  years: number;
  inflationRate: number;
  compoundFrequency: 'annually' | 'quarterly' | 'monthly' | 'daily';
  monthlyContribution: number;
  createdAt: number;
}

export interface SimulationResult {
  id: string;
  configId: string;
  data: SimulationDataPoint[];
  monteCarloResults?: MonteCarloResult[];
  createdAt: number;
}

export interface SimulationDataPoint {
  year: number;
  nominalValue: number;
  realValue: number;
  totalContributions: number;
  totalInterest: number;
}

export interface MonteCarloResult {
  scenario: number;
  finalValue: number;
  probability: number;
}

export interface CashFlowAnalysis {
  period: string;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  savingsRate: number;
}

export interface InflationData {
  year: number;
  purchasingPower: number;
  cumulativeInflation: number;
}

export interface AppSettings {
  currency: string;
  theme: 'dark' | 'light';
  encryptionEnabled: boolean;
  autoBackup: boolean;
}

export interface EncryptionMeta {
  id: string;
  salt: string;
  iv: string;
  iterations: number;
  createdAt: number;
}
