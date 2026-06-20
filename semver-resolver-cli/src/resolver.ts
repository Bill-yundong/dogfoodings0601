import * as semver from 'semver';
import { PackageRegistry, getPackageVersions } from './package-reader';
import { intersectRanges, findBestVersion, findNearestCompatible } from './version';

export type ConflictResolutionStrategy = 'nearest' | 'strict' | 'highest' | 'lowest';

export interface ConflictReport {
  packageName: string;
  conflictingRanges: {
    range: string;
    requestedBy: string[];
  }[];
  intersection: string | null;
  resolvedVersion: string | null;
  strategy: ConflictResolutionStrategy;
  hasConflict: boolean;
  resolutionDetails?: string;
}

export interface ResolveResult {
  resolvedDependencies: Map<string, string>;
  conflictReports: ConflictReport[];
  lockfile: Lockfile;
}

export interface LockfileEntry {
  version: string;
  resolved: boolean;
  dependencies?: {
    [name: string]: string;
  };
}

export interface Lockfile {
  [packageName: string]: LockfileEntry;
}

export function resolveVersions(
  packageVersionRanges: Map<string, Map<string, string[]>>,
  registry: PackageRegistry,
  strategy: ConflictResolutionStrategy = 'nearest'
): ResolveResult {
  const resolved = new Map<string, string>();
  const conflictReports: ConflictReport[] = [];

  for (const [packageName, rangeMap] of packageVersionRanges.entries()) {
    const ranges = Array.from(rangeMap.keys());
    const requestedByMap = rangeMap;

    const availableVersions = getPackageVersions(registry, packageName);
    const sortedVersions = [...availableVersions].filter(v => semver.valid(v));
    sortedVersions.sort((a, b) => semver.rcompare(a, b));

    if (ranges.length === 1) {
      const version = findBestVersion(sortedVersions, ranges[0]);
      if (version) {
        resolved.set(packageName, version);
      } else {
        conflictReports.push({
          packageName,
          conflictingRanges: ranges.map(r => ({
            range: r,
            requestedBy: requestedByMap.get(r) || []
          })),
          intersection: ranges[0],
          resolvedVersion: null,
          strategy,
          hasConflict: true,
          resolutionDetails: `No version found satisfying range: ${ranges[0]}`
        });
      }
      continue;
    }

    const intersection = intersectRanges(ranges);

    if (intersection !== null) {
      const version = findBestVersion(sortedVersions, intersection);
      if (version) {
        resolved.set(packageName, version);
        conflictReports.push({
          packageName,
          conflictingRanges: ranges.map(r => ({
            range: r,
            requestedBy: requestedByMap.get(r) || []
          })),
          intersection,
          resolvedVersion: version,
          strategy,
          hasConflict: false,
          resolutionDetails: `All ranges intersect at: ${intersection}`
        });
        continue;
      }
    }

    let resolvedVersion: string | null = null;
    let resolutionDetails = '';

    switch (strategy) {
      case 'strict':
        resolutionDetails = intersection === null
          ? `No intersection between ranges: ${ranges.join(', ')}. Strict mode requires manual resolution.`
          : `No version found satisfying intersection: ${intersection}. Strict mode requires manual resolution.`;
        break;

      case 'highest':
        resolvedVersion = sortedVersions.length > 0 ? sortedVersions[0] : null;
        resolutionDetails = resolvedVersion
          ? `Using highest available version: ${resolvedVersion}`
          : 'No versions available in registry';
        break;

      case 'lowest':
        const ascending = [...sortedVersions].sort((a, b) => semver.compare(a, b));
        resolvedVersion = ascending.length > 0 ? ascending[0] : null;
        resolutionDetails = resolvedVersion
          ? `Using lowest available version: ${resolvedVersion}`
          : 'No versions available in registry';
        break;

      case 'nearest':
      default:
        resolvedVersion = findNearestCompatible(sortedVersions, ranges, ranges[0]);
        resolutionDetails = resolvedVersion
          ? `Using nearest compatible version: ${resolvedVersion}`
          : 'No compatible versions found';
        break;
    }

    if (resolvedVersion) {
      resolved.set(packageName, resolvedVersion);
    }

    conflictReports.push({
      packageName,
      conflictingRanges: ranges.map(r => ({
        range: r,
        requestedBy: requestedByMap.get(r) || []
      })),
      intersection,
      resolvedVersion,
      strategy,
      hasConflict: true,
      resolutionDetails
    });
  }

  const lockfile = buildLockfile(resolved, registry);

  return {
    resolvedDependencies: resolved,
    conflictReports,
    lockfile
  };
}

function buildLockfile(
  resolved: Map<string, string>,
  registry: PackageRegistry
): Lockfile {
  const lockfile: Lockfile = {};

  for (const [name, version] of resolved.entries()) {
    const entry = registry[name];
    const versionEntry = entry?.versions?.[version];

    lockfile[name] = {
      version,
      resolved: true,
      dependencies: versionEntry?.dependencies
    };
  }

  return lockfile;
}

export function formatConflictReport(report: ConflictReport): string {
  const lines: string[] = [];

  lines.push(`📦 ${report.packageName}`);
  lines.push(`   ${report.hasConflict ? '❌ CONFLICT' : '✅ RESOLVED'}`);
  lines.push(`   Strategy: ${report.strategy}`);

  lines.push('   Conflicting ranges:');
  for (const { range, requestedBy } of report.conflictingRanges) {
    lines.push(`     - ${range}`);
    if (requestedBy.length > 0) {
      lines.push(`       requested by: ${requestedBy.join(', ')}`);
    }
  }

  if (report.intersection) {
    lines.push(`   Intersection: ${report.intersection}`);
  } else {
    lines.push(`   Intersection: ∅ (empty - no common version)`);
  }

  if (report.resolvedVersion) {
    lines.push(`   Resolved to: ${report.resolvedVersion}`);
  } else {
    lines.push(`   Resolved to: N/A (unresolved)`);
  }

  if (report.resolutionDetails) {
    lines.push(`   Details: ${report.resolutionDetails}`);
  }

  return lines.join('\n');
}

export function formatLockfile(lockfile: Lockfile): string {
  const lines: string[] = [];
  const sortedNames = Object.keys(lockfile).sort();

  lines.push('# This is an auto-generated lockfile');
  lines.push('# Do not edit this file directly');
  lines.push('');

  for (const name of sortedNames) {
    const entry = lockfile[name];
    lines.push(`${name}:`);
    lines.push(`  version: "${entry.version}"`);
    lines.push(`  resolved: ${entry.resolved}`);

    if (entry.dependencies && Object.keys(entry.dependencies).length > 0) {
      lines.push('  dependencies:');
      const depNames = Object.keys(entry.dependencies).sort();
      for (const dep of depNames) {
        lines.push(`    ${dep}: "${entry.dependencies[dep]}"`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
