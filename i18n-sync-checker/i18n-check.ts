#!/usr/bin/env node
import { compare, totalIssues } from './src/comparator';
import { printFixSummary, printReport } from './src/reporter';
import { repair } from './src/repair';
import { scanDirectory } from './src/scanner';
import { LocaleFile, SyncReport } from './src/types';

interface CliOptions {
  dir?: string;
  base?: string;
  fix: boolean;
  json: boolean;
}

function printHelp(): void {
  console.log(`
Usage: npx ts-node i18n-check.ts <locales-dir> [options]

Options:
  --base <lang>   Reference language code (default: auto-detect, prefer "en")
  --fix           Auto-fill missing keys and mark them as [TODO:i18n]
  --json          Output the report as JSON
  -h, --help      Show this help

Examples:
  npx ts-node i18n-check.ts ./locales
  npx ts-node i18n-check.ts ./locales --base en --fix
`);
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const opts: CliOptions = { fix: false, json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else if (a === '--base') {
      opts.base = args[++i];
    } else if (a === '--fix') {
      opts.fix = true;
    } else if (a === '--json') {
      opts.json = true;
    } else if (!a.startsWith('--')) {
      opts.dir = a;
    }
  }
  return opts;
}

function detectBase(locales: LocaleFile[], preferred?: string): LocaleFile {
  if (preferred) {
    const found = locales.find((l) => l.lang === preferred);
    if (!found) {
      throw new Error(
        `Base language "${preferred}" not found. Available: ${locales
          .map((l) => l.lang)
          .join(', ')}`,
      );
    }
    return found;
  }
  const en = locales.find((l) => l.lang === 'en');
  if (en) return en;
  return locales.slice().sort((a, b) => b.flat.length - a.flat.length)[0];
}

function main(): void {
  const opts = parseArgs(process.argv);
  if (!opts.dir) {
    printHelp();
    process.exit(1);
  }

  let locales: LocaleFile[];
  try {
    locales = scanDirectory(opts.dir);
  } catch (e) {
    console.error(`\x1b[31mError: ${(e as Error).message}\x1b[0m`);
    process.exit(2);
  }

  const base = detectBase(locales, opts.base);
  const others = locales.filter((l) => l.lang !== base.lang);
  let report: SyncReport = compare(base, others);

  if (opts.fix) {
    const result = repair(locales, report);
    printFixSummary(result);
    locales = scanDirectory(opts.dir);
    const fixedBase = detectBase(locales, opts.base);
    const fixedOthers = locales.filter((l) => l.lang !== fixedBase.lang);
    report = compare(fixedBase, fixedOthers);
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  process.exit(totalIssues(report) === 0 ? 0 : 1);
}

main();
