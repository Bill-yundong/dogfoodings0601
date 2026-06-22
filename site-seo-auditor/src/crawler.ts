import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cheerio from 'cheerio';
import { AuditOptions, CrawlResult, CrawledPage, LinkKind, RawLink } from './types';

const SKIP_PREFIXES = /^(#|javascript:|mailto:|tel:|data:|sms:|blob:|vbscript:|about:|file:)/i;
const RESOURCE_TAGS = new Set(['link', 'script', 'img', 'source', 'video', 'audio', 'use']);

export async function crawl(entry: string, opts: AuditOptions): Promise<CrawlResult> {
  const entryAbs = path.resolve(entry);
  const rootDir = path.dirname(entryAbs);
  const pages: CrawledPage[] = [];
  const visited = new Set<string>();
  const queue: string[] = [entryAbs];

  while (queue.length > 0 && pages.length < opts.maxPages) {
    const current = queue.shift() as string;
    const key = path.normalize(current);
    if (visited.has(key)) continue;
    visited.add(key);

    let html: string;
    try {
      html = fs.readFileSync(current, 'utf8');
    } catch {
      continue;
    }

    const links = extractLinks(html, current, rootDir);
    pages.push({
      pageUrl: toSitePath(current, rootDir),
      absolutePath: current,
      html,
      links,
    });

    for (const link of links) {
      if (
        link.kind === 'page' &&
        link.localPath &&
        link.localPath.endsWith('.html') &&
        !visited.has(path.normalize(link.localPath)) &&
        !queue.includes(link.localPath)
      ) {
        queue.push(link.localPath);
      }
    }
  }

  return {
    rootDir,
    entryUrl: toSitePath(entryAbs, rootDir),
    pages,
  };
}

function extractLinks(html: string, currentPageFile: string, rootDir: string): RawLink[] {
  const $ = cheerio.load(html);
  const links: RawLink[] = [];
  const seen = new Set<string>();
  const siteDir = path.posix.dirname(toSitePath(currentPageFile, rootDir));

  const add = (rawValue: string | undefined, source: string): void => {
    if (!rawValue) return;
    const cleaned = rawValue.trim();
    if (!cleaned || SKIP_PREFIXES.test(cleaned)) return;

    if (cleaned.startsWith('//')) {
      push(links, seen, {
        raw: rawValue,
        displayUrl: 'https:' + cleaned,
        localPath: null,
        source,
        kind: 'external',
      });
      return;
    }

    if (/^https?:\/\//i.test(cleaned)) {
      push(links, seen, {
        raw: rawValue,
        displayUrl: cleaned,
        localPath: null,
        source,
        kind: 'external',
      });
      return;
    }

    const pathPart = cleaned.split('#')[0].split('?')[0];
    if (!pathPart || pathPart === '.') return;

    const displayUrl =
      pathPart.startsWith('/')
        ? path.posix.resolve('/', pathPart)
        : path.posix.resolve(siteDir, pathPart);

    const localFile = path.join(rootDir, displayUrl);
    const existing = findLocalFile(localFile);
    const kind = determineKind(source, existing);

    push(links, seen, { raw: rawValue, displayUrl, localPath: existing, source, kind });
  };

  $('a[href]').each((_, el) => add($(el).attr('href'), 'a[href]'));
  $('link[href]').each((_, el) => add($(el).attr('href'), 'link[href]'));
  $('script[src]').each((_, el) => add($(el).attr('src'), 'script[src]'));
  $('img[src]').each((_, el) => add($(el).attr('src'), 'img[src]'));
  $('img[srcset]').each((_, el) =>
    parseSrcset($(el).attr('srcset') || '').forEach((u) => add(u, 'img[srcset]')),
  );
  $('source[src]').each((_, el) => add($(el).attr('src'), 'source[src]'));
  $('source[srcset]').each((_, el) =>
    parseSrcset($(el).attr('srcset') || '').forEach((u) => add(u, 'source[srcset]')),
  );
  $('video[src]').each((_, el) => add($(el).attr('src'), 'video[src]'));
  $('audio[src]').each((_, el) => add($(el).attr('src'), 'audio[src]'));
  $('iframe[src]').each((_, el) => add($(el).attr('src'), 'iframe[src]'));
  $('use[href]').each((_, el) => add($(el).attr('href'), 'use[href]'));
  $('meta[property="og:image"]').each((_, el) => add($(el).attr('content'), 'meta[og:image]'));
  $('meta[property="og:url"]').each((_, el) => add($(el).attr('content'), 'meta[og:url]'));

  return links;
}

function push(links: RawLink[], seen: Set<string>, link: RawLink): void {
  if (seen.has(link.displayUrl)) return;
  seen.add(link.displayUrl);
  links.push(link);
}

function determineKind(source: string, existing: string | null): LinkKind {
  const tag = source.split('[')[0];
  if (RESOURCE_TAGS.has(tag)) return 'resource';
  if (existing && path.extname(existing) !== '' && path.extname(existing) !== '.html') {
    return 'resource';
  }
  return 'page';
}

export function findLocalFile(target: string): string | null {
  let stat: fs.Stats | null = null;
  try {
    stat = fs.statSync(target);
  } catch {
    stat = null;
  }

  if (stat) {
    if (stat.isFile()) return target;
    if (stat.isDirectory()) {
      const idx = path.join(target, 'index.html');
      if (fs.existsSync(idx)) return idx;
      return null;
    }
  }

  if (path.extname(target) === '') {
    const withHtml = target + '.html';
    if (fs.existsSync(withHtml)) return withHtml;
  }

  return null;
}

function parseSrcset(srcset: string): string[] {
  return srcset
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+/)[0])
    .filter(Boolean);
}

export function toSitePath(absPath: string, rootDir: string): string {
  const rel = path.relative(rootDir, absPath);
  const normalized = rel.split(path.sep).join('/');
  return '/' + normalized.replace(/^\.\//, '').replace(/^\//, '');
}
