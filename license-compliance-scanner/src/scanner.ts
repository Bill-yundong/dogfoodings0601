import * as path from 'path';
import { parseProject } from './parsers';
import { detectConflicts } from './rules/rule-engine';
import { ScanResult } from './types';

export interface ScanOptions {
  projectPath: string;
  includeDev?: boolean;
  minRiskLevel?: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export function scanProject(options: ScanOptions): ScanResult {
  const projectPath = path.resolve(options.projectPath);

  const { allDependencies, rootDependencies } = parseProject(projectPath);

  const conflicts = detectConflicts(allDependencies, rootDependencies);

  const uniqueLicenses = [...new Set(allDependencies.map(d => d.spdxLicense))]
    .sort();

  const result: ScanResult = {
    projectPath,
    totalPackages: allDependencies.length,
    uniqueLicenses,
    conflicts,
    dependencies: allDependencies,
    scanTime: new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };

  return result;
}

export { detectConflicts };
