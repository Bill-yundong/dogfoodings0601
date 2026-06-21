import * as fs from 'fs';
import * as path from 'path';
import { Dependency, PackageManager } from './types';
import { normalizeLicense } from './license-matrix';

export interface Parser {
  canParse(filePath: string): boolean;
  parse(filePath: string): Promise<Dependency[]>;
}

export interface PackageJsonData {
  name?: string;
  version?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export class PackageJsonParser implements Parser {
  canParse(filePath: string): boolean {
    return path.basename(filePath).toLowerCase() === 'package.json';
  }

  async parse(filePath: string): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const pkg: PackageJsonData = JSON.parse(content);

    const projectRoot = path.dirname(filePath);
    const allDeps: Record<string, string> = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {}),
    };

    for (const [name, version] of Object.entries(allDeps)) {
      const depLicense = await this.resolveDependencyLicense(projectRoot, name);
      const chain: string[] = [pkg.name || path.basename(projectRoot), name];

      dependencies.push({
        name,
        version: this.cleanVersion(version),
        license: depLicense,
        packageManager: 'npm',
        path: filePath,
        dependencyChain: chain,
      });

      const transitiveDeps = await this.resolveTransitiveDependencies(projectRoot, name, chain);
      dependencies.push(...transitiveDeps);
    }

    return dependencies;
  }

  private async resolveDependencyLicense(projectRoot: string, packageName: string): Promise<string> {
    const possiblePaths = [
      path.join(projectRoot, 'node_modules', packageName, 'package.json'),
      path.join(projectRoot, '..', 'node_modules', packageName, 'package.json'),
    ];

    for (const pkgJsonPath of possiblePaths) {
      if (fs.existsSync(pkgJsonPath)) {
        try {
          const content = await fs.promises.readFile(pkgJsonPath, 'utf-8');
          const depPkg: PackageJsonData = JSON.parse(content);
          if (depPkg.license) {
            return normalizeLicense(depPkg.license);
          }
        } catch {
          continue;
        }
      }
    }

    return 'UNKNOWN';
  }

  private async resolveTransitiveDependencies(
    projectRoot: string,
    packageName: string,
    parentChain: string[]
  ): Promise<Dependency[]> {
    const result: Dependency[] = [];
    const pkgJsonPath = path.join(projectRoot, 'node_modules', packageName, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) {
      return result;
    }

    try {
      const content = await fs.promises.readFile(pkgJsonPath, 'utf-8');
      const depPkg: PackageJsonData = JSON.parse(content);
      const transitiveDeps = depPkg.dependencies || {};

      for (const [name, version] of Object.entries(transitiveDeps)) {
        const chain = [...parentChain, name];
        const transitiveLicense = await this.resolveDependencyLicense(projectRoot, name);

        result.push({
          name,
          version: this.cleanVersion(version),
          license: transitiveLicense,
          packageManager: 'npm',
          path: pkgJsonPath,
          dependencyChain: chain,
        });
      }
    } catch {
      return result;
    }

    return result;
  }

  private cleanVersion(version: string): string {
    return version.replace(/^[\^~>=<]+/, '').trim();
  }
}

export interface RequirementsTxtEntry {
  name: string;
  version?: string;
}

export class RequirementsTxtParser implements Parser {
  canParse(filePath: string): boolean {
    const basename = path.basename(filePath).toLowerCase();
    return basename === 'requirements.txt' || basename.endsWith('.txt') && basename.includes('require');
  }

  async parse(filePath: string): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const projectRoot = path.dirname(filePath);
    const projectName = path.basename(projectRoot);

    for (const line of lines) {
      const entry = this.parseLine(line);
      if (!entry) continue;

      const license = await this.resolvePythonLicense(projectRoot, entry.name);
      const chain: string[] = [projectName, entry.name];

      dependencies.push({
        name: entry.name,
        version: entry.version || 'latest',
        license,
        packageManager: 'pip',
        path: filePath,
        dependencyChain: chain,
      });
    }

    return dependencies;
  }

  private parseLine(line: string): RequirementsTxtEntry | null {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return null;
    }

    if (trimmed.startsWith('-r') || trimmed.startsWith('-e') || trimmed.startsWith('--')) {
      return null;
    }

    const cleanLine = trimmed.split(' #')[0].split(';')[0].trim();

    const versionMatch = cleanLine.match(/^([a-zA-Z0-9_.\-]+)\s*(==|>=|<=|!=|~=|>|<)\s*([a-zA-Z0-9_.\-+]+)/);
    if (versionMatch) {
      return {
        name: versionMatch[1],
        version: versionMatch[3],
      };
    }

    const simpleMatch = cleanLine.match(/^([a-zA-Z0-9_.\-]+)$/);
    if (simpleMatch) {
      return {
        name: simpleMatch[1],
      };
    }

    const bracketMatch = cleanLine.match(/^([a-zA-Z0-9_.\-]+)\[.*?\]/);
    if (bracketMatch) {
      return {
        name: bracketMatch[1],
      };
    }

    return null;
  }

  private async resolvePythonLicense(projectRoot: string, packageName: string): Promise<string> {
    const sitePackagesPaths = [
      path.join(projectRoot, 'venv', 'lib', 'python*', 'site-packages'),
      path.join(projectRoot, '.venv', 'lib', 'python*', 'site-packages'),
      path.join(projectRoot, 'env', 'lib', 'python*', 'site-packages'),
    ];

    for (const globPath of sitePackagesPaths) {
      const license = await this.findLicenseInSitePackages(globPath, packageName);
      if (license !== 'UNKNOWN') {
        return license;
      }
    }

    const possibleMetadataPaths = [
      path.join(projectRoot, 'venv', 'lib'),
      path.join(projectRoot, '.venv', 'lib'),
      path.join(projectRoot, 'env', 'lib'),
    ];

    for (const libPath of possibleMetadataPaths) {
      if (!fs.existsSync(libPath)) continue;
      try {
        const pythonVersions = await fs.promises.readdir(libPath);
        for (const pyVersion of pythonVersions) {
          const sitePackages = path.join(libPath, pyVersion, 'site-packages');
          if (!fs.existsSync(sitePackages)) continue;
          const license = await this.findDistInfoLicense(sitePackages, packageName);
          if (license !== 'UNKNOWN') return license;
        }
      } catch {
        continue;
      }
    }

    return 'UNKNOWN';
  }

  private async findLicenseInSitePackages(globPath: string, packageName: string): Promise<string> {
    return 'UNKNOWN';
  }

  private async findDistInfoLicense(sitePackages: string, packageName: string): Promise<string> {
    try {
      const entries = await fs.promises.readdir(sitePackages);
      const normalizedPkgName = packageName.toLowerCase().replace(/[-_]/g, '-');

      for (const entry of entries) {
        if (!entry.endsWith('.dist-info') && !entry.endsWith('.egg-info')) continue;

        const entryName = entry.replace(/\.(dist|egg)-info$/, '').toLowerCase().replace(/[-_]/g, '-');
        if (!entryName.startsWith(normalizedPkgName.split('-')[0])) continue;

        const metadataPath = path.join(sitePackages, entry, 'METADATA');
        if (fs.existsSync(metadataPath)) {
          const content = await fs.promises.readFile(metadataPath, 'utf-8');
          const licenseMatch = content.match(/^License:\s*(.+)$/m);
          const classifierMatches = content.match(/^Classifier:\s*License\s*::\s*(.+)$/gm);

          if (licenseMatch) {
            const licenseStr = licenseMatch[1].trim();
            if (licenseStr && licenseStr !== 'UNKNOWN') {
              return normalizeLicense(licenseStr);
            }
          }

          if (classifierMatches) {
            const lastClassifier = classifierMatches[classifierMatches.length - 1];
            const licenseName = lastClassifier.replace(/^Classifier:\s*License\s*::\s*/, '').trim();
            return this.mapPythonClassifierToSPDX(licenseName);
          }
        }
      }
    } catch {
      return 'UNKNOWN';
    }

    return 'UNKNOWN';
  }

  private mapPythonClassifierToSPDX(classifier: string): string {
    const mappings: Record<string, string> = {
      'MIT License': 'MIT',
      'OSI Approved :: MIT License': 'MIT',
      'Apache Software License': 'Apache-2.0',
      'OSI Approved :: Apache Software License': 'Apache-2.0',
      'BSD License': 'BSD-3-Clause',
      'OSI Approved :: BSD License': 'BSD-3-Clause',
      'GNU General Public License (GPL)': 'GPL-3.0-only',
      'GNU General Public License v2 (GPLv2)': 'GPL-2.0-only',
      'GNU General Public License v3 (GPLv3)': 'GPL-3.0-only',
      'GNU Lesser General Public License v2 (LGPLv2)': 'LGPL-2.1-only',
      'GNU Lesser General Public License v3 (LGPLv3)': 'LGPL-3.0-only',
      'GNU Affero General Public License v3': 'AGPL-3.0-only',
      'Mozilla Public License 2.0 (MPL 2.0)': 'MPL-2.0',
      'Mozilla Public License 1.1 (MPL 1.1)': 'MPL-1.1',
      'ISC License (ISCL)': 'ISC',
      'Public Domain': 'Unlicense',
      'CC0 1.0 Universal (CC0 1.0) Public Domain Dedication': 'CC0-1.0',
      'Eclipse Public License 2.0 (EPL-2.0)': 'EPL-2.0',
      'Eclipse Public License 1.0 (EPL-1.0)': 'EPL-1.0',
      'CDDL License': 'CDDL-1.0',
      'Proprietary': 'Proprietary',
    };

    for (const [key, spdx] of Object.entries(mappings)) {
      if (classifier.includes(key.split(' :: ').pop() || key)) {
        return spdx;
      }
    }

    return normalizeLicense(classifier);
  }
}

export interface GoModEntry {
  name: string;
  version: string;
  indirect?: boolean;
}

export class GoModParser implements Parser {
  canParse(filePath: string): boolean {
    return path.basename(filePath).toLowerCase() === 'go.mod';
  }

  async parse(filePath: string): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const projectRoot = path.dirname(filePath);

    const moduleName = this.extractModuleName(content) || path.basename(projectRoot);
    const entries = this.parseRequireBlocks(content);

    for (const entry of entries) {
      const license = await this.resolveGoLicense(projectRoot, entry.name);
      const chain: string[] = [moduleName, entry.name];

      dependencies.push({
        name: entry.name,
        version: entry.version,
        license,
        packageManager: 'go',
        path: filePath,
        dependencyChain: chain,
      });
    }

    return dependencies;
  }

  private extractModuleName(content: string): string | null {
    const match = content.match(/^module\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  private parseRequireBlocks(content: string): GoModEntry[] {
    const entries: GoModEntry[] = [];
    const lines = content.split('\n');
    let inRequireBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('require (')) {
        inRequireBlock = true;
        continue;
      }

      if (inRequireBlock && trimmed === ')') {
        inRequireBlock = false;
        continue;
      }

      if (!inRequireBlock && trimmed.startsWith('require ')) {
        const entry = this.parseGoRequireLine(trimmed.replace(/^require\s+/, ''));
        if (entry) entries.push(entry);
        continue;
      }

      if (inRequireBlock && trimmed && !trimmed.startsWith('//')) {
        const entry = this.parseGoRequireLine(trimmed);
        if (entry) entries.push(entry);
      }
    }

    return entries;
  }

  private parseGoRequireLine(line: string): GoModEntry | null {
    const cleanLine = line.split('//')[0].trim();
    const indirect = line.includes('// indirect');

    const match = cleanLine.match(/^(\S+)\s+(\S+)/);
    if (match) {
      return {
        name: match[1],
        version: match[2],
        indirect,
      };
    }

    return null;
  }

  private async resolveGoLicense(projectRoot: string, modulePath: string): Promise<string> {
    const moduleCachePath = this.getGoModuleCachePath(modulePath);

    const possiblePaths = [
      path.join(projectRoot, 'vendor', modulePath),
      moduleCachePath,
    ];

    for (const basePath of possiblePaths) {
      if (!fs.existsSync(basePath)) continue;

      const licenseFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING', 'NOTICE'];
      for (const licenseFile of licenseFiles) {
        const fullPath = path.join(basePath, licenseFile);
        if (fs.existsSync(fullPath)) {
          try {
            const content = await fs.promises.readFile(fullPath, 'utf-8');
            return this.detectLicenseFromContent(content);
          } catch {
            continue;
          }
        }
      }
    }

    return 'UNKNOWN';
  }

  private getGoModuleCachePath(modulePath: string): string {
    const gopath = process.env.GOPATH || path.join(process.env.HOME || '', 'go');
    const escapedPath = modulePath.replace(/!/g, '!').toLowerCase();
    return path.join(gopath, 'pkg', 'mod', escapedPath);
  }

  private detectLicenseFromContent(content: string): string {
    const lowerContent = content.toLowerCase();

    const licenseSignatures: Array<{ pattern: RegExp; spdx: string }> = [
      { pattern: /mit license/, spdx: 'MIT' },
      { pattern: /permission is hereby granted, free of charge, to any person obtaining a copy/, spdx: 'MIT' },
      { pattern: /apache license.*version 2\.0/, spdx: 'Apache-2.0' },
      { pattern: /apache.*2\.0/, spdx: 'Apache-2.0' },
      { pattern: /gnu general public license.*version 3/, spdx: 'GPL-3.0-only' },
      { pattern: /gplv3/, spdx: 'GPL-3.0-only' },
      { pattern: /gnu general public license.*version 2/, spdx: 'GPL-2.0-only' },
      { pattern: /gplv2/, spdx: 'GPL-2.0-only' },
      { pattern: /gnu lesser general public license.*version 3/, spdx: 'LGPL-3.0-only' },
      { pattern: /lgplv3/, spdx: 'LGPL-3.0-only' },
      { pattern: /gnu lesser general public license.*version 2\.1/, spdx: 'LGPL-2.1-only' },
      { pattern: /lgplv2\.1/, spdx: 'LGPL-2.1-only' },
      { pattern: /gnu affero general public license/, spdx: 'AGPL-3.0-only' },
      { pattern: /agpl/, spdx: 'AGPL-3.0-only' },
      { pattern: /mozilla public license.*version 2\.0/, spdx: 'MPL-2.0' },
      { pattern: /mpl.*2\.0/, spdx: 'MPL-2.0' },
      { pattern: /mozilla public license.*version 1\.1/, spdx: 'MPL-1.1' },
      { pattern: /mpl.*1\.1/, spdx: 'MPL-1.1' },
      { pattern: /bsd.*3.*clause/, spdx: 'BSD-3-Clause' },
      { pattern: /redistributions in binary form must reproduce the above copyright notice.*3\./, spdx: 'BSD-3-Clause' },
      { pattern: /bsd.*2.*clause/, spdx: 'BSD-2-Clause' },
      { pattern: /isc license/, spdx: 'ISC' },
      { pattern: /eclipse public license.*version 2\.0/, spdx: 'EPL-2.0' },
      { pattern: /eclipse public license.*version 1\.0/, spdx: 'EPL-1.0' },
      { pattern: /common development and distribution license/, spdx: 'CDDL-1.0' },
      { pattern: /creative commons zero/, spdx: 'CC0-1.0' },
      { pattern: /cc0/, spdx: 'CC0-1.0' },
      { pattern: /this is free and unencumbered software released into the public domain/, spdx: 'Unlicense' },
    ];

    for (const sig of licenseSignatures) {
      if (sig.pattern.test(lowerContent)) {
        return sig.spdx;
      }
    }

    return 'UNKNOWN';
  }
}

export class ParserRegistry {
  private parsers: Parser[] = [];

  constructor() {
    this.parsers.push(new PackageJsonParser());
    this.parsers.push(new RequirementsTxtParser());
    this.parsers.push(new GoModParser());
  }

  getParser(filePath: string): Parser | null {
    for (const parser of this.parsers) {
      if (parser.canParse(filePath)) {
        return parser;
      }
    }
    return null;
  }

  getAllParsers(): Parser[] {
    return [...this.parsers];
  }
}
