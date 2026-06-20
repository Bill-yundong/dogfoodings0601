import { loadYamlConfig } from './src/loaders/yamlLoader';
import { loadEnvConfig } from './src/loaders/envLoader';
import { loadArgsConfig, parseOuterArgs } from './src/loaders/argsLoader';
import { deepMergeConfigs } from './src/merger/deepMerger';
import { formatValidationErrors, validateConfig } from './src/validator/schemaValidator';
import { configSchema, extractSchemaTypes } from './src/schema';
import {
  CliOptions,
  ConfigLayer,
  LAYER_NAMES,
  LAYER_PRIORITY,
  LayeredConfig,
  TypedConfig,
} from './src/types';

const DEFAULT_CONFIG: Partial<TypedConfig> = {
  port: 8080,
  host: '0.0.0.0',
  debug: false,
  logLevel: 'info',
  database: {
    host: 'localhost',
    port: 5432,
    name: 'app_db',
    username: 'postgres',
    password: '',
    pool: {
      min: 2,
      max: 10,
    },
  },
  features: {
    auth: true,
    cache: false,
    rateLimit: true,
  },
  allowedOrigins: ['https://localhost:3000'],
  rateLimitWindow: 60,
  rateLimitMax: 100,
};

function main(): void {
  const startTime = Date.now();
  printBanner();

  const cliOptions: CliOptions = parseOuterArgs(process.argv);
  const schemaMeta = extractSchemaTypes(configSchema);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📋 步骤 1: 加载各层配置');
  console.log('═══════════════════════════════════════════════════\n');

  const layered: LayeredConfig = {
    defaults: {},
    yaml: {},
    env: {},
    args: {},
  };

  layered.defaults = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  printLayerConfig('defaults', layered.defaults, '内置默认值');

  try {
    layered.yaml = loadYamlConfig(cliOptions.defaults || '');
    printLayerConfig('yaml', layered.yaml, cliOptions.defaults || '(未指定文件)');
  } catch (error) {
    console.error(`❌ YAML 加载失败: ${(error as Error).message}\n`);
    process.exit(1);
  }

  try {
    const envResult = loadEnvConfig(cliOptions.env, schemaMeta);
    layered.env = envResult.config;
    printLayerConfig('env', layered.env, cliOptions.env || '(使用系统环境变量)');
    if (Object.keys(envResult.rawEnv).length > 0) {
      console.log('   原始环境变量:');
      for (const [k, v] of Object.entries(envResult.rawEnv)) {
        const masked = k.toLowerCase().includes('password') || k.toLowerCase().includes('secret')
          ? '***'
          : v;
        console.log(`     ${k}=${masked}`);
      }
    }
  } catch (error) {
    console.error(`❌ 环境变量加载/类型转换失败: ${(error as Error).message}\n`);
    process.exit(1);
  }

  try {
    const argsResult = loadArgsConfig(cliOptions.args, schemaMeta);
    layered.args = argsResult.config;
    printLayerConfig('args', layered.args, cliOptions.args || '(未指定参数)');
  } catch (error) {
    console.error(`❌ 命令行参数解析失败: ${(error as Error).message}\n`);
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('🔀 步骤 2: 深层级联合并（按优先级: defaults < yaml < env < args）');
  console.log('═══════════════════════════════════════════════════\n');

  const mergeResult = deepMergeConfigs(layered);

  console.log('✅ 合并完成。各键值来源层级如下:\n');
  printKeySources(mergeResult.keySources, mergeResult.merged);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('🔍 步骤 3: 按 JSON Schema 校验最终配置');
  console.log('═══════════════════════════════════════════════════\n');

  const validationResult = validateConfig(mergeResult.merged, mergeResult.layered);
  console.log(formatValidationErrors(validationResult));

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📄 步骤 4: 输出最终合并配置');
  console.log('═══════════════════════════════════════════════════\n');

  printFinalConfig(mergeResult.merged);

  const duration = Date.now() - startTime;
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`🏁 处理完成，耗时 ${duration}ms`);
  console.log(`   配置有效性: ${validationResult.valid ? '✅ 通过' : '❌ 失败 (共 ' + validationResult.errors.length + ' 个错误)'}`);
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(validationResult.valid ? 0 : 2);
}

function printBanner(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           多层配置级联合并与校验 CLI 工具 v1.0.0              ║
║                                                              ║
║  优先级: 默认值 → YAML 文件 → 环境变量 → 命令行参数            ║
║  特性: 深合并 · 类型强转 · Schema 校验 · 错误溯源              ║
╚══════════════════════════════════════════════════════════════╝
`);
}

function printLayerConfig(layer: ConfigLayer, config: Partial<TypedConfig>, source: string): void {
  const keyCount = countKeys(config);
  const layerName = LAYER_NAMES[layer];
  const priority = LAYER_PRIORITY.indexOf(layer);

  console.log(`【层级 ${priority + 1}/4 - ${layerName}】 来源: ${source}`);
  console.log(`   包含键数: ${keyCount}`);

  if (keyCount > 0) {
    const json = JSON.stringify(config, null, 2);
    const indented = json
      .split('\n')
      .map((line, i) => (i === 0 ? '   ' + line : '   ' + line))
      .join('\n');
    console.log(indented);
  }
  console.log();
}

function countKeys(obj: unknown, prefix = ''): number {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? 1 : 0;
  }
  let count = 0;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key];
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      count += countKeys(value, currentPath);
    } else {
      count += 1;
    }
  }
  return count;
}

function printKeySources(keySources: Record<string, ConfigLayer>, merged: TypedConfig): void {
  const sortedPaths = Object.keys(keySources).sort();

  for (const path of sortedPaths) {
    const layer = keySources[path];
    const layerName = LAYER_NAMES[layer];
    const value = getNestedValue(merged, path);
    const displayValue = formatValueForDisplay(value, path);

    const layerColorMap: Record<ConfigLayer, string> = {
      defaults: '🔵',
      yaml: '🟢',
      env: '🟡',
      args: '🔴',
    };

    console.log(`  ${layerColorMap[layer]} [${layerName}] ${path} = ${displayValue}`);
  }

  const counts: Record<ConfigLayer, number> = { defaults: 0, yaml: 0, env: 0, args: 0 };
  for (const layer of Object.values(keySources)) {
    counts[layer]++;
  }
  console.log(`\n  汇总: 🔵 默认值(${counts.defaults}) · 🟢 YAML(${counts.yaml}) · 🟡 环境变量(${counts.env}) · 🔴 CLI参数(${counts.args})`);
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function formatValueForDisplay(value: unknown, path: string): string {
  const isSensitive = /(password|secret|token|key)/i.test(path);
  if (isSensitive && typeof value === 'string' && value.length > 0) {
    return `"***"`;
  }

  if (typeof value === 'string') {
    const truncated = value.length > 60 ? value.slice(0, 57) + '...' : value;
    return JSON.stringify(truncated);
  }

  if (Array.isArray(value)) {
    const arrStr = JSON.stringify(value);
    return arrStr.length > 80 ? `[...${value.length} 项...]` : arrStr;
  }

  return JSON.stringify(value);
}

function printFinalConfig(config: TypedConfig): void {
  const json = JSON.stringify(config, replacerForDisplay, 2);
  console.log(json);
}

function replacerForDisplay(key: string, value: unknown): unknown {
  if (/(password|secret|token|private_key)/i.test(key) && typeof value === 'string') {
    return value.length > 0 ? '*** (已脱敏)' : value;
  }
  return value;
}

main();
