import * as fs from 'fs';
import * as path from 'path';
import { Dependency, ScanResult, LicenseConflict, RiskLevel } from './types';
import { ParserRegistry } from './parsers';
import { ConflictDetector } from './rules-engine';
import { RISK_LEVEL_ORDER, getLicenseInfo } from './license-matrix';

export class LicenseScanner {
  private parserRegistry: ParserRegistry;
  private conflictDetector: ConflictDetector;

  constructor() {
    this.parserRegistry = new ParserRegistry();
    this.conflictDetector = new ConflictDetector();
  }

  async scan(projectPath: string): Promise<ScanResult> {
    const absolutePath = path.resolve(projectPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Project path does not exist: ${absolutePath}`);
    }

    const manifestFiles = await this.findManifestFiles(absolutePath);
    const allDependencies: Dependency[] = [];
    const scannedFiles: string[] = [];

    for (const filePath of manifestFiles) {
      const parser = this.parserRegistry.getParser(filePath);
      if (!parser) continue;

      try {
        const deps = await parser.parse(filePath);
        allDependencies.push(...deps);
        scannedFiles.push(filePath);
      } catch (error) {
        console.error(`Warning: Failed to parse ${filePath}:`, error);
      }
    }

    const uniqueDeps = this.deduplicateDependencies(allDependencies);
    const conflicts = this.conflictDetector.detectConflicts(uniqueDeps);
    const infectionReport = this.conflictDetector.detectCopyleftInfection(uniqueDeps);

    const summary = this.buildSummary(uniqueDeps, conflicts);

    if (infectionReport.infected && infectionReport.strongestCopyleft) {
      const existingConflict = conflicts.find(
        c => c.licenseA === infectionReport.strongestCopyleft || c.licenseB === infectionReport.strongestCopyleft
      );
      if (!existingConflict) {
        conflicts.push({
          licenseA: infectionReport.strongestCopyleft,
          licenseB: 'Project',
          riskLevel: 'high',
          description: `Copyleft infection detected: ${infectionReport.strongestCopyleft} requires the entire project to be licensed under compatible terms. Affected packages: ${infectionReport.copyleftPackages.length}`,
          packagesInvolved: infectionReport.copyleftPackages,
        });
        this.sortConflicts(conflicts);
      }
    }

    return {
      projectPath: absolutePath,
      scannedFiles,
      dependencies: uniqueDeps,
      conflicts,
      summary,
    };
  }

  private async findManifestFiles(projectPath: string): Promise<string[]> {
    const manifestFiles: string[] = [];
    const targetFiles = ['package.json', 'requirements.txt', 'go.mod'];

    const stack = [projectPath];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      try {
        const entries = await fs.promises.readdir(current, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(current, entry.name);

          if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' ||
                entry.name === 'build' || entry.name === 'venv' || entry.name === '.venv' ||
                entry.name === 'env' || entry.name === 'vendor') {
              continue;
            }
            stack.push(fullPath);
          } else if (entry.isFile()) {
            if (targetFiles.includes(entry.name.toLowerCase())) {
              manifestFiles.push(fullPath);
            } else if (entry.name.toLowerCase().endsWith('.txt') && entry.name.toLowerCase().includes('require')) {
              manifestFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    return manifestFiles;
  }

  private deduplicateDependencies(deps: Dependency[]): Dependency[] {
    const seen = new Map<string, Dependency>();

    for (const dep of deps) {
      const key = `${dep.packageManager}:${dep.name}:${dep.version}`;
      if (!seen.has(key)) {
        seen.set(key, dep);
      }
    }

    return Array.from(seen.values());
  }

  private sortConflicts(conflicts: LicenseConflict[]): void {
    conflicts.sort((a, b) => RISK_LEVEL_ORDER[a.riskLevel] - RISK_LEVEL_ORDER[b.riskLevel]);
  }

  private buildSummary(dependencies: Dependency[], conflicts: LicenseConflict[]): ScanResult['summary'] {
    const summary = {
      totalPackages: dependencies.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const conflict of conflicts) {
      summary[conflict.riskLevel]++;
    }

    for (const dep of dependencies) {
      const info = getLicenseInfo(dep.license);
      if (info.copyleftStrength === 'strong' && summary.high === 0) {
        summary.high++;
      }
    }

    return summary;
  }
}

export class ReportGenerator {
  generateConsoleReport(result: ScanResult): string {
    const lines: string[] = [];

    lines.push(this.formatHeader());
    lines.push('');
    lines.push(`Project Path: ${result.projectPath}`);
    lines.push(`Scanned Files: ${result.scannedFiles.length}`);
    lines.push(`Total Dependencies: ${result.summary.totalPackages}`);
    lines.push('');

    lines.push(this.formatSection('SUMMARY'));
    lines.push(this.formatSummary(result));
    lines.push('');

    if (result.conflicts.length > 0) {
      lines.push(this.formatSection('LICENSE CONFLICTS (by risk)'));
      lines.push('');

      for (const conflict of result.conflicts) {
        lines.push(this.formatConflict(conflict));
        lines.push('');
      }
    } else {
      lines.push(this.formatSection('LICENSE STATUS'));
      lines.push('');
      lines.push(this.colorize('✓ No critical or high-risk license conflicts detected.', 'green'));
      lines.push('');
    }

    lines.push(this.formatSection('DEPENDENCIES BY LICENSE'));
    lines.push('');
    lines.push(this.formatDependenciesByLicense(result.dependencies));
    lines.push('');

    return lines.join('\n');
  }

  private formatHeader(): string {
    return `
╔══════════════════════════════════════════════════════════════╗
║           OPEN SOURCE LICENSE COMPLIANCE SCANNER            ║
╚══════════════════════════════════════════════════════════════╝`;
  }

  private formatSection(title: string): string {
    return `━━━ ${title} ${'━'.repeat(Math.max(0, 50 - title.length))}`;
  }

  private formatSummary(result: ScanResult): string {
    const lines: string[] = [];
    const s = result.summary;

    lines.push(`  ${this.colorize('CRITICAL', 'red')}: ${s.critical}    ${this.colorize('HIGH', 'yellow')}: ${s.high}    ${this.colorize('MEDIUM', 'cyan')}: ${s.medium}    ${this.colorize('LOW', 'green')}: ${s.low}`);

    return lines.join('\n');
  }

  private formatConflict(conflict: LicenseConflict): string {
    const lines: string[] = [];

    const riskColor = this.getRiskColor(conflict.riskLevel);
    const riskBadge = this.colorize(`[${conflict.riskLevel.toUpperCase()}]`, riskColor);

    lines.push(`  ${riskBadge} ${conflict.licenseA} ↔ ${conflict.licenseB}`);
    lines.push(`      ${conflict.description}`);
    lines.push('');
    lines.push(`      Packages involved (${conflict.packagesInvolved.length}):`);

    for (const pkg of conflict.packagesInvolved.slice(0, 10)) {
      lines.push(`        • ${this.formatPackage(pkg)}`);
      lines.push(`          ${this.formatDependencyChain(pkg.dependencyChain)}`);
    }

    if (conflict.packagesInvolved.length > 10) {
      lines.push(`        ... and ${conflict.packagesInvolved.length - 10} more`);
    }

    return lines.join('\n');
  }

  private formatPackage(dep: Dependency): string {
    const licenseInfo = getLicenseInfo(dep.license);
    const licenseBadge = this.colorize(dep.license, this.getLicenseColor(licenseInfo.category));
    return `${dep.name}@${dep.version} (${licenseBadge}) [${dep.packageManager}]`;
  }

  private formatDependencyChain(chain: string[]): string {
    if (chain.length <= 1) return '';
    return `  └─ ${chain.join(' → ')}`;
  }

  private formatDependenciesByLicense(dependencies: Dependency[]): string {
    const byLicense = new Map<string, Dependency[]>();

    for (const dep of dependencies) {
      if (!byLicense.has(dep.license)) {
        byLicense.set(dep.license, []);
      }
      byLicense.get(dep.license)!.push(dep);
    }

    const sortedLicenses = Array.from(byLicense.keys()).sort((a, b) => {
      const infoA = getLicenseInfo(a);
      const infoB = getLicenseInfo(b);
      const strengthOrder: Record<string, number> = { strong: 0, medium: 1, weak: 2, none: 3 };
      return strengthOrder[infoA.copyleftStrength] - strengthOrder[infoB.copyleftStrength];
    });

    const lines: string[] = [];

    for (const license of sortedLicenses) {
      const pkgs = byLicense.get(license)!;
      const info = getLicenseInfo(license);
      const color = this.getLicenseColor(info.category);

      lines.push(`  ${this.colorize(license, color)} (${info.name}) [${info.category}] — ${pkgs.length} package(s):`);

      for (const pkg of pkgs.slice(0, 5)) {
        lines.push(`    • ${pkg.name}@${pkg.version} [${pkg.packageManager}]`);
      }

      if (pkgs.length > 5) {
        lines.push(`    ... and ${pkgs.length - 5} more`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  private getRiskColor(level: RiskLevel): string {
    switch (level) {
      case 'critical': return 'red';
      case 'high': return 'yellow';
      case 'medium': return 'cyan';
      case 'low': return 'green';
      case 'info': return 'gray';
    }
  }

  private getLicenseColor(category: string): string {
    switch (category) {
      case 'copyleft': return 'red';
      case 'weak-copyleft': return 'yellow';
      case 'permissive': return 'green';
      case 'proprietary': return 'magenta';
      default: return 'gray';
    }
  }

  private colorize(text: string, color: string): string {
    const colors: Record<string, string> = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m',
      white: '\x1b[37m',
    };
    const reset = '\x1b[0m';
    return `${colors[color] || ''}${text}${reset}`;
  }

  generateJsonReport(result: ScanResult): string {
    return JSON.stringify(result, null, 2);
  }

  generateMarkdownReport(result: ScanResult): string {
    const lines: string[] = [];

    lines.push('# Open Source License Compliance Report');
    lines.push('');
    lines.push(`- **Project Path**: \`${result.projectPath}\``);
    lines.push(`- **Scanned Files**: ${result.scannedFiles.length}`);
    lines.push(`- **Total Dependencies**: ${result.summary.totalPackages}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push('| Risk Level | Count |');
    lines.push('|------------|-------|');
    lines.push(`| CRITICAL | ${result.summary.critical} |`);
    lines.push(`| HIGH | ${result.summary.high} |`);
    lines.push(`| MEDIUM | ${result.summary.medium} |`);
    lines.push(`| LOW | ${result.summary.low} |`);
    lines.push('');

    if (result.conflicts.length > 0) {
      lines.push('## License Conflicts');
      lines.push('');

      for (const conflict of result.conflicts) {
        lines.push(`### [${conflict.riskLevel.toUpperCase()}] ${conflict.licenseA} ↔ ${conflict.licenseB}`);
        lines.push('');
        lines.push(`> ${conflict.description}`);
        lines.push('');
        lines.push('**Packages Involved:**');
        lines.push('');

        for (const pkg of conflict.packagesInvolved) {
          lines.push(`- \`${pkg.name}@${pkg.version}\` (${pkg.license}) [${pkg.packageManager}]`);
          lines.push(`  - Chain: \`${pkg.dependencyChain.join(' → ')}\``);
        }
        lines.push('');
      }
    }

    lines.push('## Dependencies by License');
    lines.push('');

    const byLicense = new Map<string, Dependency[]>();
    for (const dep of result.dependencies) {
      if (!byLicense.has(dep.license)) {
        byLicense.set(dep.license, []);
      }
      byLicense.get(dep.license)!.push(dep);
    }

    for (const [license, pkgs] of byLicense.entries()) {
      const info = getLicenseInfo(license);
      lines.push(`### ${license} (${info.name})`);
      lines.push('');
      lines.push(`- **Category**: ${info.category}`);
      lines.push(`- **Copyleft Strength**: ${info.copyleftStrength}`);
      lines.push(`- **Package Count**: ${pkgs.length}`);
      lines.push('');

      for (const pkg of pkgs) {
        lines.push(`- \`${pkg.name}@${pkg.version}\` [${pkg.packageManager}]`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
