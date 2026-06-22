export type LinkKind = 'page' | 'resource' | 'external';

export interface RawLink {
  raw: string;
  displayUrl: string;
  localPath: string | null;
  source: string;
  kind: LinkKind;
}

export interface CrawledPage {
  pageUrl: string;
  absolutePath: string;
  html: string;
  links: RawLink[];
}

export interface CrawlResult {
  rootDir: string;
  entryUrl: string;
  pages: CrawledPage[];
}

export interface CheckResult {
  url: string;
  status: number | null;
  ok: boolean;
  skipped: boolean;
  redirected: boolean;
  finalUrl: string | null;
  error: string | null;
}

export interface OgTags {
  'og:title': string | null;
  'og:description': string | null;
  'og:image': string | null;
  'og:url': string | null;
  'og:type': string | null;
}

export interface SeoResult {
  score: number;
  title: string | null;
  description: string | null;
  ogTags: OgTags;
  issues: SeoIssue[];
  canonical: string | null;
}

export interface SeoIssue {
  severity: 'critical' | 'warning';
  field: string;
  message: string;
  deduction: number;
}

export interface PageLinkReport {
  raw: string;
  displayUrl: string;
  source: string;
  kind: LinkKind;
  check: CheckResult;
}

export interface PageReport {
  pageUrl: string;
  seo: SeoResult;
  links: PageLinkReport[];
  deadLinks: PageLinkReport[];
  totalLinks: number;
}

export interface AuditSummary {
  totalPages: number;
  totalLinks: number;
  uniqueUrlsChecked: number;
  deadLinks: number;
  deadReferences: number;
  externalLinks: number;
  avgSeoScore: number;
  worstSeoScore: number;
  bestSeoScore: number;
  pagesWithCriticalSeo: number;
}

export interface AuditReport {
  entryUrl: string;
  generatedAt: string;
  summary: AuditSummary;
  pages: PageReport[];
}

export interface AuditOptions {
  entry: string;
  concurrency: number;
  timeout: number;
  followExternal: boolean;
  maxPages: number;
}
