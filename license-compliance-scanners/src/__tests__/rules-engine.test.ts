import { LicenseRuleEngine, ConflictDetector } from '../rules-engine';
import { Dependency, LicenseConflict } from '../types';

function makeDep(name: string, license: string): Dependency {
  return {
    name,
    version: '1.0.0',
    license,
    packageManager: 'npm',
    path: '/tmp/mock',
    dependencyChain: ['root', name],
  };
}

describe('LicenseRuleEngine.checkCompatibility', () => {
  const engine = new LicenseRuleEngine();

  describe('matrix hit path', () => {
    it('returns critical for GPL-2.0-only vs Apache-2.0 (incompatible)', () => {
      const result = engine.checkCompatibility('GPL-2.0-only', 'Apache-2.0');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(false);
      expect(result!.riskLevel).toBe('critical');
    });

    it('returns low for MIT vs Apache-2.0 (compatible)', () => {
      const result = engine.checkCompatibility('MIT', 'Apache-2.0');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(true);
      expect(result!.riskLevel).toBe('low');
    });

    it('returns critical for Proprietary vs GPL-3.0-only (incompatible)', () => {
      const result = engine.checkCompatibility('Proprietary', 'GPL-3.0-only');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(false);
      expect(result!.riskLevel).toBe('critical');
    });

    it('returns high for AGPL-3.0-only vs GPL-3.0-only (incompatible)', () => {
      const result = engine.checkCompatibility('AGPL-3.0-only', 'GPL-3.0-only');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(false);
      expect(result!.riskLevel).toBe('high');
    });

    it('is symmetric: A-vs-B gives same result as B-vs-A', () => {
      const ab = engine.checkCompatibility('GPL-2.0-only', 'Apache-2.0');
      const ba = engine.checkCompatibility('Apache-2.0', 'GPL-2.0-only');
      expect(ab!.compatible).toBe(ba!.compatible);
      expect(ab!.riskLevel).toBe(ba!.riskLevel);
    });
  });

  describe('same license', () => {
    it('returns info for identical licenses', () => {
      const result = engine.checkCompatibility('MIT', 'MIT');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(true);
      expect(result!.riskLevel).toBe('info');
    });
  });

  describe('inference fallback path', () => {
    it('infers incompatibility for GPL-3.0-or-later vs Proprietary (not in matrix)', () => {
      const result = engine.checkCompatibility('GPL-3.0-or-later', 'Proprietary');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(false);
      expect(result!.riskLevel).toBe('critical');
      expect(result!.description).toContain('Proprietary');
    });

    it('infers incompatibility for two different strong copyleft licenses', () => {
      const result = engine.checkCompatibility('GPL-3.0-only', 'GPL-3.0-or-later');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(false);
      expect(result!.riskLevel).toBe('high');
    });

    it('infers compatibility for two permissive licenses not in matrix', () => {
      const result = engine.checkCompatibility('ISC', 'Unlicense');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(true);
      expect(result!.riskLevel).toBe('low');
    });

    it('infers medium risk for unknown license paired with known one', () => {
      const result = engine.checkCompatibility('UNKNOWN', 'MIT');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(false);
      expect(result!.riskLevel).toBe('medium');
    });

    it('expands OR compound expressions and checks each option', () => {
      const result = engine.checkCompatibility('MIT OR GPL-3.0-only', 'Apache-2.0');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(true);
      expect(result!.riskLevel).toBe('low');
    });

    it('infers compatible for strong copyleft + permissive (not in matrix)', () => {
      const result = engine.checkCompatibility('GPL-3.0-or-later', 'MIT');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(true);
      expect(result!.riskLevel).toBe('medium');
    });

    it('infers compatible for proprietary + weak copyleft (not in matrix)', () => {
      const result = engine.checkCompatibility('Proprietary', 'MPL-2.0');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(true);
      expect(result!.riskLevel).toBe('medium');
    });

    it('infers compatible for weak copyleft + permissive (not in matrix)', () => {
      const result = engine.checkCompatibility('MPL-2.0', 'MIT');
      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(true);
      expect(result!.riskLevel).toBe('medium');
    });
  });
});

describe('ConflictDetector.detectCopyleftInfection', () => {
  let detector: ConflictDetector;

  beforeEach(() => {
    detector = new ConflictDetector();
  });

  it('detects infection when copyleft packages are present', () => {
    const deps = [
      makeDep('pkg-mit', 'MIT'),
      makeDep('pkg-gpl', 'GPL-3.0-only'),
    ];
    const result = detector.detectCopyleftInfection(deps);
    expect(result.infected).toBe(true);
    expect(result.strongestCopyleft).toBe('GPL-3.0-only');
    expect(result.copyleftPackages).toHaveLength(1);
  });

  it('returns not infected when no copyleft packages exist', () => {
    const deps = [
      makeDep('pkg-mit', 'MIT'),
      makeDep('pkg-apache', 'Apache-2.0'),
    ];
    const result = detector.detectCopyleftInfection(deps);
    expect(result.infected).toBe(false);
    expect(result.strongestCopyleft).toBeNull();
  });

  it('clears infection when project license is strong copyleft', () => {
    const deps = [makeDep('pkg-gpl', 'GPL-3.0-only')];
    const result = detector.detectCopyleftInfection(deps, 'GPL-3.0-only');
    expect(result.infected).toBe(false);
  });

  it('identifies the strongest copyleft among mixed-strength packages', () => {
    const deps = [
      makeDep('pkg-lgpl', 'LGPL-3.0-only'),
      makeDep('pkg-gpl', 'GPL-3.0-only'),
    ];
    const result = detector.detectCopyleftInfection(deps);
    expect(result.strongestCopyleft).toBe('GPL-3.0-only');
  });

  it('includes weak copyleft packages in copyleftPackages', () => {
    const deps = [makeDep('pkg-mpl', 'MPL-2.0')];
    const result = detector.detectCopyleftInfection(deps);
    expect(result.copyleftPackages).toHaveLength(1);
    expect(result.infected).toBe(true);
  });
});

describe('ConflictDetector.detectConflicts', () => {
  let detector: ConflictDetector;

  beforeEach(() => {
    detector = new ConflictDetector();
  });

  it('only reports incompatible pairs and excludes compatible ones', () => {
    const deps = [
      makeDep('pkg-mit', 'MIT'),
      makeDep('pkg-gpl3', 'GPL-3.0-only'),
      makeDep('pkg-gpl-or-later', 'GPL-3.0-or-later'),
      makeDep('pkg-proprietary', 'Proprietary'),
    ];

    const conflicts = detector.detectConflicts(deps);

    const pairs = conflicts.map(c => [c.licenseA, c.licenseB].sort().join(' | '));

    expect(pairs).toContain('GPL-3.0-only | Proprietary');
    expect(pairs).toContain('GPL-3.0-or-later | Proprietary');
    expect(pairs).toContain('GPL-3.0-only | GPL-3.0-or-later');

    expect(pairs).not.toContain('GPL-3.0-only | MIT');
    expect(pairs).not.toContain('GPL-3.0-or-later | MIT');
    expect(pairs).not.toContain('MIT | Proprietary');
  });

  it('sorts conflicts by risk level (critical before high before medium)', () => {
    const deps = [
      makeDep('pkg-mit', 'MIT'),
      makeDep('pkg-gpl3', 'GPL-3.0-only'),
      makeDep('pkg-gpl-or-later', 'GPL-3.0-or-later'),
      makeDep('pkg-proprietary', 'Proprietary'),
    ];

    const conflicts = detector.detectConflicts(deps);

    const riskLevels = conflicts.map(c => c.riskLevel);
    const criticalIdx = riskLevels.lastIndexOf('critical');
    const highIdx = riskLevels.indexOf('high');

    expect(criticalIdx).toBeGreaterThanOrEqual(0);
    expect(criticalIdx).toBeLessThan(highIdx);
    expect(conflicts.every(c => c.riskLevel === 'critical' || c.riskLevel === 'high')).toBe(true);
  });

  it('includes all involved packages in each conflict', () => {
    const deps = [
      makeDep('pkg-gpl3', 'GPL-3.0-only'),
      makeDep('pkg-proprietary', 'Proprietary'),
    ];

    const conflicts = detector.detectConflicts(deps);
    expect(conflicts).toHaveLength(1);

    const conflict = conflicts[0];
    const names = conflict.packagesInvolved.map(p => p.name);
    expect(names).toContain('pkg-gpl3');
    expect(names).toContain('pkg-proprietary');
  });

  it('reports UNKNOWN license group when unknown packages exist', () => {
    const deps = [
      makeDep('pkg-unknown', 'UNKNOWN'),
      makeDep('pkg-mit', 'MIT'),
    ];

    const conflicts = detector.detectConflicts(deps);
    const unknownConflict = conflicts.find(c => c.licenseA === 'UNKNOWN' && c.licenseB === 'UNKNOWN');
    expect(unknownConflict).toBeDefined();
    expect(unknownConflict!.riskLevel).toBe('medium');
  });

  it('returns empty array when all licenses are compatible', () => {
    const deps = [
      makeDep('pkg-mit', 'MIT'),
      makeDep('pkg-apache', 'Apache-2.0'),
      makeDep('pkg-bsd', 'BSD-3-Clause'),
    ];

    const conflicts = detector.detectConflicts(deps);
    expect(conflicts).toHaveLength(0);
  });
});
