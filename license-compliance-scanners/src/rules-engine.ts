import { Dependency, LicenseConflict, RiskLevel } from './types';
import { COMPATIBILITY_MATRIX, RISK_LEVEL_ORDER, getLicenseInfo, normalizeLicense } from './license-matrix';

export class LicenseRuleEngine {
  checkCompatibility(licenseA: string, licenseB: string): {
    compatible: boolean;
    riskLevel: RiskLevel;
    description: string;
  } | null {
    const normalizedA = normalizeLicense(licenseA);
    const normalizedB = normalizeLicense(licenseB);

    if (normalizedA === normalizedB) {
      return {
        compatible: true,
        riskLevel: 'info',
        description: 'Same license - fully compatible',
      };
    }

    const licensesA = this.expandLicenseExpression(normalizedA);
    const licensesB = this.expandLicenseExpression(normalizedB);

    for (const la of licensesA) {
      for (const lb of licensesB) {
        const rule = this.findRule(la, lb);
        if (rule) {
          return rule;
        }
      }
    }

    return this.inferCompatibility(normalizedA, normalizedB);
  }

  private expandLicenseExpression(license: string): string[] {
    if (license.includes(' OR ')) {
      return license.split(' OR ').map(l => l.trim());
    }
    return [license];
  }

  private findRule(licenseA: string, licenseB: string): {
    compatible: boolean;
    riskLevel: RiskLevel;
    description: string;
  } | null {
    for (const rule of COMPATIBILITY_MATRIX) {
      if (
        (rule.licenseA === licenseA && rule.licenseB === licenseB) ||
        (rule.licenseA === licenseB && rule.licenseB === licenseA)
      ) {
        return {
          compatible: rule.compatible,
          riskLevel: rule.riskLevel,
          description: rule.description,
        };
      }
    }
    return null;
  }

  private inferCompatibility(licenseA: string, licenseB: string): {
    compatible: boolean;
    riskLevel: RiskLevel;
    description: string;
  } {
    const infoA = getLicenseInfo(licenseA);
    const infoB = getLicenseInfo(licenseB);

    if (infoA.spdx === 'UNKNOWN' || infoB.spdx === 'UNKNOWN') {
      return {
        compatible: false,
        riskLevel: 'medium',
        description: 'Cannot verify compatibility - one or more licenses are unknown',
      };
    }

    if (infoA.category === 'permissive' && infoB.category === 'permissive') {
      return {
        compatible: true,
        riskLevel: 'low',
        description: 'Both licenses are permissive - generally compatible',
      };
    }

    const hasStrongCopyleft = infoA.copyleftStrength === 'strong' || infoB.copyleftStrength === 'strong';
    const hasCopyleft = infoA.category === 'copyleft' || infoB.category === 'copyleft' || infoA.category === 'weak-copyleft' || infoB.category === 'weak-copyleft';

    if (hasStrongCopyleft) {
      const bothStrongCopyleft = infoA.copyleftStrength === 'strong' && infoB.copyleftStrength === 'strong';
      if (bothStrongCopyleft && infoA.spdx !== infoB.spdx) {
        return {
          compatible: false,
          riskLevel: 'high',
          description: 'Two different strong copyleft licenses detected - likely incompatible, verify carefully',
        };
      }
      return {
        compatible: true,
        riskLevel: 'medium',
        description: 'Strong copyleft license present - combined work will be subject to copyleft terms (infection risk)',
      };
    }

    if (hasCopyleft) {
      return {
        compatible: true,
        riskLevel: 'medium',
        description: 'Weak/medium copyleft license present - review distribution and linking requirements',
      };
    }

    if (infoA.category === 'proprietary' || infoB.category === 'proprietary') {
      return {
        compatible: false,
        riskLevel: 'high',
        description: 'Proprietary license involved - verify redistribution rights carefully',
      };
    }

    return {
      compatible: true,
      riskLevel: 'low',
      description: 'Licenses appear compatible based on category analysis',
    };
  }
}

export class ConflictDetector {
  private ruleEngine: LicenseRuleEngine;

  constructor() {
    this.ruleEngine = new LicenseRuleEngine();
  }

  detectConflicts(dependencies: Dependency[]): LicenseConflict[] {
    const conflicts: LicenseConflict[] = [];
    const seen = new Set<string>();

    const uniqueLicenses = new Map<string, Dependency[]>();
    for (const dep of dependencies) {
      if (!uniqueLicenses.has(dep.license)) {
        uniqueLicenses.set(dep.license, []);
      }
      uniqueLicenses.get(dep.license)!.push(dep);
    }

    const licenses = Array.from(uniqueLicenses.keys());

    for (let i = 0; i < licenses.length; i++) {
      for (let j = i + 1; j < licenses.length; j++) {
        const licenseA = licenses[i];
        const licenseB = licenses[j];

        const result = this.ruleEngine.checkCompatibility(licenseA, licenseB);
        if (!result) continue;

        const conflictKey = this.generateConflictKey(licenseA, licenseB, result.riskLevel);
        if (seen.has(conflictKey)) continue;

        if (result.riskLevel !== 'info' && (result.riskLevel === 'critical' || result.riskLevel === 'high' || result.riskLevel === 'medium')) {
          seen.add(conflictKey);

          const packagesInvolved = [
            ...(uniqueLicenses.get(licenseA) || []),
            ...(uniqueLicenses.get(licenseB) || []),
          ];

          conflicts.push({
            licenseA,
            licenseB,
            riskLevel: result.riskLevel,
            description: result.description,
            packagesInvolved,
          });
        }
      }
    }

    const unknownLicenseDeps = dependencies.filter(d => d.license === 'UNKNOWN');
    if (unknownLicenseDeps.length > 0) {
      conflicts.push({
        licenseA: 'UNKNOWN',
        licenseB: 'UNKNOWN',
        riskLevel: 'medium',
        description: `${unknownLicenseDeps.length} package(s) with unknown licenses - manual review required`,
        packagesInvolved: unknownLicenseDeps,
      });
    }

    this.sortConflictsByRisk(conflicts);
    return conflicts;
  }

  private generateConflictKey(licenseA: string, licenseB: string, riskLevel: RiskLevel): string {
    const sorted = [licenseA, licenseB].sort();
    return `${sorted[0]}|${sorted[1]}|${riskLevel}`;
  }

  private sortConflictsByRisk(conflicts: LicenseConflict[]): void {
    conflicts.sort((a, b) => {
      const riskDiff = RISK_LEVEL_ORDER[a.riskLevel] - RISK_LEVEL_ORDER[b.riskLevel];
      if (riskDiff !== 0) return riskDiff;
      return a.licenseA.localeCompare(b.licenseA);
    });
  }

  detectCopyleftInfection(dependencies: Dependency[], projectLicense?: string): {
    infected: boolean;
    copyleftPackages: Dependency[];
    strongestCopyleft: string | null;
  } {
    const copyleftStrengthOrder: Record<string, number> = {
      strong: 3,
      medium: 2,
      weak: 1,
      none: 0,
    };

    const copyleftPackages = dependencies.filter(dep => {
      const info = getLicenseInfo(dep.license);
      return info.category === 'copyleft' || info.category === 'weak-copyleft';
    });

    let strongestCopyleft: string | null = null;
    let strongestStrength = 0;

    for (const dep of copyleftPackages) {
      const info = getLicenseInfo(dep.license);
      const strength = copyleftStrengthOrder[info.copyleftStrength] || 0;
      if (strength > strongestStrength) {
        strongestStrength = strength;
        strongestCopyleft = dep.license;
      }
    }

    let infected = copyleftPackages.length > 0;

    if (projectLicense) {
      const projectInfo = getLicenseInfo(projectLicense);
      if (projectInfo.copyleftStrength === 'strong') {
        infected = false;
      }
    }

    return {
      infected,
      copyleftPackages,
      strongestCopyleft,
    };
  }
}
