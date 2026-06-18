import { FixResult, SyncReport } from './types';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function paint(code: string, text: string): string {
  return `${code}${text}${C.reset}`;
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function strWidth(s: string): number {
  let w = 0;
  for (const ch of stripAnsi(s)) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0x303e) ||
      (code >= 0x3040 && code <= 0x33bf) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

function truncate(s: string, max: number): string {
  const raw = typeof s === 'string' ? s : String(s);
  if (strWidth(raw) <= max) return raw;
  let out = '';
  let w = 0;
  for (const ch of raw) {
    const cw = strWidth(ch);
    if (w + cw > max - 1) break;
    out += ch;
    w += cw;
  }
  return `${out}…`;
}

const TL = '┌', TM = '┬', TR = '┐';
const ML = '├', MM = '┼', MR = '┤';
const BL = '└', BM = '┴', BR = '┘';
const H = '─', V = '│';

function renderTable(headers: string[], rows: string[][]): string {
  const all = [headers, ...rows];
  const cols = headers.length;
  const widths: number[] = [];
  for (let c = 0; c < cols; c++) {
    let w = 0;
    for (const r of all) w = Math.max(w, strWidth(r[c] ?? ''));
    widths.push(w);
  }

  const border = (l: string, m: string, r: string) =>
    l + widths.map((w) => H.repeat(w + 2)).join(m) + r;
  const row = (cells: string[]) =>
    V +
    cells
      .map((cell, i) => ` ${cell}${' '.repeat(widths[i] - strWidth(cell))} `)
      .join(V) +
    V;

  const lines: string[] = [];
  lines.push(border(TL, TM, TR));
  lines.push(paint(C.bold + C.cyan, row(headers)));
  lines.push(border(ML, MM, MR));
  for (const r of rows) lines.push(row(r));
  lines.push(border(BL, BM, BR));
  return lines.join('\n');
}

function count(issue: { length: number }): string {
  return issue.length === 0 ? paint(C.green, '0') : paint(C.yellow, String(issue.length));
}

export function printBanner(baseLang: string, baseKeyCount: number): void {
  const title = paint(C.bold + C.magenta, '  i18n Sync Checker  ');
  console.log(`\n${title}`);
  console.log(
    paint(C.gray, `  base language: `) +
      paint(C.bold, baseLang) +
      paint(C.gray, `  |  reference keys: `) +
      paint(C.bold, String(baseKeyCount)) +
      '\n',
  );
}

export function printReport(report: SyncReport): void {
  printBanner(report.baseLang, report.baseKeyCount);

  const summaryRows = report.languages.map((l) => {
    const ok =
      l.missing.length === 0 &&
      l.redundant.length === 0 &&
      l.placeholderMismatches.length === 0;
    return [
      l.lang,
      String(l.totalKeys),
      count(l.missing),
      count(l.redundant),
      count(l.placeholderMismatches),
      ok ? paint(C.green, 'PASS') : paint(C.red, 'FAIL'),
    ];
  });

  console.log(paint(C.bold, 'Summary'));
  console.log(
    renderTable(
      ['Language', 'Total', 'Missing', 'Redundant', 'Placeholder', 'Status'],
      summaryRows,
    ),
  );

  const missingRows: string[][] = [];
  const redundantRows: string[][] = [];
  const placeholderRows: string[][] = [];
  for (const l of report.languages) {
    for (const m of l.missing) {
      missingRows.push([l.lang, m.key, truncate(JSON.stringify(m.baseValue), 50)]);
    }
    for (const r of l.redundant) {
      redundantRows.push([l.lang, r.key, truncate(JSON.stringify(r.value), 50)]);
    }
    for (const p of l.placeholderMismatches) {
      placeholderRows.push([
        l.lang,
        p.key,
        p.basePlaceholders.join(', ') || paint(C.gray, '(none)'),
        p.langPlaceholders.join(', ') || paint(C.gray, '(none)'),
      ]);
    }
  }

  if (missingRows.length) {
    console.log(`\n${paint(C.bold + C.red, 'Missing Keys')}`);
    console.log(renderTable(['Language', 'Key', 'Base Value'], missingRows));
  }
  if (redundantRows.length) {
    console.log(`\n${paint(C.bold + C.yellow, 'Redundant Keys')}`);
    console.log(renderTable(['Language', 'Key', 'Value'], redundantRows));
  }
  if (placeholderRows.length) {
    console.log(`\n${paint(C.bold + C.blue, 'Placeholder Mismatch')}`);
    console.log(
      renderTable(
        ['Language', 'Key', 'Base Placeholders', 'Lang Placeholders'],
        placeholderRows,
      ),
    );
  }

  const total =
    missingRows.length + redundantRows.length + placeholderRows.length;
  if (total === 0) {
    console.log(`\n${paint(C.bold + C.green, '✓ All locale files are in sync.')}\n`);
  } else {
    console.log(
      `\n${paint(C.bold, 'Total issues:')} ` +
        paint(C.red, String(total)) +
        '\n',
    );
  }
}

export function printFixSummary(result: FixResult): void {
  console.log(
    paint(C.bold + C.green, `\n✓ Auto-fixed ${result.fixed} missing key(s)`) +
      paint(C.gray, ` across ${result.files.length} file(s)`),
  );
  for (const f of result.files) {
    console.log(paint(C.gray, `  · updated ${f}`));
  }
  console.log('');
}
