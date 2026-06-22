import * as cheerio from 'cheerio';
import { OgTags, SeoIssue, SeoResult } from './types';

const TITLE_MIN = 10;
const TITLE_MAX = 60;
const DESC_MIN = 50;
const DESC_MAX = 160;

const OG_RULES: Array<{ key: keyof OgTags; deduction: number; message: string }> = [
  { key: 'og:title', deduction: 12, message: 'Missing og:title' },
  { key: 'og:description', deduction: 10, message: 'Missing og:description' },
  { key: 'og:image', deduction: 15, message: 'Missing og:image' },
  { key: 'og:url', deduction: 8, message: 'Missing og:url' },
  { key: 'og:type', deduction: 5, message: 'Missing og:type' },
];

export function analyzeSeo(html: string, pageUrl: string): SeoResult {
  const $ = cheerio.load(html);
  const issues: SeoIssue[] = [];

  const title = $('title').first().text().trim() || null;
  if (!title) {
    issues.push({ severity: 'critical', field: 'title', message: 'Missing <title> tag', deduction: 20 });
  } else if (title.length < TITLE_MIN) {
    issues.push({
      severity: 'warning',
      field: 'title',
      message: `Title too short (${title.length} chars, min ${TITLE_MIN})`,
      deduction: 10,
    });
  } else if (title.length > TITLE_MAX) {
    issues.push({
      severity: 'warning',
      field: 'title',
      message: `Title too long (${title.length} chars, max ${TITLE_MAX})`,
      deduction: 10,
    });
  }

  const description = $('meta[name="description"]').attr('content')?.trim() || null;
  if (!description) {
    issues.push({ severity: 'critical', field: 'description', message: 'Missing meta description', deduction: 20 });
  } else if (description.length < DESC_MIN) {
    issues.push({
      severity: 'warning',
      field: 'description',
      message: `Description too short (${description.length} chars, min ${DESC_MIN})`,
      deduction: 10,
    });
  } else if (description.length > DESC_MAX) {
    issues.push({
      severity: 'warning',
      field: 'description',
      message: `Description too long (${description.length} chars, max ${DESC_MAX})`,
      deduction: 10,
    });
  }

  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;
  if (!canonical) {
    issues.push({ severity: 'warning', field: 'canonical', message: 'Missing canonical link', deduction: 7 });
  }

  const ogTags: OgTags = {
    'og:title': $('meta[property="og:title"]').attr('content')?.trim() || null,
    'og:description': $('meta[property="og:description"]').attr('content')?.trim() || null,
    'og:image': $('meta[property="og:image"]').attr('content')?.trim() || null,
    'og:url': $('meta[property="og:url"]').attr('content')?.trim() || null,
    'og:type': $('meta[property="og:type"]').attr('content')?.trim() || null,
  };

  for (const rule of OG_RULES) {
    if (!ogTags[rule.key]) {
      issues.push({
        severity: 'warning',
        field: rule.key,
        message: rule.message,
        deduction: rule.deduction,
      });
    }
  }

  let score = 100;
  for (const issue of issues) score -= issue.deduction;
  score = Math.max(0, Math.min(100, score));

  void pageUrl;

  return { score, title, description, ogTags, issues, canonical };
}
