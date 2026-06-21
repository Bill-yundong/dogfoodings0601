export type LicenseSPDX = string;

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type PackageManager = 'npm' | 'pip' | 'go';

export interface Dependency {
  name: string;
  version: string;
  license: LicenseSPDX;
  packageManager: PackageManager;
  path: string;
  dependencyChain: string[];
}

export interface LicenseConflict {
  licenseA: LicenseSPDX;
  licenseB: LicenseSPDX;
  riskLevel: RiskLevel;
  description: string;
  packagesInvolved: Dependency[];
}

export interface ScanResult {
  projectPath: string;
  scannedFiles: string[];
  dependencies: Dependency[];
  conflicts: LicenseConflict[];
  summary: {
    totalPackages: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface LicenseInfo {
  spdx: LicenseSPDX;
  name: string;
  category: 'copyleft' | 'permissive' | 'weak-copyleft' | 'proprietary' | 'unknown';
  copyleftStrength: 'strong' | 'medium' | 'weak' | 'none';
}
