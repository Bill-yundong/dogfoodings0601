import { ScanResult, LicenseConflict, DependencyInfo, RiskLevel } from '../types';
import { getLicenseCategory, compareRiskLevels } from '../license-matrix';
import { getRiskLevelLabel } from '../rules/rule-engine';
import chalk from 'chalk';

export function generateReport(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗'));
  lines.push(chalk.bold.cyan('║              开源许可证合规扫描报告                          ║'));
  lines.push(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝'));
  lines.push('');

  lines.push(chalk.bold('📊 扫描概览'));
  lines.push('─'.repeat(60));
  lines.push(`  项目路径: ${result.projectPath}`);
  lines.push(`  扫描时间: ${result.scanTime}`);
  lines.push(`  依赖总数: ${chalk.yellow(result.totalPackages.toString())}`);
  lines.push(`  许可证种类: ${chalk.yellow(result.uniqueLicenses.length.toString())}`);
  lines.push(`  冲突数量: ${chalk.red(result.conflicts.length.toString())}`);
  lines.push('');

  const riskCounts = countByRiskLevel(result.conflicts);
  lines.push(chalk.bold('⚠️  风险等级分布'));
  lines.push('─'.repeat(60));
  lines.push(`  ${chalk.red.bold('严重 (Critical):')} ${riskCounts.critical}`);
  lines.push(`  ${chalk.red('高 (High):')}     ${riskCounts.high}`);
  lines.push(`  ${chalk.yellow('中 (Medium):')}   ${riskCounts.medium}`);
  lines.push(`  ${chalk.green('低 (Low):')}      ${riskCounts.low}`);
  lines.push(`  ${chalk.blue('信息 (Info):')}   ${riskCounts.info}`);
  lines.push('');

  lines.push(chalk.bold('📋 许可证分布'));
  lines.push('─'.repeat(60));
  const licenseCounts = countByLicense(result.dependencies);
  for (const [license, count] of Object.entries(licenseCounts).sort((a, b) => b[1] - a[1])) {
    const category = getLicenseCategory(license);
    const categoryColor = getCategoryColor(category);
    lines.push(`  ${license.padEnd(20)} ${colorize(category.padEnd(15), categoryColor)} ${count} 个包`);
  }
  lines.push('');

  if (result.conflicts.length > 0) {
    lines.push(chalk.bold.red('🚨 冲突详情'));
    lines.push('═'.repeat(60));
    lines.push('');

    let index = 1;
    for (const conflict of result.conflicts) {
      const riskColor = getRiskChalkColor(conflict.riskLevel);
      lines.push(colorizeBold(`  [${getRiskLevelLabel(conflict.riskLevel)}] #${index} ${conflict.title}`, riskColor));
      lines.push(`      ${conflict.description}`);
      lines.push('');

      lines.push('      涉及包:');
      for (const pkg of conflict.affectedPackages.slice(0, 10)) {
        lines.push(`        • ${pkg}`);
      }
      if (conflict.affectedPackages.length > 10) {
        lines.push(`        ... 还有 ${conflict.affectedPackages.length - 10} 个包`);
      }
      lines.push('');

      if (conflict.dependencyChains.length > 0) {
        lines.push('      依赖链:');
        for (const chain of conflict.dependencyChains.slice(0, 3)) {
          lines.push(`        ${chain.join(' → ')}`);
        }
        if (conflict.dependencyChains.length > 3) {
          lines.push(`        ... 还有 ${conflict.dependencyChains.length - 3} 条依赖链`);
        }
        lines.push('');
      }

      index++;
    }
  } else {
    lines.push(chalk.bold.green('✅ 恭喜！未检测到许可证冲突'));
    lines.push('');
  }

  lines.push(chalk.bold('📦 完整依赖列表'));
  lines.push('─'.repeat(60));

  const sortedDeps = [...result.dependencies].sort((a, b) => {
    const pmCompare = a.packageManager.localeCompare(b.packageManager);
    if (pmCompare !== 0) return pmCompare;
    return a.name.localeCompare(b.name);
  });

  let currentPm = '';
  for (const dep of sortedDeps) {
    if (dep.packageManager !== currentPm) {
      currentPm = dep.packageManager;
      lines.push('');
      lines.push(chalk.bold(`  [${currentPm.toUpperCase()}]`));
    }
    const category = getLicenseCategory(dep.spdxLicense);
    const categoryColor = getCategoryColor(category);
    lines.push(`    • ${dep.name.padEnd(35)} v${dep.version.padEnd(12)} ${colorize(dep.spdxLicense, categoryColor)}`);
  }
  lines.push('');

  lines.push(chalk.gray('─'.repeat(60)));
  lines.push(chalk.gray('  提示: 本工具基于预定义的许可证兼容性矩阵进行分析，'));
  lines.push(chalk.gray('        结果仅供参考，重要项目请咨询专业法律意见。'));
  lines.push('');

  return lines.join('\n');
}

function countByRiskLevel(conflicts: LicenseConflict[]): Record<RiskLevel, number> {
  const counts: Record<RiskLevel, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const conflict of conflicts) {
    counts[conflict.riskLevel]++;
  }

  return counts;
}

function countByLicense(dependencies: DependencyInfo[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const dep of dependencies) {
    counts[dep.spdxLicense] = (counts[dep.spdxLicense] || 0) + 1;
  }

  return counts;
}

type ChalkColor = 'green' | 'red' | 'yellow' | 'blue' | 'magenta' | 'gray' | 'cyan' | 'white';

function getCategoryColor(category: string): ChalkColor {
  const colorMap: Record<string, ChalkColor> = {
    'Permissive': 'green',
    'Public Domain': 'green',
    'Weak Copyleft': 'yellow',
    'Strong Copyleft': 'red',
    'Network Copyleft': 'red',
    'Source Available': 'magenta',
    'Unknown': 'gray',
    'Boost Software': 'green',
  };
  return colorMap[category] || 'gray';
}

function getRiskChalkColor(riskLevel: RiskLevel): ChalkColor {
  const colorMap: Record<RiskLevel, ChalkColor> = {
    critical: 'red',
    high: 'red',
    medium: 'yellow',
    low: 'green',
    info: 'blue',
  };
  return colorMap[riskLevel];
}

function colorize(text: string, color: ChalkColor): string {
  const chalkAny = chalk as any;
  return chalkAny[color] ? chalkAny[color](text) : text;
}

function colorizeBold(text: string, color: ChalkColor): string {
  const chalkAny = chalk as any;
  return chalkAny[color]?.bold ? chalkAny[color].bold(text) : text;
}

export function generateJsonReport(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function generateSummary(result: ScanResult): {
  totalPackages: number;
  uniqueLicenses: number;
  totalConflicts: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  hasIssues: boolean;
} {
  const riskCounts = countByRiskLevel(result.conflicts);
  return {
    totalPackages: result.totalPackages,
    uniqueLicenses: result.uniqueLicenses.length,
    totalConflicts: result.conflicts.length,
    criticalCount: riskCounts.critical,
    highCount: riskCounts.high,
    mediumCount: riskCounts.medium,
    lowCount: riskCounts.low,
    infoCount: riskCounts.info,
    hasIssues: riskCounts.critical > 0 || riskCounts.high > 0,
  };
}
