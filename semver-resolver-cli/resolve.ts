#!/usr/bin/env ts-node

import * as path from 'path';
import {
  readPackageDescriptor,
  getAllDependencies,
  buildMockRegistry
} from './src/package-reader';
import {
  buildDependencyTree,
  deduplicateDiamondDependencies,
  formatDependencyTree,
  flattenDependencyTree
} from './src/dependency-tree';
import {
  resolveVersions,
  formatConflictReport,
  formatLockfile,
  ConflictResolutionStrategy
} from './src/resolver';

interface CLIArgs {
  projectDir: string;
  strategy: ConflictResolutionStrategy;
  showTree: boolean;
  outputLockfile: boolean;
}

function parseArgs(args: string[]): CLIArgs {
  let projectDir = '';
  let strategy: ConflictResolutionStrategy = 'nearest';
  let showTree = true;
  let outputLockfile = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--strategy' || arg === '-s') {
      const next = args[i + 1];
      if (next && ['nearest', 'strict', 'highest', 'lowest'].includes(next)) {
        strategy = next as ConflictResolutionStrategy;
        i++;
      }
    } else if (arg === '--no-tree') {
      showTree = false;
    } else if (arg === '--no-lockfile') {
      outputLockfile = false;
    } else if (!arg.startsWith('-')) {
      projectDir = arg;
    }
  }

  if (!projectDir) {
    console.error('Usage: npx ts-node resolve.ts <project-directory> [options]');
    console.error('');
    console.error('Options:');
    console.error('  -s, --strategy <strategy>  Conflict resolution strategy');
    console.error('                              nearest  - Use nearest compatible version (default)');
    console.error('                              strict   - Report error on conflicts');
    console.error('                              highest  - Use highest available version');
    console.error('                              lowest   - Use lowest available version');
    console.error('  --no-tree                  Hide dependency tree output');
    console.error('  --no-lockfile              Hide lockfile output');
    process.exit(1);
  }

  return { projectDir, strategy, showTree, outputLockfile };
}

function printHeader(title: string) {
  const line = '═'.repeat(Math.max(60, title.length + 4));
  console.log('');
  console.log(line);
  console.log(`  ${title}`);
  console.log(line);
}

function main() {
  const args = process.argv.slice(2);
  const cliArgs = parseArgs(args);

  const projectDir = path.resolve(cliArgs.projectDir);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          SemVer Dependency Resolver CLI v1.0.0              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Project: ${projectDir}`);
  console.log(`Strategy: ${cliArgs.strategy}`);

  const pkg = readPackageDescriptor(projectDir);
  const deps = getAllDependencies(pkg);

  console.log('');
  console.log(`Root package: ${pkg.name}@${pkg.version}`);
  console.log(`Direct dependencies: ${Object.keys(deps).length}`);

  const registry = buildMockRegistry();

  printHeader('Building Dependency Tree');
  const buildResult = buildDependencyTree(pkg.name, pkg.version, deps, registry);

  const dedupedTree = deduplicateDiamondDependencies(buildResult.tree);
  const flattened = flattenDependencyTree(dedupedTree);

  if (cliArgs.showTree) {
    console.log('');
    console.log(formatDependencyTree(dedupedTree));
  }

  if (buildResult.cycles.length > 0) {
    printHeader('Circular Dependencies Detected');
    console.log('');
    for (let i = 0; i < buildResult.cycles.length; i++) {
      console.log(`  Cycle ${i + 1}: ${buildResult.cycles[i].join(' → ')}`);
    }
  }

  printHeader('Resolving Version Conflicts');
  const rootPackageId = `${pkg.name}@${pkg.version}`;
  const resolveResult = resolveVersions(
    buildResult.packageVersionRanges,
    buildResult.packageRequestors,
    registry,
    cliArgs.strategy,
    rootPackageId
  );

  const actualConflicts = resolveResult.conflictReports.filter(r => r.hasConflict);
  const nonConflicts = resolveResult.conflictReports.filter(r => !r.hasConflict);

  if (nonConflicts.length > 0) {
    console.log('');
    console.log('  Successfully resolved packages:');
    for (const report of nonConflicts) {
      console.log(`    ✅ ${report.packageName}@${report.resolvedVersion}`);
    }
  }

  if (actualConflicts.length > 0) {
    console.log('');
    for (const report of actualConflicts) {
      console.log('');
      console.log(formatConflictReport(report));
    }
  } else {
    console.log('');
    console.log('  🎉 No version conflicts detected!');
  }

  printHeader('Resolved Dependency Lock List');
  console.log('');
  const sortedDeps = Array.from(resolveResult.resolvedDependencies.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [name, version] of sortedDeps) {
    console.log(`  ${name}: ${version}`);
  }

  const unresolvedCount = resolveResult.conflictReports.filter(r => !r.resolvedVersion).length;
  if (unresolvedCount > 0) {
    console.log('');
    console.log(`  ⚠️  ${unresolvedCount} package(s) could not be resolved`);
  }

  if (cliArgs.outputLockfile) {
    printHeader('Generated Lockfile (package-resolved.lock)');
    console.log('');
    console.log(formatLockfile(resolveResult.lockfile));
  }

  printHeader('Summary');
  console.log('');
  console.log(`  Total packages: ${resolveResult.resolvedDependencies.size + unresolvedCount}`);
  console.log(`  Resolved: ${resolveResult.resolvedDependencies.size}`);
  console.log(`  Conflicts: ${actualConflicts.length}`);
  console.log(`  Unresolved: ${unresolvedCount}`);
  console.log(`  Circular dependencies: ${buildResult.cycles.length}`);
  console.log('');

  if (unresolvedCount > 0 && cliArgs.strategy === 'strict') {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error('');
  console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  console.error('');
  process.exit(1);
}
