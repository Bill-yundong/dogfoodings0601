import { ConfigLayer, LAYER_PRIORITY, LayeredConfig, MergeResult, TypedConfig } from '../types';

export function deepMergeConfigs(layered: LayeredConfig): MergeResult {
  const keySources: Record<string, ConfigLayer> = {};
  const merged: Record<string, unknown> = {};

  for (const layer of LAYER_PRIORITY) {
    const layerConfig = layered[layer];
    if (layerConfig && Object.keys(layerConfig).length > 0) {
      mergeLayer(merged, layerConfig as Record<string, unknown>, layer, '', keySources);
    }
  }

  return {
    merged: merged as unknown as TypedConfig,
    layered,
    keySources,
  };
}

function mergeLayer(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  layer: ConfigLayer,
  pathPrefix: string,
  keySources: Record<string, ConfigLayer>,
): void {
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (sourceValue === undefined) {
      continue;
    }

    if (isPlainObject(sourceValue)) {
      if (!(key in target) || !isPlainObject(target[key])) {
        target[key] = {};
      }
      mergeLayer(
        target[key] as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
        layer,
        currentPath,
        keySources,
      );
    } else {
      target[key] = deepClone(sourceValue);
      keySources[currentPath] = layer;
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return (value.map((item) => deepClone(item)) as unknown) as T;
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      result[key] = deepClone((value as Record<string, unknown>)[key]);
    }
    return result as T;
  }

  return value;
}

export function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export function collectAllPaths(obj: unknown, prefix = ''): string[] {
  const paths: string[] = [];

  if (obj === null || typeof obj !== 'object') {
    if (prefix) paths.push(prefix);
    return paths;
  }

  if (Array.isArray(obj)) {
    if (prefix) paths.push(prefix);
    return paths;
  }

  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record);

  if (keys.length === 0 && prefix) {
    paths.push(prefix);
    return paths;
  }

  for (const key of keys) {
    const value = record[key];
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(value)) {
      const subPaths = collectAllPaths(value, currentPath);
      if (subPaths.length === 0) {
        paths.push(currentPath);
      } else {
        paths.push(...subPaths);
      }
    } else {
      paths.push(currentPath);
    }
  }

  return paths;
}

export function findLayerForPath(
  layered: LayeredConfig,
  path: string,
): { layer: ConfigLayer; value: unknown } | null {
  for (let i = LAYER_PRIORITY.length - 1; i >= 0; i--) {
    const layer = LAYER_PRIORITY[i];
    const layerConfig = layered[layer] as Record<string, unknown>;
    const value = getValueAtPath(layerConfig, path);
    if (value !== undefined) {
      return { layer, value };
    }
  }
  return null;
}
