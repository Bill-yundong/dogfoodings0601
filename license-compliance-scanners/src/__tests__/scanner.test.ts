import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LicenseScanner, ReportGenerator } from '../scanner';
import { ScanResult, Dependency, LicenseConflict } from '../types';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lcs-test-'));
}

const mockDependencies: Dependency[] = [
  {
    name: 'commander',
    version: '11.1.0',
    license: 'MIT',
    packageManager: 'npm',
    path: '/mock/package.json',
    dependencyChain: ['test-app', 'commander'],
  },
  {
    name: 'test-gpl-lib',
    version: '2.0.0',
    license: 'GPL-3.0-only',
    packageManager: 'npm',
    path: '/mock/package.json',
    dependencyChain: ['test-app', 'test-gpl-lib'],
  },
];

const mockConflicts: LicenseConflict[] = [
  {
    licenseA: 'GPL-3.0-only',
    licenseB: 'Proprietary',
    riskLevel: 'critical',
    description: 'Proprietary code cannot be distributed with GPL code',
    packagesInvolved: mockDependencies,
  },
];

const mockResult: ScanResult = {
  projectPath: '/mock/project',
  scannedFiles: ['/mock/project/package.json'],
  dependencies: mockDependencies,
  conflicts: mockConflicts,
  summary: {
    totalPackages: 2,
    critical: 1,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  },
};

describe('ReportGenerator', () => {
  const generator = new ReportGenerator();

  describe('generateConsoleReport', () => {
    it('includes the header and project path', () => {
      const output = generator.generateConsoleReport(mockResult);
      expect(output).toContain('LICENSE COMPLIANCE SCANNER');
      expect(output).toContain('/mock/project');
    });

    it('includes summary counts', () => {
      const output = generator.generateConsoleReport(mockResult);
      expect(output).toContain('CRITICAL');
      expect(output).toContain('Total Dependencies: 2');
    });

    it('lists conflict details with risk badges', () => {
      const output = generator.generateConsoleReport(mockResult);
      expect(output).toContain('GPL-3.0-only');
      expect(output).toContain('Proprietary');
      expect(output).toContain('CRITICAL');
    });

    it('shows no-conflict message when conflicts array is empty', () => {
      const cleanResult: ScanResult = {
        ...mockResult,
        conflicts: [],
        summary: { totalPackages: 2, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      };
      const output = generator.generateConsoleReport(cleanResult);
      expect(output).toContain('No critical or high-risk');
    });

    it('truncates package lists longer than 10', () => {
      const manyPackages: Dependency[] = Array.from({ length: 15 }, (_, i) => ({
        name: `pkg-${i}`,
        version: '1.0.0',
        license: 'MIT',
        packageManager: 'npm',
        path: '/mock',
        dependencyChain: ['root', `pkg-${i}`],
      }));
      const result: ScanResult = {
        ...mockResult,
        conflicts: [{
          licenseA: 'MIT',
          licenseB: 'MIT',
          riskLevel: 'low',
          description: 'test',
          packagesInvolved: manyPackages,
        }],
      };
      const output = generator.generateConsoleReport(result);
      expect(output).toContain('and 5 more');
    });
  });

  describe('generateJsonReport', () => {
    it('produces valid JSON with all fields', () => {
      const json = generator.generateJsonReport(mockResult);
      const parsed = JSON.parse(json);
      expect(parsed.projectPath).toBe('/mock/project');
      expect(parsed.summary.critical).toBe(1);
      expect(parsed.dependencies).toHaveLength(2);
      expect(parsed.conflicts).toHaveLength(1);
    });
  });

  describe('generateMarkdownReport', () => {
    it('includes markdown headers and tables', () => {
      const md = generator.generateMarkdownReport(mockResult);
      expect(md).toContain('# Open Source License Compliance Report');
      expect(md).toContain('| Risk Level | Count |');
      expect(md).toContain('## License Conflicts');
      expect(md).toContain('## Dependencies by License');
    });

    it('includes dependency chain in conflict section', () => {
      const md = generator.generateMarkdownReport(mockResult);
      expect(md).toContain('test-app → commander');
    });
  });
});

describe('LicenseScanner', () => {
  let dir: string;
  let scanner: LicenseScanner;

  beforeAll(() => {
    dir = makeTmpDir();
    scanner = new LicenseScanner();

    fs.mkdirSync(path.join(dir, 'node_modules', 'commander'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'node_modules', 'commander', 'package.json'),
      JSON.stringify({ name: 'commander', version: '11.1.0', license: 'MIT' }),
    );

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        version: '1.0.0',
        license: 'MIT',
        dependencies: { commander: '^11.1.0' },
      }),
    );
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('scans a project and returns dependencies and summary', async () => {
    const result = await scanner.scan(dir);

    expect(result.scannedFiles.length).toBeGreaterThanOrEqual(1);
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
    expect(result.summary.totalPackages).toBeGreaterThanOrEqual(1);

    const commander = result.dependencies.find(d => d.name === 'commander');
    expect(commander).toBeDefined();
    expect(commander!.license).toBe('MIT');
  });

  it('throws an error for a non-existent project path', async () => {
    await expect(scanner.scan('/nonexistent/path/xyz')).rejects.toThrow('does not exist');
  });
});
