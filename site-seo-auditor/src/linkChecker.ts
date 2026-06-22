import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { AuditOptions, CheckResult, CrawlResult, LinkKind } from './types';

export interface CheckTarget {
  url: string;
  kind: LinkKind;
  localPath: string | null;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

export async function checkCrawlLinks(
  crawl: CrawlResult,
  opts: AuditOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, CheckResult>> {
  const unique = new Map<string, CheckTarget>();
  for (const page of crawl.pages) {
    for (const link of page.links) {
      if (!unique.has(link.displayUrl)) {
        unique.set(link.displayUrl, {
          url: link.displayUrl,
          kind: link.kind,
          localPath: link.localPath,
        });
      }
    }
  }

  const targets = Array.from(unique.values());
  const results = await runConcurrent(
    targets,
    (target) => checkOne(target, opts),
    opts.concurrency,
    onProgress,
  );

  const map = new Map<string, CheckResult>();
  targets.forEach((target, index) => map.set(target.url, results[index]));
  return map;
}

async function checkOne(target: CheckTarget, opts: AuditOptions): Promise<CheckResult> {
  if (target.kind === 'external' || /^https?:\/\//i.test(target.url)) {
    return httpRequest(target.url, opts.timeout, opts.followExternal);
  }
  return fileCheck(target);
}

function fileCheck(target: CheckTarget): CheckResult {
  const { localPath, url } = target;
  if (localPath) {
    try {
      const stat = fs.statSync(localPath);
      if (stat.isFile()) {
        return { url, status: 200, ok: true, skipped: false, redirected: false, finalUrl: null, error: null };
      }
    } catch {
      // fall through to 404
    }
  }
  return { url, status: 404, ok: false, skipped: false, redirected: false, finalUrl: null, error: 'File not found' };
}

function httpRequest(
  originalUrl: string,
  timeoutMs: number,
  followExternal: boolean,
): Promise<CheckResult> {
  return new Promise((resolve) => {
    const finish = (result: CheckResult) => {
      resolve(result);
    };

    if (!followExternal) {
      finish({
        url: originalUrl,
        status: null,
        ok: false,
        skipped: true,
        redirected: false,
        finalUrl: null,
        error: 'Skipped (external checks disabled)',
      });
      return;
    }

    const run = (target: string, redirectsLeft: number): void => {
      let parsed: URL;
      try {
        parsed = new URL(target);
      } catch {
        finish({
          url: originalUrl,
          status: null,
          ok: false,
          skipped: false,
          redirected: false,
          finalUrl: null,
          error: 'Invalid URL',
        });
        return;
      }

      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(
        parsed,
        {
          method: 'GET',
          timeout: timeoutMs,
          headers: { 'User-Agent': 'site-seo-auditor/1.0', Accept: '*/*' },
        },
        (res) => {
          const status = res.statusCode || 0;
          if (REDIRECT_STATUSES.has(status) && res.headers.location && redirectsLeft > 0) {
            const next = new URL(res.headers.location, parsed).toString();
            res.resume();
            run(next, redirectsLeft - 1);
            return;
          }
          res.resume();
          finish({
            url: originalUrl,
            status,
            ok: status >= 200 && status < 400,
            skipped: false,
            redirected: target !== originalUrl,
            finalUrl: target !== originalUrl ? target : null,
            error: null,
          });
        },
      );

      const hardTimer = setTimeout(() => req.destroy(new Error('request timeout')), timeoutMs + 3000);

      req.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(hardTimer);
        finish({
          url: originalUrl,
          status: null,
          ok: false,
          skipped: false,
          redirected: false,
          finalUrl: null,
          error: err.code ? `${err.code}: ${err.message}` : err.message,
        });
      });

      req.on('response', () => clearTimeout(hardTimer));
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.end();
    };

    run(originalUrl, MAX_REDIRECTS);
  });
}

async function runConcurrent<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  let completed = 0;

  const next = async (): Promise<void> => {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i]);
      completed++;
      if (onProgress) onProgress(completed, items.length);
    }
  };

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => next(),
  );
  await Promise.all(runners);
  return results;
}
