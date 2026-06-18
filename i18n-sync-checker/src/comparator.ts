import {
  FlatEntry,
  JsonValue,
  LanguageReport,
  LocaleFile,
  MissingKey,
  PlaceholderMismatch,
  RedundantKey,
  SyncReport,
} from './types';

const PLACEHOLDER_REGEX =
  /\{\{\s*([\w.-]+)\s*\}\}|\{\s*([\w.-]+)\s*\}|\$\{\s*([\w.-]+)\s*\}|%[sdifjo%]/g;

export function extractPlaceholders(value: JsonValue): string[] {
  if (typeof value !== 'string') return [];
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((m = PLACEHOLDER_REGEX.exec(value)) !== null) {
    if (m[1]) set.add(`{{${m[1]}}}`);
    else if (m[2]) set.add(`{${m[2]}}`);
    else if (m[3]) set.add(`\${${m[3]}}`);
    else set.add(m[0]);
  }
  return Array.from(set).sort();
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export function compare(base: LocaleFile, others: LocaleFile[]): SyncReport {
  const baseMap = new Map<string, FlatEntry>(base.flat.map((e) => [e.key, e]));
  const allKeys = Array.from(baseMap.keys()).sort();

  const languages: LanguageReport[] = others.map((file) => {
    const map = new Map<string, FlatEntry>(file.flat.map((e) => [e.key, e]));
    const missing: MissingKey[] = [];
    const redundant: RedundantKey[] = [];
    const placeholderMismatches: PlaceholderMismatch[] = [];

    for (const key of allKeys) {
      const baseEntry = baseMap.get(key)!;
      const langEntry = map.get(key);
      if (!langEntry) {
        missing.push({ key, lang: file.lang, baseValue: baseEntry.value });
      } else {
        const basePh = extractPlaceholders(baseEntry.value);
        const langPh = extractPlaceholders(langEntry.value);
        if (!arraysEqual(basePh, langPh)) {
          placeholderMismatches.push({
            key,
            baseLang: base.lang,
            basePlaceholders: basePh,
            lang: file.lang,
            langPlaceholders: langPh,
          });
        }
      }
    }

    for (const entry of file.flat) {
      if (!baseMap.has(entry.key)) {
        redundant.push({ key: entry.key, lang: file.lang, value: entry.value });
      }
    }

    return {
      lang: file.lang,
      totalKeys: file.flat.length,
      missing,
      redundant,
      placeholderMismatches,
    };
  });

  return {
    baseLang: base.lang,
    baseKeyCount: allKeys.length,
    languages,
    allKeys,
  };
}

export function totalIssues(report: SyncReport): number {
  return report.languages.reduce(
    (sum, l) => sum + l.missing.length + l.redundant.length + l.placeholderMismatches.length,
    0,
  );
}
