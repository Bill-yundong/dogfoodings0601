import { analyzeSeo } from '../src/seoAnalyzer';

const PERFECT_TITLE = 'Example Title Perfectly Sized Within Range';
const PERFECT_DESCRIPTION =
  'An excellent description that meets the minimum length requirement and yet remains short enough to avoid any truncation penalties.';

describe('seoAnalyzer', () => {
  it('deducts 20 points for missing <title> tag', () => {
    const html = `<!DOCTYPE html><html><head>
      <meta name="description" content="${PERFECT_DESCRIPTION}">
      <meta property="og:title" content="OG Title">
      <meta property="og:description" content="OG description">
      <meta property="og:image" content="/img.png">
      <meta property="og:url" content="/page">
      <meta property="og:type" content="website">
      <link rel="canonical" href="/page">
    </head><body></body></html>`;

    const result = analyzeSeo(html, '/page');
    const missingTitle = result.issues.find(
      (i) => i.field === 'title' && i.message.startsWith('Missing'),
    );
    expect(missingTitle).toBeDefined();
    expect(missingTitle!.deduction).toBe(20);
    expect(result.title).toBeNull();
    expect(result.score).toBe(100 - 20);
  });

  it('computes total score when all 5 OG tags are missing but title/description/canonical are valid', () => {
    const html = `<!DOCTYPE html><html><head>
      <title>${PERFECT_TITLE}</title>
      <meta name="description" content="${PERFECT_DESCRIPTION}">
      <link rel="canonical" href="/page">
    </head><body></body></html>`;

    const result = analyzeSeo(html, '/page');

    // og:title -12, og:description -10, og:image -15, og:url -8, og:type -5 = -50
    const ogDeductions = result.issues
      .filter((i) => i.field.startsWith('og:'))
      .reduce((sum, i) => sum + i.deduction, 0);
    expect(ogDeductions).toBe(12 + 10 + 15 + 8 + 5);
    expect(result.score).toBe(100 - 12 - 10 - 15 - 8 - 5);
    expect(result.score).toBe(50);
  });

  it('awards 100/100 when title, description, canonical, and all OG tags are present and sized correctly', () => {
    const html = `<!DOCTYPE html><html><head>
      <title>${PERFECT_TITLE}</title>
      <meta name="description" content="${PERFECT_DESCRIPTION}">
      <meta property="og:title" content="${PERFECT_TITLE}">
      <meta property="og:description" content="${PERFECT_DESCRIPTION}">
      <meta property="og:image" content="/og-image.png">
      <meta property="og:url" content="/page.html">
      <meta property="og:type" content="article">
      <link rel="canonical" href="/page.html">
    </head><body></body></html>`;

    const result = analyzeSeo(html, '/page.html');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.title).toBe(PERFECT_TITLE);
    expect(result.description).toBe(PERFECT_DESCRIPTION);
    expect(result.canonical).toBe('/page.html');
    expect(result.ogTags['og:title']).toBe(PERFECT_TITLE);
    expect(result.ogTags['og:image']).toBe('/og-image.png');
    expect(result.ogTags['og:type']).toBe('article');
  });
});
