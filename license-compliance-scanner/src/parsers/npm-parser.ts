import * as fs from 'fs';
import * as path from 'path';
import { DependencyNode, DependencyInfo, ParserResult } from '../types';
import { normalizeLicense } from '../license-matrix';
import { getLicenseForPackage } from '../license-db';

interface PackageJson {
  name?: string;
  version?: string;
  license?: string;
  licenses?: Array<{ type: string; url?: string }> | string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export function parsePackageJson(projectPath: string, includeDev: boolean = true): ParserResult {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const nodeModulesPath = path.join(projectPath, 'node_modules');

  if (!fs.existsSync(packageJsonPath)) {
    return {
      packageManager: 'npm',
      rootDependencies: [],
      allDependencies: [],
    };
  }

  const content = fs.readFileSync(packageJsonPath, 'utf-8');
  const pkg: PackageJson = JSON.parse(content);

  const allDeps: Record<string, string> = {
    ...(pkg.dependencies || {}),
    ...(includeDev ? pkg.devDependencies : {}),
    ...(pkg.peerDependencies || {}),
  };

  const rootDependencies: DependencyNode[] = [];
  const allDependencies: DependencyInfo[] = [];
  const seen = new Set<string>();

  for (const [name, versionRaw] of Object.entries(allDeps)) {
    const version = versionRaw.replace(/^[\^~>=<]+/, '').trim();
    const packageLicense = getLicenseFromNodeModules(nodeModulesPath, name);
    const spdxLicense = normalizeLicense(packageLicense || getLicenseForPackage(name, 'npm'));

    if (seen.has(name)) continue;
    seen.add(name);

    const depInfo: DependencyInfo = {
      name,
      version,
      license: packageLicense || getLicenseForPackage(name, 'npm'),
      spdxLicense,
      packageManager: 'npm',
      path: path.join(nodeModulesPath, name),
    };
    allDependencies.push(depInfo);

    const children = parseNestedDependencies(nodeModulesPath, name, seen, allDependencies, 1);

    const node: DependencyNode = {
      name,
      version,
      license: depInfo.license,
      spdxLicense,
      packageManager: 'npm',
      children,
      depth: 0,
    };
    rootDependencies.push(node);
  }

  return {
    packageManager: 'npm',
    rootDependencies,
    allDependencies,
  };
}

function getLicenseFromNodeModules(nodeModulesPath: string, packageName: string): string | null {
  const pkgJsonPath = path.join(nodeModulesPath, packageName, 'package.json');

  if (!fs.existsSync(pkgJsonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(pkgJsonPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);

    if (pkg.license) {
      if (typeof pkg.license === 'string') {
        return pkg.license;
      }
      if (typeof pkg.license === 'object' && (pkg.license as any).type) {
        return (pkg.license as any).type;
      }
    }

    if (pkg.licenses) {
      if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
        return pkg.licenses[0].type;
      }
      if (typeof pkg.licenses === 'string') {
        return pkg.licenses;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function parseNestedDependencies(
  nodeModulesPath: string,
  packageName: string,
  seen: Set<string>,
  allDependencies: DependencyInfo[],
  depth: number
): DependencyNode[] {
  const result: DependencyNode[] = [];

  if (depth > 3) return result;

  const pkgJsonPath = path.join(nodeModulesPath, packageName, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return result;

  try {
    const content = fs.readFileSync(pkgJsonPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);
    const deps = pkg.dependencies || {};

    for (const [name, versionRaw] of Object.entries(deps)) {
      const version = versionRaw.replace(/^[\^~>=<]+/, '').trim();

      const nestedPath = path.join(nodeModulesPath, packageName, 'node_modules', name);
      const licensePath = fs.existsSync(path.join(nestedPath, 'package.json'))
        ? nestedPath
        : path.join(nodeModulesPath, name);

      const packageLicense = getLicenseFromNodeModules(
        fs.existsSync(path.join(nodeModulesPath, packageName, 'node_modules'))
          ? path.join(nodeModulesPath, packageName, 'node_modules')
          : nodeModulesPath,
        name
      );

      const spdxLicense = normalizeLicense(packageLicense || getLicenseForPackage(name, 'npm'));

      const isNew = !seen.has(name);
      if (isNew) {
        seen.add(name);
        allDependencies.push({
          name,
          version,
          license: packageLicense || getLicenseForPackage(name, 'npm'),
          spdxLicense,
          packageManager: 'npm',
          path: licensePath,
        });
      }

      const children = isNew
        ? parseNestedDependencies(nodeModulesPath, name, seen, allDependencies, depth + 1)
        : [];

      result.push({
        name,
        version,
        license: packageLicense || getLicenseForPackage(name, 'npm'),
        spdxLicense,
        packageManager: 'npm',
        children,
        depth,
      });
    }
  } catch {
    // ignore
  }

  return result;
}
