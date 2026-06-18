import * as fs from 'fs';
import * as path from 'path';
import { JsonObject, JsonValue, FlatEntry, LocaleFile } from './types';

export function flattenTree(tree: JsonObject, prefix = ''): FlatEntry[] {
  const entries: FlatEntry[] = [];
  for (const key of Object.keys(tree)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = tree[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flattenTree(value as JsonObject, fullKey));
    } else {
      entries.push({ key: fullKey, value });
    }
  }
  return entries;
}

export function deriveLang(fileName: string): string {
  return path.basename(fileName).replace(/\.json$/i, '');
}

export function scanDirectory(dir: string): LocaleFile[] {
  const abs = path.resolve(dir);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    throw new Error(`i18n directory not found: ${abs}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${abs}`);
  }
  const files = fs
    .readdirSync(abs)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort();
  if (files.length === 0) {
    throw new Error(`No JSON locale files found in: ${abs}`);
  }
  return files.map((f) => {
    const filePath = path.join(abs, f);
    const raw = fs.readFileSync(filePath, 'utf8');
    let tree: JsonObject;
    try {
      tree = JSON.parse(raw) as JsonObject;
    } catch (e) {
      throw new Error(`Failed to parse JSON in ${filePath}: ${(e as Error).message}`);
    }
    if (tree === null || typeof tree !== 'object' || Array.isArray(tree)) {
      throw new Error(`Locale root must be an object in ${filePath}`);
    }
    return { lang: deriveLang(f), filePath, tree, flat: flattenTree(tree) };
  });
}

export function setByPath(tree: JsonObject, key: string, value: JsonValue): void {
  const parts = key.split('.');
  let node: JsonObject = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = node[part];
    if (next === null || typeof next !== 'object' || Array.isArray(next)) {
      const created: JsonObject = {};
      node[part] = created;
      node = created;
    } else {
      node = next as JsonObject;
    }
  }
  node[parts[parts.length - 1]] = value;
}
