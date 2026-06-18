export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export interface FlatEntry {
  key: string;
  value: JsonValue;
}

export interface LocaleFile {
  lang: string;
  filePath: string;
  tree: JsonObject;
  flat: FlatEntry[];
}

export interface MissingKey {
  key: string;
  lang: string;
  baseValue: JsonValue;
}

export interface RedundantKey {
  key: string;
  lang: string;
  value: JsonValue;
}

export interface PlaceholderMismatch {
  key: string;
  baseLang: string;
  basePlaceholders: string[];
  lang: string;
  langPlaceholders: string[];
}

export interface LanguageReport {
  lang: string;
  totalKeys: number;
  missing: MissingKey[];
  redundant: RedundantKey[];
  placeholderMismatches: PlaceholderMismatch[];
}

export interface SyncReport {
  baseLang: string;
  baseKeyCount: number;
  languages: LanguageReport[];
  allKeys: string[];
}

export interface FixResult {
  fixed: number;
  files: string[];
}
