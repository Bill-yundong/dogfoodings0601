export type PackageManagerType = 'npm' | 'pip' | 'go';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface DependencyInfo {
  name: string;
  version: string;
  license: string;
  spdxLicense: string;
  packageManager: PackageManagerType;
  path: string;
}

export interface DependencyNode {
  name: string;
  version: string;
  license: string;
  spdxLicense: string;
  packageManager: PackageManagerType;
  children: DependencyNode[];
  depth: number;
}

export interface LicenseConflict {
  id: string;
  riskLevel: RiskLevel;
  title: string;
  description: string;
  affectedPackages: string[];
  dependencyChains: string[][];
  licenseA: string;
  licenseB: string;
}

export interface ScanResult {
  projectPath: string;
  totalPackages: number;
  uniqueLicenses: string[];
  conflicts: LicenseConflict[];
  dependencies: DependencyInfo[];
  scanTime: string;
}

export interface ParserResult {
  packageManager: PackageManagerType;
  rootDependencies: DependencyNode[];
  allDependencies: DependencyInfo[];
}

export interface LicenseCompatibilityRule {
  licenseA: string;
  licenseB: string;
  compatible: boolean;
  riskLevel: RiskLevel;
  description: string;
}
