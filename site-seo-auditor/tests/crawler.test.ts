import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditOptions } from '../src/types';
import { crawl, findLocalFile } from '../src/crawler';

const DEFAULT_OPTS: AuditOptions = {
  entry: '',
  concurrency: 8,
  timeout: 8000,
  followExternal: false,
  maxPages: 100,
};

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'seo-audit-crawler-'));
}

function writeFile(root: string, rel: string, content: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

describe('crawler', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe('findLocalFile', () => {
    it('resolves an existing directory to its index.html', () => {
      writeFile(tmp, 'docs/index.html', '<html><body>docs</body></html>');
      const docsDir = path.join(tmp, 'docs');
      const result = findLocalFile(docsDir);
      expect(result).toBe(path.join(tmp, 'docs/index.html'));
    });

    it('returns null for a directory without index.html', () => {
      fs.mkdirSync(path.join(tmp, 'empty'));
      const result = findLocalFile(path.join(tmp, 'empty'));
      expect(result).toBeNull();
    });

    it('returns the file path directly for an existing file', () => {
      writeFile(tmp, 'page.html', '<html></html>');
      const result = findLocalFile(path.join(tmp, 'page.html'));
      expect(result).toBe(path.join(tmp, 'page.html'));
    });

    it('returns null for a non-existent path', () => {
      const result = findLocalFile(path.join(tmp, 'nonexistent.html'));
      expect(result).toBeNull();
    });
  });

  describe('crawl', () => {
    it('extracts relative paths as site-absolute URLs', async () => {
      writeFile(
        tmp,
        'index.html',
        `<html><head></head><body>
          <a href="about.html">About</a>
          <a href="./products.html">Products</a>
        </body></html>`,
      );
      writeFile(tmp, 'about.html', '<html><body>about</body></html>');
      writeFile(tmp, 'products.html', '<html><body>products</body></html>');

      const entry = path.join(tmp, 'index.html');
      const result = await crawl(entry, { ...DEFAULT_OPTS, entry });

      const indexPage = result.pages.find((p) => p.pageUrl === '/index.html');
      expect(indexPage).toBeDefined();

      const displayUrls = indexPage!.links.map((l) => l.displayUrl);
      expect(displayUrls).toContain('/about.html');
      expect(displayUrls).toContain('/products.html');
    });

    it('extracts absolute-paths (/foo) correctly', async () => {
      writeFile(
        tmp,
        'nested/index.html',
        `<html><head></head><body>
          <a href="/top-page.html">top</a>
          <img src="/assets/logo.png" alt="logo">
        </body></html>`,
      );
      writeFile(tmp, 'nested/top-page.html', '<html><body>top</body></html>');
      writeFile(tmp, 'nested/assets/logo.png', 'binarystub');

      const entry = path.join(tmp, 'nested/index.html');
      const result = await crawl(entry, { ...DEFAULT_OPTS, entry });

      const nested = result.pages.find((p) => p.pageUrl === '/index.html');
      expect(nested).toBeDefined();
      const urls = nested!.links.map((l) => l.displayUrl);
      expect(urls).toContain('/top-page.html');
      expect(urls).toContain('/assets/logo.png');
    });

    it('extracts each image in a srcset individually', async () => {
      writeFile(
        tmp,
        'index.html',
        `<html><head></head><body>
          <picture>
            <source srcset="img/small.webp 1x, img/large.webp 2x, img/wide.webp 1024w">
          </picture>
        </body></html>`,
      );
      writeFile(tmp, 'img/small.webp', 'a');
      writeFile(tmp, 'img/large.webp', 'b');
      writeFile(tmp, 'img/wide.webp', 'c');

      const entry = path.join(tmp, 'index.html');
      const result = await crawl(entry, { ...DEFAULT_OPTS, entry });

      const index = result.pages[0];
      const urls = index.links.map((l) => l.displayUrl);
      expect(urls).toContain('/img/small.webp');
      expect(urls).toContain('/img/large.webp');
      expect(urls).toContain('/img/wide.webp');
    });

    it('strips fragment anchors (#xxx) and query strings (?x=y) before checking', async () => {
      writeFile(
        tmp,
        'index.html',
        `<html><head></head><body>
          <a href="about.html#section-one">about with hash</a>
          <a href="about.html?foo=bar#baz">about with query + hash</a>
        </body></html>`,
      );
      writeFile(tmp, 'about.html', '<html><body>about</body></html>');

      const entry = path.join(tmp, 'index.html');
      const result = await crawl(entry, { ...DEFAULT_OPTS, entry });

      const index = result.pages.find((p) => p.pageUrl === '/index.html');
      expect(index).toBeDefined();

      const displayUrls = index!.links.map((l) => l.displayUrl);
      expect(displayUrls).toHaveLength(1);
      expect(displayUrls[0]).toBe('/about.html');
      expect(displayUrls).not.toContain('/about.html#section-one');
    });
  });
});
