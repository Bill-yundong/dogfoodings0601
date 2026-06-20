import * as semver from 'semver';

export interface VersionRange {
  raw: string;
  range: semver.Range;
}

export function parseVersionRange(range: string): VersionRange {
  try {
    return {
      raw: range,
      range: new semver.Range(range)
    };
  } catch (error) {
    throw new Error(`Invalid version range: ${range}`);
  }
}

export function intersectRanges(ranges: string[]): string | null {
  if (ranges.length === 0) return null;
  if (ranges.length === 1) return ranges[0];

  try {
    let result: semver.Range | null = new semver.Range(ranges[0]);
    for (let i = 1; i < ranges.length; i++) {
      const next = new semver.Range(ranges[i]);
      result = intersectTwoRanges(result, next);
      if (result === null) return null;
    }
    return result.range;
  } catch (error) {
    return null;
  }
}

function intersectTwoRanges(a: semver.Range, b: semver.Range): semver.Range | null {
  const comparators: semver.Comparator[][] = [];

  for (const setA of a.set) {
    for (const setB of b.set) {
      const merged = [...setA, ...setB];
      if (isComparatorSetSatisfiable(merged)) {
        comparators.push(merged);
      }
    }
  }

  if (comparators.length === 0) return null;

  const rangeStr = comparators
    .map(set => set.map(c => c.value).join(' '))
    .join(' || ');

  try {
    return new semver.Range(rangeStr);
  } catch {
    return null;
  }
}

function isComparatorSetSatisfiable(set: semver.Comparator[]): boolean {
  let minVersion: semver.SemVer | null = null;
  let maxVersion: semver.SemVer | null = null;
  let minInclusive = true;
  let maxInclusive = true;
  const exactVersions: semver.SemVer[] = [];

  for (const comp of set) {
    const ver = comp.semver;
    const op = comp.operator;

    if (op === '' || op === '=') {
      exactVersions.push(ver);
    } else if (op === '>') {
      if (minVersion === null || semver.gt(ver, minVersion)) {
        minVersion = ver;
        minInclusive = false;
      } else if (semver.eq(ver, minVersion)) {
        minInclusive = minInclusive && false;
      }
    } else if (op === '>=') {
      if (minVersion === null || semver.gt(ver, minVersion) || 
          (semver.eq(ver, minVersion) && !minInclusive)) {
        minVersion = ver;
        minInclusive = true;
      }
    } else if (op === '<') {
      if (maxVersion === null || semver.lt(ver, maxVersion)) {
        maxVersion = ver;
        maxInclusive = false;
      } else if (semver.eq(ver, maxVersion)) {
        maxInclusive = maxInclusive && false;
      }
    } else if (op === '<=') {
      if (maxVersion === null || semver.lt(ver, maxVersion) || 
          (semver.eq(ver, maxVersion) && !maxInclusive)) {
        maxVersion = ver;
        maxInclusive = true;
      }
    }
  }

  if (exactVersions.length > 0) {
    for (const exact of exactVersions) {
      if (minVersion !== null) {
        if (minInclusive && semver.lt(exact, minVersion)) return false;
        if (!minInclusive && semver.lte(exact, minVersion)) return false;
      }
      if (maxVersion !== null) {
        if (maxInclusive && semver.gt(exact, maxVersion)) return false;
        if (!maxInclusive && semver.gte(exact, maxVersion)) return false;
      }
    }
    if (exactVersions.length >= 2) {
      const first = exactVersions[0];
      for (let i = 1; i < exactVersions.length; i++) {
        if (!semver.eq(first, exactVersions[i])) return false;
      }
    }
    return true;
  }

  if (minVersion !== null && maxVersion !== null) {
    if (semver.gt(minVersion, maxVersion)) return false;
    if (semver.eq(minVersion, maxVersion) && (!minInclusive || !maxInclusive)) return false;
  }

  return true;
}

export function satisfies(version: string, range: string): boolean {
  return semver.satisfies(version, range);
}

export function findBestVersion(availableVersions: string[], range: string): string | null {
  const valid = availableVersions.filter(v => {
    try {
      return semver.valid(v) && semver.satisfies(v, range);
    } catch {
      return false;
    }
  });

  if (valid.length === 0) return null;
  valid.sort((a, b) => semver.rcompare(a, b));
  return valid[0];
}

export function getLatestVersion(availableVersions: string[]): string | null {
  const valid = availableVersions.filter(v => semver.valid(v));
  if (valid.length === 0) return null;
  valid.sort((a, b) => semver.rcompare(a, b));
  return valid[0];
}

export function findNearestCompatible(
  availableVersions: string[],
  ranges: string[],
  preferredRange?: string
): string | null {
  const sorted = [...availableVersions].filter(v => semver.valid(v));
  sorted.sort((a, b) => semver.rcompare(a, b));

  if (preferredRange) {
    for (const v of sorted) {
      if (semver.satisfies(v, preferredRange)) {
        return v;
      }
    }
  }

  for (const v of sorted) {
    let satisfiesCount = 0;
    for (const r of ranges) {
      if (semver.satisfies(v, r)) {
        satisfiesCount++;
      }
    }
    if (satisfiesCount > 0) {
      return v;
    }
  }

  return getLatestVersion(availableVersions);
}
