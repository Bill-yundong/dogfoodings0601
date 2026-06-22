import * as fs from 'node:fs';
import * as path from 'node:path';
import { AuditOptions } from './src/types';
import { crawl } from './src/crawler';
import { checkCrawlLinks } from './src/linkChecker';
import { analyzeSeo } from './src/seoAnalyzer';
import { buildReport, renderReport } from './src/reporter';

interface CliArgs extends AuditOptions {
  color: boolean;
  rawEntry: string;
}

const HELP = `Site Link Health & SEO Audit Tool

Usage:
  npx ts-node audit.ts --entry <path-or-url> [options]

Options:
  --entry <path>         Entry HTML file (e.g. ./dist/index.html)   [required]
  --concurrency <n>      Concurrent link checks              (default 8)
  --timeout <ms>         Per-request timeout in ms          (default 8000)
  --max-pages <n>        Max pages to crawl                  (default 500)
  --no-external          Skip HTTP checks for external links
  --no-color             Disable colored output
  -h, --help             Show this help

Example:
  npx ts-node audit.ts --entry ./dist/index.html
`;

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    entry: '',
    rawEntry: '',
    concurrency: 8,
    timeout: 8000,
    followExternal: true,
    maxPages: 500,
    color: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => argv[++i];
    if (a === '-h' || a === '--help') {
      process.stdout.write(HELP);
      process.exit(0);
    } else if (a === '--entry' || a.startsWith('--entry=')) {
      const v = a.startsWith('--entry=') ? a.slice('--entry='.length) : next();
      args.entry = v;
      args.rawEntry = v;
    } else if (a === '--concurrency' || a.startsWith('--concurrency=')) {
      args.concurrency = parseNum(a, next, '--concurrency');
    } else if (a === '--timeout' || a.startsWith('--timeout=')) {
      args.timeout = parseNum(a, next, '--timeout');
    } else if (a === '--max-pages' || a.startsWith('--max-pages=')) {
      args.maxPages = parseNum(a, next, '--max-pages');
    } else if (a === '--no-external') {
      args.followExternal = false;
    } else if (a === '--no-color') {
      args.color = false;
    } else if (a.startsWith('--')) {
      process.stderr.write(`Unknown option: ${a}\n`);
    }
  }

  return args;
}

function parseNum(a: string, next: () => string, name: string): number {
  const raw = a.includes('=') ? a.split('=')[1] : next();
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) {
    process.stderr.write(`Invalid number for ${name}: ${raw}\n`);
    process.exit(1);
  }
  return n;
}

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.entry) {
    process.stderr.write('Error: --entry is required\n\n');
    process.stderr.write(HELP);
    process.exit(1);
  }

  const entryPath = path.resolve(args.entry);
  if (!fs.existsSync(entryPath) || !fs.statSync(entryPath).isFile()) {
    process.stderr.write(`Error: entry HTML file not found: ${entryPath}\n`);
    process.exit(1);
  }

  const opts: AuditOptions = {
    entry: entryPath,
    concurrency: args.concurrency,
    timeout: args.timeout,
    followExternal: args.followExternal,
    maxPages: args.maxPages,
  };

  log(`▶ Crawling from ${args.rawEntry} (root: ${path.dirname(entryPath)})`);
  const crawlResult = await crawl(opts.entry, opts);

  const totalRefs = crawlResult.pages.reduce((s, p) => s + p.links.length, 0);
  const uniqueUrls = new Set(
    crawlResult.pages.flatMap((p) => p.links.map((l) => l.displayUrl)),
  ).size;
  log(`  ✓ Crawled ${crawlResult.pages.length} page(s), ${totalRefs} link refs (${uniqueUrls} unique URLs)`);

  if (crawlResult.pages.length === 0) {
    process.stderr.write('No crawlable pages found.\n');
    process.exit(0);
  }

  log(`▶ Checking ${uniqueUrls} links (concurrency ${opts.concurrency}, timeout ${opts.timeout}ms)`);
  let lastPct = -1;
  const checks = await checkCrawlLinks(crawlResult, opts, (done, total) => {
    const pct = total > 0 ? Math.floor((done / total) * 100) : 0;
    if (pct !== lastPct) {
      lastPct = pct;
      process.stderr.write(`\r  Progress: ${done}/${total} (${pct}%)   `);
    }
  });
  process.stderr.write('\n');

  const deadCount = Array.from(checks.values()).filter((c) => !c.ok && !c.skipped).length;
  log(`  ✓ Done. ${deadCount} dead link(s) detected`);

  log('▶ Analyzing on-page SEO...');
  const seoByPage = new Map();
  for (const page of crawlResult.pages) {
    seoByPage.set(page.pageUrl, analyzeSeo(page.html, page.pageUrl));
  }

  const report = buildReport(crawlResult, checks, seoByPage);
  report.entryUrl = args.rawEntry;

  const useColor = args.color && process.stdout.isTTY !== false;
  const output = renderReport(report, useColor);
  process.stdout.write(output + '\n');

  log(
    deadCount > 0
      ? `\n⚠ Audit finished with ${deadCount} dead link(s).`
      : '\n✓ Audit finished. No dead links found.',
  );
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.stack || err.message : String(err)}\n`);
  process.exit(1);
});
