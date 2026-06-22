import {
  CheckResult,
  CrawlResult,
  CrawledPage,
  RawLink,
  SeoResult,
} from '../src/types';
import { buildReport, padNum } from '../src/reporter';

describe('reporter', () => {
  describe('padNum', () => {
    it('pads a 1-digit number to width 4', () => {
      expect(padNum(5)).toBe('   5');
      expect(padNum(5)).toHaveLength(4);
    });

    it('pads a 2-digit number to width 4', () => {
      expect(padNum(42)).toBe('  42');
      expect(padNum(42)).toHaveLength(4);
    });

    it('pads a 3-digit number to width 4', () => {
      expect(padNum(100)).toBe(' 100');
      expect(padNum(100)).toHaveLength(4);
    });

    it('pads a 4-digit number to width 4', () => {
      expect(padNum(9999)).toBe('9999');
      expect(padNum(9999)).toHaveLength(4);
    });

    it('has constant output width for inputs 0-9999', () => {
      const samples = [0, 1, 9, 10, 99, 100, 999, 1000, 9999];
      for (const n of samples) {
        expect(padNum(n)).toHaveLength(4);
      }
    });
  });

  describe('buildReport sort order', () => {
    function emptyCheck(url: string): CheckResult {
      return {
        url,
        status: 200,
        ok: true,
        skipped: false,
        redirected: false,
        finalUrl: null,
        error: null,
      };
    }

    function pageWithScore(pageUrl: string, score: number): CrawledPage {
      const link: RawLink = {
        raw: '/foo',
        displayUrl: '/foo',
        localPath: null,
        source: 'a[href]',
        kind: 'page',
      };
      return {
        pageUrl,
        absolutePath: `/tmp/${pageUrl}.html`,
        html: `<html><head><title>t</title></head><body></body></html>`,
        links: [link],
      };
    }

    function seoForScore(score: number): SeoResult {
      return {
        score,
        title: 't',
        description: 'd'.repeat(80),
        ogTags: {
          'og:title': 't',
          'og:description': 'd'.repeat(80),
          'og:image': '/i.png',
          'og:url': '/p',
          'og:type': 'website',
        },
        issues: [],
        canonical: '/p',
      };
    }

    it('sorts pages by ascending SEO score so worst comes first', () => {
      const pages: CrawledPage[] = [
        pageWithScore('/good.html', 95),
        pageWithScore('/bad.html', 12),
        pageWithScore('/mid.html', 60),
        pageWithScore('/worst.html', 3),
      ];

      const crawl: CrawlResult = {
        rootDir: '/tmp',
        entryUrl: '/good.html',
        pages,
      };

      const checks = new Map<string, CheckResult>();
      checks.set('/foo', emptyCheck('/foo'));

      const seoByPage = new Map<string, SeoResult>();
      seoByPage.set('/good.html', seoForScore(95));
      seoByPage.set('/bad.html', seoForScore(12));
      seoByPage.set('/mid.html', seoForScore(60));
      seoByPage.set('/worst.html', seoForScore(3));

      const report = buildReport(crawl, checks, seoByPage);

      const order = report.pages.map((p) => p.pageUrl);
      expect(order).toEqual(['/worst.html', '/bad.html', '/mid.html', '/good.html']);
      expect(report.pages[0].seo.score).toBe(3);
      expect(report.pages[report.pages.length - 1].seo.score).toBe(95);
    });
  });
});
