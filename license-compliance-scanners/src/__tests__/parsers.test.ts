import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PackageJsonParser, RequirementsTxtParser, GoModParser, ParserRegistry } from '../parsers';
import { Dependency } from '../types';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-test-'));
}

function writeFile(base: string, relativePath: string, content: string): string {
  const fullPath = path.join(base, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

function findDep(deps: Dependency[], name: string): Dependency | undefined {
  return deps.find(d => d.name === name);
}

describe('PackageJsonParser', () => {
  let dir: string;
  let parser: PackageJsonParser;

  beforeAll(() => {
    dir = makeTmpDir();
    parser = new PackageJsonParser();

    writeFile(dir, 'package.json', JSON.stringify({
      name: 'test-app',
      version: '1.0.0',
      license: 'MIT',
      dependencies: {
        commander: '^11.1.0',
        lodash: '~4.17.21',
      },
      devDependencies: {
        '@types/node': '^20.10.0',
      },
    }));

    writeFile(dir, 'node_modules/commander/package.json', JSON.stringify({
      name: 'commander',
      version: '11.1.0',
      license: 'MIT',
    }));

    writeFile(dir, 'node_modules/lodash/package.json', JSON.stringify({
      name: 'lodash',
      version: '4.17.21',
      license: 'MIT',
      dependencies: {
        'lodash-internal': '^1.2.0',
      },
    }));

    writeFile(dir, 'node_modules/lodash-internal/package.json', JSON.stringify({
      name: 'lodash-internal',
      version: '1.2.0',
      license: 'Apache-2.0',
    }));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('recognises package.json files', () => {
    expect(parser.canParse('/some/path/package.json')).toBe(true);
    expect(parser.canParse('/some/path/requirements.txt')).toBe(false);
  });

  it('parses direct dependencies with correct names, versions and licenses', async () => {
    const deps = await parser.parse(path.join(dir, 'package.json'));

    const commander = findDep(deps, 'commander');
    expect(commander).toBeDefined();
    expect(commander!.version).toBe('11.1.0');
    expect(commander!.license).toBe('MIT');
    expect(commander!.packageManager).toBe('npm');

    const lodash = findDep(deps, 'lodash');
    expect(lodash).toBeDefined();
    expect(lodash!.version).toBe('4.17.21');
    expect(lodash!.license).toBe('MIT');
  });

  it('parses devDependencies', async () => {
    const deps = await parser.parse(path.join(dir, 'package.json'));
    const typesNode = findDep(deps, '@types/node');
    expect(typesNode).toBeDefined();
    expect(typesNode!.version).toBe('20.10.0');
    expect(typesNode!.license).toBe('UNKNOWN');
  });

  it('resolves transitive dependencies with license', async () => {
    const deps = await parser.parse(path.join(dir, 'package.json'));
    const internal = findDep(deps, 'lodash-internal');
    expect(internal).toBeDefined();
    expect(internal!.license).toBe('Apache-2.0');
    expect(internal!.dependencyChain).toEqual(['test-app', 'lodash', 'lodash-internal']);
  });

  it('strips version range characters', async () => {
    const deps = await parser.parse(path.join(dir, 'package.json'));
    const commander = findDep(deps, 'commander');
    expect(commander!.version).not.toMatch(/[\^~]/);
  });
});

describe('RequirementsTxtParser', () => {
  let dir: string;
  let parser: RequirementsTxtParser;

  beforeAll(() => {
    dir = makeTmpDir();
    parser = new RequirementsTxtParser();

    writeFile(dir, 'requirements.txt', [
      '# This is a full-line comment',
      'requests==2.31.0',
      'flask>=2.0.0  # inline comment after package',
      'django==4.2.0; python_version >= "3.8"',
      'numpy~=1.24.0',
      'pandas',
      'cryptography[ssh]',
      'pytest[dev,docs]==7.4.0',
      '-r other-requirements.txt',
      '--index-url https://pypi.org/simple/',
      '# another comment at the end',
    ].join('\n'));

    writeFile(dir, 'venv/lib/python3.10/site-packages/requests-2.31.0.dist-info/METADATA', [
      'Metadata-Version: 2.1',
      'Name: requests',
      'Version: 2.31.0',
      'License: Apache-2.0',
      '',
    ].join('\n'));

    writeFile(dir, 'venv/lib/python3.10/site-packages/flask-2.0.0.dist-info/METADATA', [
      'Metadata-Version: 2.1',
      'Name: flask',
      'Version: 2.0.0',
      'Classifier: License :: OSI Approved :: BSD License',
      '',
    ].join('\n'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('recognises requirements.txt files', () => {
    expect(parser.canParse('/some/path/requirements.txt')).toBe(true);
    expect(parser.canParse('/some/path/go.mod')).toBe(false);
  });

  it('skips comment lines and option directives', async () => {
    const deps = await parser.parse(path.join(dir, 'requirements.txt'));
    const names = deps.map(d => d.name);
    expect(names).not.toContain('other-requirements.txt');
    expect(deps.every(d => !d.name.startsWith('--'))).toBe(true);
    expect(deps.every(d => !d.name.startsWith('#'))).toBe(true);
  });

  it('parses version specifiers correctly', async () => {
    const deps = await parser.parse(path.join(dir, 'requirements.txt'));

    const requests = findDep(deps, 'requests');
    expect(requests).toBeDefined();
    expect(requests!.version).toBe('2.31.0');

    const numpy = findDep(deps, 'numpy');
    expect(numpy).toBeDefined();
    expect(numpy!.version).toBe('1.24.0');
  });

  it('handles packages without version as latest', async () => {
    const deps = await parser.parse(path.join(dir, 'requirements.txt'));
    const pandas = findDep(deps, 'pandas');
    expect(pandas).toBeDefined();
    expect(pandas!.version).toBe('latest');
  });

  it('strips extras syntax and extracts package name', async () => {
    const deps = await parser.parse(path.join(dir, 'requirements.txt'));

    const crypto = findDep(deps, 'cryptography');
    expect(crypto).toBeDefined();
    expect(crypto!.name).toBe('cryptography');
    expect(crypto!.name).not.toContain('[');

    const pytest = findDep(deps, 'pytest');
    expect(pytest).toBeDefined();
    expect(pytest!.name).toBe('pytest');
  });

  it('resolves license from dist-info METADATA License header', async () => {
    const deps = await parser.parse(path.join(dir, 'requirements.txt'));
    const requests = findDep(deps, 'requests');
    expect(requests!.license).toBe('Apache-2.0');
  });

  it('resolves license from dist-info classifiers', async () => {
    const deps = await parser.parse(path.join(dir, 'requirements.txt'));
    const flask = findDep(deps, 'flask');
    expect(flask!.license).toBe('BSD-3-Clause');
  });

  it('returns UNKNOWN for packages without installed metadata', async () => {
    const deps = await parser.parse(path.join(dir, 'requirements.txt'));
    const pandas = findDep(deps, 'pandas');
    expect(pandas!.license).toBe('UNKNOWN');
  });
});

describe('GoModParser', () => {
  let dir: string;
  let parser: GoModParser;

  beforeAll(() => {
    dir = makeTmpDir();
    parser = new GoModParser();

    writeFile(dir, 'go.mod', [
      'module github.com/example/test-app',
      '',
      'go 1.21',
      '',
      'require (',
      '\tgithub.com/spf13/cobra v1.8.0',
      '\tgithub.com/gin-gonic/gin v1.9.1 // indirect',
      '\tgolang.org/x/crypto v0.17.0',
      ')',
    ].join('\n'));

    writeFile(dir, 'vendor/github.com/spf13/cobra/LICENSE', [
      'MIT License',
      '',
      'Permission is hereby granted, free of charge, to any person obtaining a copy',
      'of this software and associated documentation files (the "Software"), to deal',
      'in the Software without restriction.',
    ].join('\n'));

    writeFile(dir, 'vendor/github.com/gin-gonic/gin/LICENSE', [
      'BSD 3-Clause License',
      '',
      'Redistributions in binary form must reproduce the above copyright notice.',
    ].join('\n'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('recognises go.mod files', () => {
    expect(parser.canParse('/some/path/go.mod')).toBe(true);
    expect(parser.canParse('/some/path/package.json')).toBe(false);
  });

  it('parses module name and require entries', async () => {
    const deps = await parser.parse(path.join(dir, 'go.mod'));
    expect(deps.length).toBe(3);

    const cobra = findDep(deps, 'github.com/spf13/cobra');
    expect(cobra).toBeDefined();
    expect(cobra!.version).toBe('v1.8.0');
    expect(cobra!.packageManager).toBe('go');
    expect(cobra!.dependencyChain[0]).toBe('github.com/example/test-app');
  });

  it('detects MIT license from LICENSE file content', async () => {
    const deps = await parser.parse(path.join(dir, 'go.mod'));
    const cobra = findDep(deps, 'github.com/spf13/cobra');
    expect(cobra!.license).toBe('MIT');
  });

  it('detects BSD-3-Clause from LICENSE file content', async () => {
    const deps = await parser.parse(path.join(dir, 'go.mod'));
    const gin = findDep(deps, 'github.com/gin-gonic/gin');
    expect(gin!.license).toBe('BSD-3-Clause');
  });

  it('returns UNKNOWN when no vendor or cache LICENSE exists', async () => {
    const deps = await parser.parse(path.join(dir, 'go.mod'));
    const crypto = findDep(deps, 'golang.org/x/crypto');
    expect(crypto!.license).toBe('UNKNOWN');
  });
});

describe('ParserRegistry', () => {
  it('returns the correct parser for each manifest type', () => {
    const registry = new ParserRegistry();
    expect(registry.getParser('/p/package.json')).toBeInstanceOf(PackageJsonParser);
    expect(registry.getParser('/p/requirements.txt')).toBeInstanceOf(RequirementsTxtParser);
    expect(registry.getParser('/p/go.mod')).toBeInstanceOf(GoModParser);
  });

  it('returns null for unknown file types', () => {
    const registry = new ParserRegistry();
    expect(registry.getParser('/p/Cargo.toml')).toBeNull();
  });

  it('exposes all three parsers via getAllParsers', () => {
    const registry = new ParserRegistry();
    expect(registry.getAllParsers()).toHaveLength(3);
  });
});
