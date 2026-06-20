import * as fs from 'fs';
import * as path from 'path';

export interface PackageDependencies {
  [packageName: string]: string;
}

export interface PackageDescriptor {
  name: string;
  version: string;
  dependencies?: PackageDependencies;
  devDependencies?: PackageDependencies;
  peerDependencies?: PackageDependencies;
}

export interface PackageRegistryEntry {
  versions: {
    [version: string]: {
      dependencies?: PackageDependencies;
    };
  };
}

export interface PackageRegistry {
  [packageName: string]: PackageRegistryEntry;
}

export function readPackageDescriptor(projectDir: string): PackageDescriptor {
  const packageJsonPath = path.join(projectDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Package descriptor not found at: ${packageJsonPath}`);
  }

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const parsed = JSON.parse(content);

    if (!parsed.name) {
      throw new Error('Package descriptor missing "name" field');
    }
    if (!parsed.version) {
      throw new Error('Package descriptor missing "version" field');
    }

    return {
      name: parsed.name,
      version: parsed.version,
      dependencies: parsed.dependencies || {},
      devDependencies: parsed.devDependencies || {},
      peerDependencies: parsed.peerDependencies || {}
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in package.json: ${error.message}`);
    }
    throw error;
  }
}

export function getAllDependencies(pkg: PackageDescriptor): PackageDependencies {
  return {
    ...(pkg.dependencies || {}),
    ...(pkg.peerDependencies || {})
  };
}

export function buildMockRegistry(): PackageRegistry {
  return {
    'lodash': {
      versions: {
        '4.17.21': { dependencies: {} },
        '4.17.20': { dependencies: {} },
        '4.16.0': { dependencies: {} },
        '3.10.1': { dependencies: {} },
        '2.4.2': { dependencies: {} }
      }
    },
    'express': {
      versions: {
        '4.18.2': {
          dependencies: {
            'accepts': '~1.3.8',
            'body-parser': '1.20.1',
            'debug': '2.6.9'
          }
        },
        '4.17.1': {
          dependencies: {
            'accepts': '~1.3.7',
            'body-parser': '1.19.0',
            'debug': '2.6.9'
          }
        },
        '5.0.0-beta.1': {
          dependencies: {
            'accepts': '~1.3.8',
            'body-parser': '2.0.0',
            'debug': '4.3.4'
          }
        }
      }
    },
    'accepts': {
      versions: {
        '1.3.8': { dependencies: { 'mime-types': '~2.1.34', 'negotiator': '0.6.3' } },
        '1.3.7': { dependencies: { 'mime-types': '~2.1.24', 'negotiator': '0.6.2' } }
      }
    },
    'body-parser': {
      versions: {
        '1.20.1': { dependencies: { 'debug': '2.6.9', 'type-is': '~1.6.18' } },
        '1.19.0': { dependencies: { 'debug': '2.6.9', 'type-is': '~1.6.17' } },
        '2.0.0': { dependencies: { 'debug': '4.3.4', 'type-is': '~2.0.0' } }
      }
    },
    'debug': {
      versions: {
        '2.6.9': { dependencies: { 'ms': '2.0.0' } },
        '4.3.4': { dependencies: { 'ms': '2.1.2' } }
      }
    },
    'mime-types': {
      versions: {
        '2.1.35': { dependencies: { 'mime-db': '1.52.0' } },
        '2.1.34': { dependencies: { 'mime-db': '1.52.0' } },
        '2.1.24': { dependencies: { 'mime-db': '1.44.0' } }
      }
    },
    'mime-db': {
      versions: {
        '1.52.0': { dependencies: {} },
        '1.44.0': { dependencies: {} }
      }
    },
    'negotiator': {
      versions: {
        '0.6.3': { dependencies: {} },
        '0.6.2': { dependencies: {} }
      }
    },
    'ms': {
      versions: {
        '2.0.0': { dependencies: {} },
        '2.1.2': { dependencies: {} },
        '2.1.3': { dependencies: {} }
      }
    },
    'type-is': {
      versions: {
        '1.6.18': { dependencies: { 'media-typer': '0.3.0', 'mime-types': '~2.1.24' } },
        '1.6.17': { dependencies: { 'media-typer': '0.3.0', 'mime-types': '~2.1.24' } },
        '2.0.0': { dependencies: { 'media-typer': '1.1.0', 'mime-types': '~3.0.0' } }
      }
    },
    'media-typer': {
      versions: {
        '0.3.0': { dependencies: {} },
        '1.1.0': { dependencies: {} }
      }
    },
    'async': {
      versions: {
        '3.2.5': { dependencies: {} },
        '2.6.4': { dependencies: { 'lodash': '^4.17.14' } }
      }
    },
    'chalk': {
      versions: {
        '5.3.0': { dependencies: {} },
        '4.1.2': { dependencies: { 'ansi-styles': '^4.1.0' } },
        '3.0.0': { dependencies: { 'ansi-styles': '^3.2.1' } }
      }
    },
    'ansi-styles': {
      versions: {
        '4.3.0': { dependencies: { 'color-convert': '^2.0.1' } },
        '3.2.1': { dependencies: { 'color-convert': '^1.9.0' } }
      }
    },
    'color-convert': {
      versions: {
        '2.0.1': { dependencies: { 'color-name': '~1.1.4' } },
        '1.9.3': { dependencies: { 'color-name': '1.1.3' } }
      }
    },
    'color-name': {
      versions: {
        '1.1.4': { dependencies: {} },
        '1.1.3': { dependencies: {} }
      }
    },
    'circular-a': {
      versions: {
        '1.0.0': { dependencies: { 'circular-b': '^1.0.0' } }
      }
    },
    'circular-b': {
      versions: {
        '1.0.0': { dependencies: { 'circular-a': '^1.0.0' } }
      }
    },
    'diamond-top': {
      versions: {
        '1.0.0': { dependencies: { 'diamond-left': '^1.0.0', 'diamond-right': '^1.0.0' } }
      }
    },
    'diamond-left': {
      versions: {
        '1.0.0': { dependencies: { 'diamond-common': '^1.0.0' } }
      }
    },
    'diamond-right': {
      versions: {
        '1.0.0': { dependencies: { 'diamond-common': '^1.0.0' } }
      }
    },
    'diamond-common': {
      versions: {
        '1.0.0': { dependencies: {} },
        '1.1.0': { dependencies: {} },
        '2.0.0': { dependencies: {} }
      }
    }
  };
}

export function getPackageVersions(registry: PackageRegistry, packageName: string): string[] {
  const entry = registry[packageName];
  if (!entry) return [];
  return Object.keys(entry.versions);
}

export function getPackageDependencies(
  registry: PackageRegistry,
  packageName: string,
  version: string
): PackageDependencies {
  const entry = registry[packageName];
  if (!entry) return {};
  const versionEntry = entry.versions[version];
  if (!versionEntry) return {};
  return versionEntry.dependencies || {};
}
