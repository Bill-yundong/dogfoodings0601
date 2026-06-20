import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { configSchema } from '../schema';
import { ConfigLayer, LAYER_NAMES, LayeredConfig, TypedConfig, ValidationError, ValidationResult } from '../types';
import { findLayerForPath, getValueAtPath } from '../merger/deepMerger';

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  coerceTypes: false,
  useDefaults: false,
  strict: false,
});

addFormats(ajv);

const validateFn = ajv.compile<TypedConfig>(configSchema);

export function validateConfig(merged: TypedConfig, layered: LayeredConfig): ValidationResult {
  const valid = validateFn(merged);
  const errors: ValidationError[] = [];

  if (!valid && validateFn.errors) {
    for (const ajvError of validateFn.errors) {
      const validationError = convertAjvError(ajvError, merged, layered);
      errors.push(validationError);
    }
  }

  return { valid: !!valid, errors };
}

function convertAjvError(
  error: ErrorObject,
  merged: TypedConfig,
  layered: LayeredConfig,
): ValidationError {
  const rawPath = error.instancePath || '';
  const path = normalizeAjvPath(rawPath);

  const layerInfo = determineErrorLayer(path, error, merged, layered);
  const invalidValue = getValueAtPath(merged, path);

  return {
    path,
    message: formatErrorMessage(error, path),
    layer: layerInfo.layer,
    invalidValue: layerInfo.value ?? invalidValue,
  };
}

function normalizeAjvPath(instancePath: string): string {
  if (!instancePath) return '';

  let normalized = instancePath.startsWith('/') ? instancePath.slice(1) : instancePath;

  normalized = normalized.replace(/\/(\d+)/g, '[$1]');
  normalized = normalized.replace(/\//g, '.');

  return normalized;
}

function determineErrorLayer(
  path: string,
  error: ErrorObject,
  merged: TypedConfig,
  layered: LayeredConfig,
): { layer: ConfigLayer; value: unknown } {
  const parentPath = getParentPath(path);
  const propertyName = getLastSegment(path);

  if (error.keyword === 'additionalProperties') {
    const extraProp = (error.params as { additionalProperty?: string }).additionalProperty;
    if (extraProp) {
      const searchPath = parentPath ? `${parentPath}.${extraProp}` : extraProp;
      const found = findLayerForPath(layered, searchPath);
      if (found) return found;
    }
  }

  if (error.keyword === 'required') {
    const missingProp = (error.params as { missingProperty?: string }).missingProperty;
    if (missingProp) {
      return { layer: 'defaults', value: undefined };
    }
  }

  if (path) {
    const found = findLayerForPath(layered, path);
    if (found) return found;
  }

  if (parentPath) {
    const parentFound = findLayerForPath(layered, parentPath);
    if (parentFound) {
      const parentValue = parentFound.value as Record<string, unknown> | undefined;
      const value = parentValue && propertyName ? parentValue[propertyName] : undefined;
      return { layer: parentFound.layer, value };
    }
  }

  return { layer: 'defaults', value: getValueAtPath(merged, path) };
}

function getParentPath(path: string): string {
  if (!path) return '';
  const parts = path.split('.');
  parts.pop();
  return parts.join('.');
}

function getLastSegment(path: string): string {
  if (!path) return '';
  const parts = path.split('.');
  return parts[parts.length - 1] || '';
}

function formatErrorMessage(error: ErrorObject, path: string): string {
  const keyword = error.keyword;
  const params = error.params as Record<string, unknown>;
  const displayPath = path || '<root>';

  switch (keyword) {
    case 'type':
      return `类型错误："${displayPath}" 期望类型为 ${params.type}，实际值类型为 ${getTypeDescription(error.data)}`;

    case 'enum':
      const allowed = JSON.stringify(params.allowedValues);
      return `枚举值错误："${displayPath}" 的值 ${JSON.stringify(error.data)} 不在允许列表 ${allowed} 中`;

    case 'minimum':
      return `最小值错误："${displayPath}" = ${error.data} 小于允许的最小值 ${params.limit}`;

    case 'maximum':
      return `最大值错误："${displayPath}" = ${error.data} 大于允许的最大值 ${params.limit}`;

    case 'minLength':
      return `最小长度错误："${displayPath}" 长度 ${(error.data as string)?.length || 0} 小于最小要求 ${params.limit}`;

    case 'maxLength':
      return `最大长度错误："${displayPath}" 长度 ${(error.data as string)?.length || 0} 大于最大限制 ${params.limit}`;

    case 'pattern':
      return `格式错误："${displayPath}" 不匹配正则表达式 ${params.pattern}`;

    case 'format':
      return `格式错误："${displayPath}" 不是有效的 ${params.format} 格式`;

    case 'required':
      return `缺少必填字段："${displayPath ? displayPath + '.' : ''}${params.missingProperty}"`;

    case 'additionalProperties':
      return `非法额外属性："${displayPath}" 中包含未定义的属性 "${params.additionalProperty}"`;

    case 'minItems':
      return `数组最小项数错误："${displayPath}" 仅有 ${(error.data as unknown[] | undefined)?.length || 0} 项，最少需要 ${params.limit} 项`;

    case 'maxItems':
      return `数组最大项数错误："${displayPath}" 有 ${(error.data as unknown[] | undefined)?.length || 0} 项，最多允许 ${params.limit} 项`;

    case 'uniqueItems':
      return `数组唯一性错误："${displayPath}" 中存在重复项`;

    case 'minProperties':
      return `对象最小属性数错误`;

    case 'maxProperties':
      return `对象最大属性数错误`;

    default:
      return `校验错误：${error.message || '未知错误'} (keyword: ${keyword})`;
  }
}

function getTypeDescription(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) {
    return '✅ 配置校验通过，所有字段均符合 Schema 定义。';
  }

  const lines: string[] = [];
  lines.push(`❌ 配置校验失败，共发现 ${result.errors.length} 个错误：\n`);

  for (let i = 0; i < result.errors.length; i++) {
    const err = result.errors[i];
    const layerName = LAYER_NAMES[err.layer];
    const valueStr =
      err.invalidValue === undefined ? '<缺失>' : JSON.stringify(err.invalidValue);

    lines.push(`${i + 1}. [${layerName}] ${err.message}`);
    lines.push(`   路径: ${err.path || '<根对象>'}`);
    lines.push(`   非法值: ${valueStr}`);
    lines.push('');
  }

  return lines.join('\n');
}
