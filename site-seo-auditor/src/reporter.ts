import {
  AuditReport,
  AuditSummary,
  CheckResult,
  CrawlResult,
  PageLinkReport,
  PageReport,
  SeoResult,
} from './types';

export interface ColorPalette {
  red: (s: string) => string;
  green: (s: string) => string;
  yellow: (s: string) => string;
  cyan: (s: string) => string;
  gray: (s: string) => string;
  dim: (s: string) => string;
  bold: (s: string) => string;
}

function makeColors(useColor: boolean): ColorPalette {
  if (!useColor) {
    const passthrough = (s: string) => s;
    return {
      red: passthrough,
      green: passthrough,
      yellow: passthrough,
      cyan: passthrough,
      gray: passthrough,
      dim: passthrough,
      bold: passthrough,
    };
  }
  const wrap = (code: string) => (s: string) => `\x1b[${code}m${s}\x1b[0m`;
  return {
    red: wrap('31'),
    green: wrap('32'),
    yellow: wrap('33'),
    cyan: wrap('36'),
    gray: wrap('90'),
    dim: wrap('2'),
    bold: wrap('1'),
  };
}

export function buildReport(
  crawl: CrawlResult,
  checks: Map<string, CheckResult>,
  seoByPage: Map<string, SeoResult>,
): AuditReport {
  const pages: PageReport[] = crawl.pages.map((page) => {
    const seo =
      seoByPage.get(page.pageUrl) ||
      ({
        score: 0,
        title: null,
        description: null,
        ogTags: {
          'og:title': null,
          'og:description': null,
          'og:image': null,
          'og:url': null,
          'og:type': null,
        },
        issues: [],
        canonical: null,
      } as SeoResult);

    const links: PageLinkReport[] = page.links.map((link) => {
      const check =
        checks.get(link.displayUrl) ||
        ({
          url: link.displayUrl,
          status: null,
          ok: false,
          skipped: false,
          redirected: false,
          finalUrl: null,
          error: 'Not checked',
        } as CheckResult);
      return {
        raw: link.raw,
        displayUrl: link.displayUrl,
        source: link.source,
        kind: link.kind,
        check,
      };
    });

    const deadLinks = links.filter((l) => isDead(l.check));

    return {
      pageUrl: page.pageUrl,
      seo,
      links,
      deadLinks,
      totalLinks: links.length,
    };
  });

  pages.sort((a, b) => a.seo.score - b.seo.score);

  return {
    entryUrl: crawl.entryUrl,
    generatedAt: new Date().toISOString(),
    summary: computeSummary(pages),
    pages,
  };
}

function computeSummary(pages: PageReport[]): AuditSummary {
  const totalPages = pages.length;
  const totalLinks = pages.reduce((sum, p) => sum + p.totalLinks, 0);
  const deadReferences = pages.reduce((sum, p) => sum + p.deadLinks.length, 0);
  const externalLinks = pages.reduce(
    (sum, p) => sum + p.links.filter((l) => l.kind === 'external').length,
    0,
  );

  const uniqueUrls = new Set<string>();
  const deadUrls = new Set<string>();
  for (const page of pages) {
    for (const link of page.links) {
      uniqueUrls.add(link.displayUrl);
      if (isDead(link.check)) deadUrls.add(link.displayUrl);
    }
  }
  const uniqueUrlsChecked = uniqueUrls.size;
  const deadLinks = deadUrls.size;

  const scores = pages.map((p) => p.seo.score);
  const avgSeoScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const worstSeoScore = scores.length ? Math.min(...scores) : 0;
  const bestSeoScore = scores.length ? Math.max(...scores) : 0;
  const pagesWithCriticalSeo = pages.filter((p) =>
    p.seo.issues.some((i) => i.severity === 'critical'),
  ).length;

  return {
    totalPages,
    totalLinks,
    uniqueUrlsChecked,
    deadLinks,
    deadReferences,
    externalLinks,
    avgSeoScore,
    worstSeoScore,
    bestSeoScore,
    pagesWithCriticalSeo,
  };
}

export function renderReport(report: AuditReport, useColor: boolean): string {
  const c = makeColors(useColor);
  const lines: string[] = [];

  const rule = c.dim('─'.repeat(64));
  lines.push(c.bold('╔' + '═'.repeat(62) + '╗'));
  lines.push(c.bold('║') + c.bold('  SITE LINK HEALTH & SEO AUDIT REPORT') + ' '.repeat(23) + c.bold('║'));
  lines.push(c.bold('╚' + '═'.repeat(62) + '╝'));
  lines.push(`Entry:     ${c.cyan(report.entryUrl)}`);
  lines.push(`Generated: ${report.generatedAt.replace('T', ' ').replace(/\..+/, '')}`);
  lines.push('');
  lines.push(`${c.bold('── Summary ')}${rule.slice('── Summary '.length)}`);
  lines.push(`  Pages crawled:        ${padNum(report.summary.totalPages)}`);
  lines.push(`  Link references:     ${padNum(report.summary.totalLinks)}`);
  lines.push(`  Unique URLs checked: ${padNum(report.summary.uniqueUrlsChecked)}`);
  lines.push(`  Dead links (unique): ${c.red(padNum(report.summary.deadLinks))}`);
  lines.push(`  Dead references:     ${padNum(report.summary.deadReferences)}`);
  lines.push(`  External links:      ${padNum(report.summary.externalLinks)}`);
  lines.push(
    `  Average SEO score:    ${colorScore(report.summary.avgSeoScore, c)} / 100`,
  );
  lines.push(`  Worst SEO score:      ${colorScore(report.summary.worstSeoScore, c)}`);
  lines.push(`  Best SEO score:       ${colorScore(report.summary.bestSeoScore, c)}`);
  lines.push(
    `  Pages with critical:  ${c.red(padNum(report.summary.pagesWithCriticalSeo))}`,
  );
  lines.push('');

  const headerTitle = '── Pages (sorted by SEO score, worst first) ';
  lines.push(c.bold(headerTitle) + c.dim('─'.repeat(Math.max(0, 64 - headerTitle.length))));
  lines.push('');

  report.pages.forEach((page, index) => {
    renderPage(page, index + 1, c, lines);
  });

  renderDeadLinkIndex(report, c, lines);

  return lines.join('\n');
}

function renderPage(page: PageReport, n: number, c: ColorPalette, lines: string[]): void {
  const label = colorScore(page.seo.score, c);
  const rating = ratingLabel(page.seo.score, c);
  lines.push(
    `${c.bold(`[${n}]`)} ${c.bold(c.cyan(page.pageUrl))}  ${c.bold('SEO:')} ${label}/100 ${rating}`,
  );

  lines.push(`    ${c.dim('Title:')}       ${formatValue(page.seo.title, c)}`);
  lines.push(`    ${c.dim('Description:')} ${formatValue(page.seo.description, c)}`);
  lines.push(`    ${c.dim('Canonical:')}   ${formatValue(page.seo.canonical, c)}`);

  if (page.seo.issues.length > 0) {
    lines.push(`    ${c.bold('SEO Issues:')}`);
    for (const issue of page.seo.issues) {
      const sev =
        issue.severity === 'critical' ? c.red('CRITICAL') : c.yellow('WARNING ');
      const mark = issue.severity === 'critical' ? c.red('✗') : c.yellow('!');
      lines.push(
        `      ${mark} ${sev}  ${padStr(issue.field, 16)} ${padStr(issue.message, 44)} ${c.dim(`(-${issue.deduction})`)}`,
      );
    }
  } else {
    lines.push(`    ${c.green('✓ No SEO issues found')}`);
  }

  const sortedLinks = [...page.links].sort((a, b) => {
    const aDead = isDead(a.check) ? 0 : 1;
    const bDead = isDead(b.check) ? 0 : 1;
    if (aDead !== bDead) return aDead - bDead;
    return a.displayUrl.localeCompare(b.displayUrl);
  });

  lines.push(`    ${c.bold('Links')} ${c.dim(`(${page.totalLinks}, ${c.red(String(page.deadLinks.length) + ' dead')})`)}:`);
  for (const link of sortedLinks) {
    lines.push(`      ${formatLink(link, c)}`);
  }
  lines.push('');
}

function formatLink(link: PageLinkReport, c: ColorPalette): string {
  const { check } = link;
  const kindTag = c.dim(padStr(kindLabel(link.kind), 6));
  const source = c.gray(padStr(link.source, 16));

  if (check.skipped) {
    return `  ${c.yellow('•')} ${c.yellow(padStr('SKIP', 4))} ${kindTag} ${source} ${link.displayUrl} ${c.dim(`(${check.error})`)}`;
  }

  const statusStr = check.status === null ? 'ERR' : String(check.status);
  const mark = check.ok ? c.green('✓') : c.red('✗');
  const statusColored = check.ok
    ? c.green(padStr(statusStr, 4))
    : c.red(padStr(statusStr, 4));
  let line = `  ${mark} ${statusColored} ${kindTag} ${source} ${link.displayUrl}`;

  if (!check.ok) {
    const err = check.error ? ` ${c.red('→ DEAD')} ${c.dim(`(${check.error})`)}` : ` ${c.red('→ DEAD')}`;
    line += err;
  } else if (check.redirected && check.finalUrl) {
    line += ` ${c.dim(`→ ${check.finalUrl}`)}`;
  }
  return line;
}

function isDead(check: CheckResult): boolean {
  return !check.ok && !check.skipped;
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'external':
      return 'ext';
    case 'resource':
      return 'res';
    default:
      return 'page';
  }
}

function renderDeadLinkIndex(report: AuditReport, c: ColorPalette, lines: string[]): void {
  const dead = new Map<string, string[]>();
  for (const page of report.pages) {
    for (const link of page.links) {
      if (isDead(link.check)) {
        const list = dead.get(link.displayUrl) || [];
        list.push(page.pageUrl);
        dead.set(link.displayUrl, list);
      }
    }
  }

  if (dead.size === 0) return;

  const header = '── Dead Link Index (unique) ';
  lines.push(c.bold(header) + c.dim('─'.repeat(Math.max(0, 64 - header.length))));
  lines.push('');
  let i = 1;
  for (const [url, refs] of dead) {
    const status = report.pages
      .flatMap((p) => p.links)
      .find((l) => l.displayUrl === url)?.check.status;
    const statusStr = status === null ? 'ERR' : String(status);
    lines.push(
      `  ${c.bold(`${i}.`)} ${c.red(url)} ${c.dim(`[${statusStr}]`)} ${c.gray(`referenced by ${refs.join(', ')}`)}`,
    );
    i++;
  }
}

function colorScore(score: number, c: ColorPalette): string {
  if (score >= 80) return c.green(padNum(score));
  if (score >= 50) return c.yellow(padNum(score));
  return c.red(padNum(score));
}

function ratingLabel(score: number, c: ColorPalette): string {
  if (score >= 90) return c.green('(EXCELLENT)');
  if (score >= 80) return c.green('(GOOD)');
  if (score >= 50) return c.yellow('(FAIR)');
  return c.red('(POOR)');
}

function formatValue(value: string | null, c: ColorPalette): string {
  if (!value) return c.red('(missing)');
  if (value.length > 60) return c.gray(`${value.slice(0, 57)}...`);
  return c.gray(value);
}

function padNum(n: number): string {
  return n < 10 ? ` ${n}` : String(n);
}

function padStr(s: string, width: number): string {
  const str = s.length > width ? s.slice(0, width) : s;
  return str + ' '.repeat(Math.max(0, width - str.length));
}
