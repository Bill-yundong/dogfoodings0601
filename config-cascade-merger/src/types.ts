export type ConfigLayer = 'defaults' | 'yaml' | 'env' | 'args';

export const LAYER_PRIORITY: ConfigLayer[] = ['defaults', 'yaml', 'env', 'args'];

export const LAYER_NAMES: Record<ConfigLayer, string> = {
  defaults: '默认值层',
  yaml: 'YAML 文件层',
  env: '环境变量层',
  args: '命令行参数层',
};

export interface TypedConfig {
  port: number;
  host: string;
  debug: boolean;
  logLevel: string;
  database: {
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
    pool: {
      min: number;
      max: number;
    };
  };
  features: {
    auth: boolean;
    cache: boolean;
    rateLimit: boolean;
  };
  allowedOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
}

export interface LayeredConfig {
  defaults: Partial<TypedConfig>;
  yaml: Partial<TypedConfig>;
  env: Partial<TypedConfig>;
  args: Partial<TypedConfig>;
}

export interface ValidationError {
  path: string;
  message: string;
  layer: ConfigLayer;
  invalidValue: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface MergeResult {
  merged: TypedConfig;
  layered: LayeredConfig;
  keySources: Record<string, ConfigLayer>;
}

export interface CliOptions {
  defaults?: string;
  env?: string;
  args?: string;
  schema?: string;
}
