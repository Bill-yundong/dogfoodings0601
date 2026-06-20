import { PackageDependencies, PackageRegistry, getPackageDependencies, getPackageVersions } from './package-reader';
import { findBestVersion } from './version';

export interface DependencyNode {
  name: string;
  versionRange: string;
  resolvedVersion?: string;
  children: DependencyNode[];
  isDuplicate?: boolean;
  isCircular?: boolean;
  circularPath?: string[];
  requestedBy: string[];
}

export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath?: string[];
}

export interface DependencyBuildResult {
  tree: DependencyNode;
  cycles: string[][];
  packageVersionRanges: Map<string, Map<string, string[]>>;
  packageRequestors: Map<string, Map<string, string[]>>;
}

export function buildDependencyTree(
  rootName: string,
  rootVersion: string,
  dependencies: PackageDependencies,
  registry: PackageRegistry
): DependencyBuildResult {
  const cycles: string[][] = [];
  const packageVersionRanges = new Map<string, Map<string, string[]>>();
  const packageRequestors = new Map<string, Map<string, string[]>>();

  function recordRange(pkgName: string, versionRange: string, requestedBy: string) {
    if (!packageVersionRanges.has(pkgName)) {
      packageVersionRanges.set(pkgName, new Map());
    }
    const rangeMap = packageVersionRanges.get(pkgName)!;

    if (!rangeMap.has(versionRange)) {
      rangeMap.set(versionRange, []);
    }

    if (!packageRequestors.has(pkgName)) {
      packageRequestors.set(pkgName, new Map());
    }
    const requestorMap = packageRequestors.get(pkgName)!;
    if (!requestorMap.has(versionRange)) {
      requestorMap.set(versionRange, []);
    }
    const requestors = requestorMap.get(versionRange)!;
    if (!requestors.includes(requestedBy)) {
      requestors.push(requestedBy);
    }
  }

  function detectCycle(currentPath: string[], targetName: string): CycleDetectionResult {
    const targetWithVersion = currentPath.find(p => p.startsWith(targetName + '@'));
    if (targetWithVersion) {
      const startIndex = currentPath.indexOf(targetWithVersion);
      return {
        hasCycle: true,
        cyclePath: currentPath.slice(startIndex)
      };
    }
    return { hasCycle: false };
  }

  function buildNode(
    name: string,
    versionRange: string,
    currentPath: string[],
    requestedBy: string
  ): DependencyNode {
    recordRange(name, versionRange, requestedBy);

    const versions = getPackageVersions(registry, name);
    const resolvedVersion = findBestVersion(versions, versionRange);

    const nodeId = resolvedVersion ? `${name}@${resolvedVersion}` : `${name}@${versionRange}`;
    const cycleResult = detectCycle(currentPath, name);

    const node: DependencyNode = {
      name,
      versionRange,
      resolvedVersion: resolvedVersion || undefined,
      children: [],
      requestedBy: [requestedBy]
    };

    if (cycleResult.hasCycle) {
      node.isCircular = true;
      node.circularPath = cycleResult.cyclePath;
      cycles.push([...cycleResult.cyclePath!, nodeId]);
      return node;
    }

    const newPath = [...currentPath, nodeId];

    if (resolvedVersion) {
      const transitiveDeps = getPackageDependencies(registry, name, resolvedVersion);
      for (const [depName, depRange] of Object.entries(transitiveDeps)) {
        const child = buildNode(depName, depRange, newPath, nodeId);
        node.children.push(child);
      }
    }

    return node;
  }

  const rootNode: DependencyNode = {
    name: rootName,
    versionRange: rootVersion,
    resolvedVersion: rootVersion,
    children: [],
    requestedBy: ['root']
  };

  const rootPath = [`${rootName}@${rootVersion}`];

  for (const [depName, depRange] of Object.entries(dependencies)) {
    const child = buildNode(depName, depRange, rootPath, `${rootName}@${rootVersion}`);
    rootNode.children.push(child);
  }

  return {
    tree: rootNode,
    cycles,
    packageVersionRanges,
    packageRequestors
  };
}

export function deduplicateDiamondDependencies(tree: DependencyNode): DependencyNode {
  const seen = new Map<string, DependencyNode>();

  function walk(node: DependencyNode): DependencyNode {
    const key = node.resolvedVersion
      ? `${node.name}@${node.resolvedVersion}`
      : `${node.name}@${node.versionRange}`;

    if (seen.has(key) && !node.isCircular) {
      const existing = seen.get(key)!;
      return {
        ...node,
        isDuplicate: true,
        children: existing.children.map(c => ({ ...c, isDuplicate: true }))
      };
    }

    seen.set(key, node);
    const dedupedChildren = node.children.map(child => walk(child));
    return { ...node, children: dedupedChildren };
  }

  return walk(tree);
}

export function flattenDependencyTree(tree: DependencyNode): Map<string, string> {
  const flattened = new Map<string, string>();

  function walk(node: DependencyNode) {
    if (node.resolvedVersion && !flattened.has(node.name)) {
      flattened.set(node.name, node.resolvedVersion);
    }
    for (const child of node.children) {
      if (!child.isDuplicate) {
        walk(child);
      }
    }
  }

  for (const child of tree.children) {
    walk(child);
  }

  return flattened;
}

export function formatDependencyTree(node: DependencyNode, indent: string = '', isLast: boolean = true): string {
  const prefix = indent === '' ? '' : (isLast ? '└── ' : '├── ');
  const childIndent = indent + (isLast ? '    ' : '│   ');

  let result = '';
  if (node.resolvedVersion) {
    result = `${indent}${prefix}${node.name}@${node.resolvedVersion} (required: ${node.versionRange})`;
  } else {
    result = `${indent}${prefix}${node.name}@${node.versionRange} (UNRESOLVED)`;
  }

  const markers: string[] = [];
  if (node.isCircular) markers.push('CIRCULAR');
  if (node.isDuplicate) markers.push('DUPLICATE');
  if (markers.length > 0) {
    result += ` [${markers.join(', ')}]`;
  }

  if (node.isCircular && node.circularPath) {
    result += ` → ${node.circularPath.join(' → ')}`;
  }

  result += '\n';

  for (let i = 0; i < node.children.length; i++) {
    result += formatDependencyTree(node.children[i], childIndent, i === node.children.length - 1);
  }

  return result;
}
