#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { LicenseScanner, ReportGenerator } from './src/scanner';
import { ScanResult } from './src/types';

const program = new Command();

program
  .name('license-compliance-scanner')
  .description('Open Source License Compliance Scanner')
  .version('1.0.0')
  .requiredOption('--project <path>', 'Path to the project directory to scan')
  .option('--format <type>', 'Output format: console, json, markdown', 'console')
  .option('--output <file>', 'Output file path (for json/markdown formats)')
  .option('--strict', 'Exit with non-zero code on any warning or conflict', false)
  .parse(process.argv);

interface CliOptions {
  project: string;
  format: 'console' | 'json' | 'markdown';
  output?: string;
  strict: boolean;
}

const options = program.opts() as CliOptions;

async function main(): Promise<void> {
  const projectPath = path.resolve(options.project);

  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Project path does not exist: ${projectPath}`);
    process.exit(1);
  }

  const scanner = new LicenseScanner();
  const reportGenerator = new ReportGenerator();

  try {
    console.log(`\nScanning project: ${projectPath}\n`);

    const result: ScanResult = await scanner.scan(projectPath);

    let output: string;

    switch (options.format) {
      case 'json':
        output = reportGenerator.generateJsonReport(result);
        break;
      case 'markdown':
        output = reportGenerator.generateMarkdownReport(result);
        break;
      case 'console':
      default:
        output = reportGenerator.generateConsoleReport(result);
    }

    if (options.output) {
      const outputPath = path.resolve(options.output);
      await fs.promises.writeFile(outputPath, output, 'utf-8');
      console.log(`Report written to: ${outputPath}`);
    } else {
      console.log(output);
    }

    if (options.strict) {
      const hasIssues = result.summary.critical > 0 ||
        result.summary.high > 0 ||
        result.summary.medium > 0;

      if (hasIssues) {
        process.exit(1);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during scan:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
