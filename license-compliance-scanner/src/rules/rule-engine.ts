import {
  LicenseConflict,
  DependencyNode,
  DependencyInfo,
  RiskLevel,
} from '../types';
import {
  checkCompatibility,
  compareRiskLevels,
  isStrongCopyleft,
  isWeakCopyleft,
  isPermissive,
  getLicenseCategory,
} from '../license-matrix';

export function detectConflicts(
  allDependencies: DependencyInfo[],
  rootDependencies: DependencyNode[]
): LicenseConflict[] {
  const conflicts: LicenseConflict[] = [];
  const seenPairs = new Set<string>();

  const uniqueLicenses = [...new Set(allDependencies.map(d => d.spdxLicense))];

  for (let i = 0; i < uniqueLicenses.length; i++) {
    for (let j = i + 1; j < uniqueLicenses.length; j++) {
      const licenseA = uniqueLicenses[i];
      const licenseB = uniqueLicenses[j];

      const pairKey = [licenseA, licenseB].sort().join('|');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const rule = checkCompatibility(licenseA, licenseB);
      if (!rule || rule.compatible) continue;

      const packagesWithA = allDependencies
        .filter(d => d.spdxLicense === licenseA)
        .map(d => `${d.packageManager}:${d.name}`);

      const packagesWithB = allDependencies
        .filter(d => d.spdxLicense === licenseB)
        .map(d => `${d.packageManager}:${d.name}`);

      const affectedPackages = [...packagesWithA, ...packagesWithB];

      const dependencyChains = findDependencyChains(
        rootDependencies,
        packagesWithA,
        packagesWithB
      );

      const conflict: LicenseConflict = {
        id: `conflict-${licenseA}-${licenseB}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        riskLevel: rule.riskLevel,
        title: `许可证冲突: ${licenseA} vs ${licenseB}`,
        description: rule.description,
        affectedPackages,
        dependencyChains,
        licenseA,
        licenseB,
      };

      conflicts.push(conflict);
    }
  }

  const copyleftConflicts = detectCopyleftContamination(
    allDependencies,
    rootDependencies
  );
  conflicts.push(...copyleftConflicts);

  const unknownLicenseConflicts = detectUnknownLicenses(allDependencies);
  conflicts.push(...unknownLicenseConflicts);

  conflicts.sort((a, b) => compareRiskLevels(a.riskLevel, b.riskLevel));

  return conflicts;
}

function findDependencyChains(
  rootDependencies: DependencyNode[],
  packagesA: string[],
  packagesB: string[]
): string[][] {
  const chains: string[][] = [];
  const maxChains = 5;

  for (const root of rootDependencies) {
    const foundChains = findChainsBetween(
      root,
      packagesA,
      packagesB,
      [root.name]
    );
    for (const chain of foundChains) {
      if (chains.length < maxChains) {
        chains.push(chain);
      }
    }
    if (chains.length >= maxChains) break;
  }

  return chains;
}

function findChainsBetween(
  node: DependencyNode,
  packagesA: string[],
  packagesB: string[],
  currentChain: string[]
): string[][] {
  const results: string[][] = [];

  const nodeKey = `${node.packageManager}:${node.name}`;

  const inA = packagesA.includes(nodeKey) || packagesA.some(p => p.endsWith(`:${node.name}`));
  const inB = packagesB.includes(nodeKey) || packagesB.some(p => p.endsWith(`:${node.name}`));

  if (inA || inB) {
    for (const child of node.children) {
      const childInA = packagesA.some(p => p.endsWith(`:${child.name}`));
      const childInB = packagesB.some(p => p.endsWith(`:${child.name}`));

      if ((inA && childInB) || (inB && childInA)) {
        results.push([...currentChain, child.name]);
      }
    }
  }

  for (const child of node.children) {
    const childChains = findChainsBetween(
      child,
      packagesA,
      packagesB,
      [...currentChain, child.name]
    );
    results.push(...childChains);
  }

  return results;
}

function detectCopyleftContamination(
  allDependencies: DependencyInfo[],
  rootDependencies: DependencyNode[]
): LicenseConflict[] {
  const conflicts: LicenseConflict[] = [];

  const strongCopyleftDeps = allDependencies.filter(d => isStrongCopyleft(d.spdxLicense));

  if (strongCopyleftDeps.length === 0) return conflicts;

  const permissiveDeps = allDependencies.filter(d => isPermissive(d.spdxLicense));

  if (permissiveDeps.length === 0) return conflicts;

  for (const copyleftDep of strongCopyleftDeps) {
    const chains = findCopyleftChains(rootDependencies, copyleftDep.name);

    const conflict: LicenseConflict = {
      id: `copyleft-risk-${copyleftDep.name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      riskLevel: 'high',
      title: `强Copyleft传染风险: ${copyleftDep.name} (${copyleftDep.spdxLicense})`,
      description: `${copyleftDep.name} 使用 ${copyleftDep.spdxLicense} 许可证（${getLicenseCategory(copyleftDep.spdxLicense)}），` +
        `可能对整个项目产生传染效应。如果项目使用宽松许可证（如 MIT/Apache），需要特别注意合规性。`,
      affectedPackages: [`${copyleftDep.packageManager}:${copyleftDep.name}`],
      dependencyChains: chains,
      licenseA: copyleftDep.spdxLicense,
      licenseB: 'Permissive',
    };

    conflicts.push(conflict);
  }

  const weakCopyleftDeps = allDependencies.filter(d => isWeakCopyleft(d.spdxLicense));

  for (const copyleftDep of weakCopyleftDeps) {
    const chains = findCopyleftChains(rootDependencies, copyleftDep.name);

    const conflict: LicenseConflict = {
      id: `weak-copyleft-note-${copyleftDep.name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      riskLevel: 'medium',
      title: `弱Copyleft提示: ${copyleftDep.name} (${copyleftDep.spdxLicense})`,
      description: `${copyleftDep.name} 使用 ${copyleftDep.spdxLicense} 许可证（弱Copyleft）。` +
        `如果仅作为库链接使用且未修改源码，通常不会传染。但如果修改了源码或以静态链接方式使用，需要注意合规要求。`,
      affectedPackages: [`${copyleftDep.packageManager}:${copyleftDep.name}`],
      dependencyChains: chains,
      licenseA: copyleftDep.spdxLicense,
      licenseB: 'Project',
    };

    conflicts.push(conflict);
  }

  return conflicts;
}

function findCopyleftChains(
  rootDependencies: DependencyNode[],
  targetName: string
): string[][] {
  const chains: string[][] = [];
  const maxChains = 3;

  function dfs(node: DependencyNode, path: string[]): void {
    if (node.name === targetName) {
      if (chains.length < maxChains) {
        chains.push([...path]);
      }
      return;
    }

    for (const child of node.children) {
      if (chains.length >= maxChains) break;
      dfs(child, [...path, child.name]);
    }
  }

  for (const root of rootDependencies) {
    if (chains.length >= maxChains) break;
    dfs(root, [root.name]);
  }

  return chains;
}

function detectUnknownLicenses(
  allDependencies: DependencyInfo[]
): LicenseConflict[] {
  const unknownDeps = allDependencies.filter(d => d.spdxLicense === 'UNKNOWN');

  if (unknownDeps.length === 0) return [];

  const conflict: LicenseConflict = {
    id: 'unknown-licenses',
    riskLevel: 'medium',
    title: '未知许可证依赖',
    description: `检测到 ${unknownDeps.length} 个包的许可证信息未知，需要人工审查以确保合规性。`,
    affectedPackages: unknownDeps.map(d => `${d.packageManager}:${d.name}`),
    dependencyChains: [],
    licenseA: 'UNKNOWN',
    licenseB: 'UNKNOWN',
  };

  return [conflict];
}

export function getRiskLevelColor(riskLevel: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    critical: 'red',
    high: 'red',
    medium: 'yellow',
    low: 'green',
    info: 'blue',
  };
  return colors[riskLevel];
}

export function getRiskLevelLabel(riskLevel: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低',
    info: '信息',
  };
  return labels[riskLevel];
}
