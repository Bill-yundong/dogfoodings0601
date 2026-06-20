import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { TypedConfig } from '../types';
import { SchemaPropertyMeta } from '../schema';

const ENV_PREFIX = 'APP_';
const NESTED_SEPARATOR = '__';

export interface EnvLoadResult {
  config: Partial<TypedConfig>;
  rawEnv: Record<string, string>;
}

export function loadEnvConfig(
  envFilePath: string | undefined,
  schemaMeta: Record<string, SchemaPropertyMeta>,
): EnvLoadResult {
  const rawEnv: Record<string, string> = {};

  if (envFilePath) {
    const absolutePath = path.resolve(process.cwd(), envFilePath);
    if (fs.existsSync(absolutePath)) {
      const result = dotenv.config({ path: absolutePath });
      if (result.error) {
        console.warn(`[环境变量加载器] 警告：加载 .env 文件失败 - ${result.error.message}`);
      }
    } else {
      console.warn(`[环境变量加载器] 警告：.env 文件不存在 - ${absolutePath}，将使用系统环境变量`);
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(ENV_PREFIX) && value !== undefined) {
      rawEnv[key] = value;
    }
  }

  const config = envToNestedConfig(rawEnv, schemaMeta);
  return { config, rawEnv };
}

function envToNestedConfig(
  rawEnv: Record<string, string>,
  schemaMeta: Record<string, SchemaPropertyMeta>,
): Partial<TypedConfig> {
  const result: Record<string, unknown> = {};

  for (const [envKey, rawValue] of Object.entries(rawEnv)) {
    const configPath = envKeyToConfigPath(envKey);
    if (!configPath) continue;

    const value = coerceTypeByPath(configPath, rawValue, schemaMeta);
    setNestedValue(result, configPath, value);
  }

  return result as Partial<TypedConfig>;
}

function envKeyToConfigPath(envKey: string): string[] | null {
  if (!envKey.startsWith(ENV_PREFIX)) return null;

  const stripped = envKey.slice(ENV_PREFIX.length);
  const parts = stripped.split(NESTED_SEPARATOR);

  return parts.map((p) => p.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase()));
}

function setNestedValue(obj: Record<string, unknown>, pathParts: string[], value: unknown): void {
  let current = obj;

  for (let i = 0; i < pathParts.length - 1; i++) {
    const key = pathParts[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = pathParts[pathParts.length - 1];
  current[lastKey] = value;
}

function coerceTypeByPath(
  pathParts: string[],
  rawValue: string,
  schemaMeta: Record<string, SchemaPropertyMeta>,
): unknown {
  const pathStr = pathParts.join('.');
  const meta = findMetaForPath(schemaMeta, pathStr);

  if (!meta) {
    return tryAutoCoerce(rawValue);
  }

  return coerceValue(rawValue, meta);
}

function findMetaForPath(
  schemaMeta: Record<string, SchemaPropertyMeta>,
  pathStr: string,
): SchemaPropertyMeta | undefined {
  return schemaMeta[pathStr];
}

export function coerceValue(rawValue: string, meta: SchemaPropertyMeta): unknown {
  switch (meta.type) {
    case 'number':
      return toNumber(rawValue, meta);
    case 'boolean':
      return toBoolean(rawValue);
    case 'array':
      return toArray(rawValue, meta);
    case 'string':
    default:
      return rawValue;
  }
}

function tryAutoCoerce(rawValue: string): unknown {
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return rawValue;
  }

  const trimmed = rawValue.trim();

  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'true' || lower === 'false') {
    return lower === 'true';
  }

  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || trimmed.includes(',')) {
    return toArrayAuto(trimmed);
  }

  return rawValue;
}

function toNumber(rawValue: string, meta: SchemaPropertyMeta): number {
  const trimmed = rawValue.trim();
  const num = /^-?\d+$/.test(trimmed) ? parseInt(trimmed, 10) : parseFloat(trimmed);

  if (isNaN(num)) {
    throw new Error(`无法将值 "${rawValue}" 转换为数字类型 (期望: number)`);
  }

  if (meta.minimum !== undefined && num < meta.minimum) {
    throw new Error(`数字 ${num} 小于最小值 ${meta.minimum}`);
  }
  if (meta.maximum !== undefined && num > meta.maximum) {
    throw new Error(`数字 ${num} 大于最大值 ${meta.maximum}`);
  }

  return num;
}

function toBoolean(rawValue: string): boolean {
  const lower = rawValue.trim().toLowerCase();
  const truthy = ['true', '1', 'yes', 'on', 'y', '是', '启用'];
  const falsy = ['false', '0', 'no', 'off', 'n', '否', '禁用'];

  if (truthy.includes(lower)) return true;
  if (falsy.includes(lower)) return false;

  throw new Error(`无法将值 "${rawValue}" 转换为布尔类型 (期望: true/false, 1/0, yes/no 等)`);
}

function toArray(rawValue: string, meta: SchemaPropertyMeta): unknown[] {
  let items: string[];
  const trimmed = rawValue.trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        items = parsed.map((v) => String(v));
      } else {
        items = [trimmed];
      }
    } catch {
      items = trimmed
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter((s) => s.length > 0);
    }
  } else {
    items = trimmed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  if (meta.items) {
    return items.map((item) => coerceValue(item, meta.items!));
  }

  return items.map((item) => tryAutoCoerce(item));
}

function toArrayAuto(rawValue: string): unknown[] {
  const trimmed = rawValue.trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // fall through
    }
  }

  return trimmed
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s.length > 0)
    .map((s) => tryAutoCoerce(s));
}
