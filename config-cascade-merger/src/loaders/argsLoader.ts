import minimist = require('minimist');
import { TypedConfig } from '../types';
import { SchemaPropertyMeta } from '../schema';
import { coerceValue } from './envLoader';

export interface ArgsLoadResult {
  config: Partial<TypedConfig>;
  rawArgs: ReturnType<typeof minimist>;
}

export function parseOuterArgs(argv: string[]): {
  defaults?: string;
  env?: string;
  args?: string;
  schema?: string;
} {
  const result: ReturnType<typeof parseOuterArgs> = {};
  const args = argv.slice(2);

  const optionAliases: Record<string, keyof typeof result> = {
    '--defaults': 'defaults', '-d': 'defaults',
    '--env': 'env', '-e': 'env',
    '--args': 'args', '-a': 'args',
    '--schema': 'schema', '-s': 'schema',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eqMatch = arg.match(/^(--[^=]+|-[a-zA-Z])=(.*)$/);

    if (eqMatch) {
      const optName = eqMatch[1];
      const optValue = eqMatch[2];
      if (optionAliases[optName]) {
        result[optionAliases[optName]] = optValue;
      }
      continue;
    }

    if (optionAliases[arg]) {
      const key = optionAliases[arg];

      if (key === 'args') {
        const argsParts: string[] = [];
        for (let j = i + 1; j < args.length; j++) {
          const next = args[j];
          if (next in optionAliases || /^(--[^=]+|-[a-zA-Z])=/.test(next)) {
            break;
          }
          argsParts.push(next);
        }
        if (argsParts.length > 0) {
          result.args = argsParts.join(' ');
          i += argsParts.length;
        } else {
          result.args = '';
        }
      } else {
        if (i + 1 < args.length) {
          result[key] = args[i + 1];
          i++;
        }
      }
      continue;
    }
  }

  return result;
}

export function loadArgsConfig(
  argsString: string | undefined,
  schemaMeta: Record<string, SchemaPropertyMeta>,
): ArgsLoadResult {
  if (!argsString || argsString.trim() === '') {
    return { config: {}, rawArgs: { _: [] } };
  }

  const tokens = tokenizeArgs(argsString);
  const rawArgs = minimist(tokens, {
    boolean: [],
    string: [],
    default: {},
  });

  const config = argsToNestedConfig(rawArgs, schemaMeta);
  return { config, rawArgs };
}

function tokenizeArgs(argsString: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
    } else {
      if (char === '"' || char === "'") {
        inQuote = char;
      } else if (char === ' ' || char === '\t') {
        if (current !== '') {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
  }

  if (current !== '') {
    tokens.push(current);
  }

  return tokens;
}

function argsToNestedConfig(
  rawArgs: minimist.ParsedArgs,
  schemaMeta: Record<string, SchemaPropertyMeta>,
): Partial<TypedConfig> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawArgs)) {
    if (key === '_') continue;

    const pathParts = key.split('.');
    const pathStr = pathParts.join('.');
    const meta = schemaMeta[pathStr];

    let coercedValue: unknown;

    if (meta && typeof value === 'string') {
      coercedValue = coerceValue(value, meta);
    } else if (Array.isArray(value)) {
      if (meta && meta.type === 'array') {
        coercedValue = value.map((v) =>
          typeof v === 'string' && meta.items ? coerceValue(v, meta.items) : v,
        );
      } else {
        coercedValue = value.map((v) => (typeof v === 'string' ? autoCoerceSimple(v) : v));
      }
    } else {
      coercedValue = typeof value === 'string' ? autoCoerceSimple(value) : value;
    }

    setNestedValue(result, pathParts, coercedValue);
  }

  return result as Partial<TypedConfig>;
}

function setNestedValue(obj: Record<string, unknown>, pathParts: string[], value: unknown): void {
  let current = obj;

  for (let i = 0; i < pathParts.length - 1; i++) {
    const key = pathParts[i];
    if (
      !(key in current) ||
      typeof current[key] !== 'object' ||
      current[key] === null ||
      Array.isArray(current[key])
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = pathParts[pathParts.length - 1];
  current[lastKey] = value;
}

function autoCoerceSimple(value: string): unknown {
  const trimmed = value.trim();

  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === '1' || lower === 'on') return true;
  if (lower === 'false' || lower === 'no' || lower === '0' || lower === 'off') return false;

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through
    }
  }

  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => autoCoerceSimple(s));
  }

  return value;
}
