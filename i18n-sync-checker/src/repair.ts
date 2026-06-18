import * as fs from 'fs';
import { FixResult, JsonValue, LocaleFile, SyncReport } from './types';
import { setByPath } from './scanner';

const TODO_PREFIX = '[TODO:i18n] ';

export function repair(locales: LocaleFile[], report: SyncReport): FixResult {
  const byLang = new Map<string, LocaleFile>(locales.map((l) => [l.lang, l]));
  let fixed = 0;
  const touched = new Set<string>();

  for (const langReport of report.languages) {
    const file = byLang.get(langReport.lang);
    if (!file) continue;
    for (const miss of langReport.missing) {
      const filled: JsonValue =
        typeof miss.baseValue === 'string' ? `${TODO_PREFIX}${miss.baseValue}` : miss.baseValue;
      setByPath(file.tree, miss.key, filled);
      fixed++;
      touched.add(langReport.lang);
    }
  }

  const files: string[] = [];
  for (const lang of touched) {
    const file = byLang.get(lang)!;
    const content = JSON.stringify(file.tree, null, 2) + '\n';
    fs.writeFileSync(file.filePath, content, 'utf8');
    files.push(file.filePath);
  }

  return { fixed, files };
}
