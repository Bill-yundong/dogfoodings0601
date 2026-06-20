import { JSONSchemaType } from 'ajv';
import { TypedConfig } from './types';

export const configSchema: JSONSchemaType<TypedConfig> = {
  type: 'object',
  $id: 'ConfigSchema',
  title: '应用配置 Schema',
  description: '多层级联合并后的应用配置结构定义',
  required: [
    'port',
    'host',
    'debug',
    'logLevel',
    'database',
    'features',
    'allowedOrigins',
    'rateLimitWindow',
    'rateLimitMax',
  ],
  properties: {
    port: {
      type: 'number',
      title: '服务端口',
      description: 'HTTP 服务监听的端口号',
      minimum: 1,
      maximum: 65535,
    },
    host: {
      type: 'string',
      title: '服务主机',
      description: 'HTTP 服务绑定的主机地址',
      minLength: 1,
    },
    debug: {
      type: 'boolean',
      title: '调试模式',
      description: '是否启用调试模式',
    },
    logLevel: {
      type: 'string',
      title: '日志级别',
      description: '日志输出级别',
      enum: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
    },
    database: {
      type: 'object',
      title: '数据库配置',
      description: '数据库连接相关配置',
      required: ['host', 'port', 'name', 'username', 'password', 'pool'],
      properties: {
        host: {
          type: 'string',
          title: '数据库主机',
          minLength: 1,
        },
        port: {
          type: 'number',
          title: '数据库端口',
          minimum: 1,
          maximum: 65535,
        },
        name: {
          type: 'string',
          title: '数据库名称',
          minLength: 1,
        },
        username: {
          type: 'string',
          title: '数据库用户名',
        },
        password: {
          type: 'string',
          title: '数据库密码',
        },
        pool: {
          type: 'object',
          title: '连接池配置',
          required: ['min', 'max'],
          properties: {
            min: {
              type: 'number',
              title: '最小连接数',
              minimum: 0,
            },
            max: {
              type: 'number',
              title: '最大连接数',
              minimum: 1,
            },
          },
        },
      },
    },
    features: {
      type: 'object',
      title: '功能开关',
      description: '各项功能特性的启用开关',
      required: ['auth', 'cache', 'rateLimit'],
      properties: {
        auth: {
          type: 'boolean',
          title: '认证功能',
        },
        cache: {
          type: 'boolean',
          title: '缓存功能',
        },
        rateLimit: {
          type: 'boolean',
          title: '限流功能',
        },
      },
    },
    allowedOrigins: {
      type: 'array',
      title: '允许的跨域来源',
      description: 'CORS 允许的来源列表',
      items: {
        type: 'string',
        format: 'uri',
      },
    },
    rateLimitWindow: {
      type: 'number',
      title: '限流时间窗口（秒）',
      minimum: 1,
    },
    rateLimitMax: {
      type: 'number',
      title: '窗口内最大请求数',
      minimum: 1,
    },
  },
  additionalProperties: false,
};

export interface SchemaPropertyMeta {
  path: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  items?: SchemaPropertyMeta;
  properties?: Record<string, SchemaPropertyMeta>;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
}

export function extractSchemaTypes(schema: JSONSchemaType<TypedConfig>): Record<string, SchemaPropertyMeta> {
  const result: Record<string, SchemaPropertyMeta> = {};

  function walk(node: unknown, path: string) {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;

    const meta: SchemaPropertyMeta = {
      path,
      type: (obj.type as SchemaPropertyMeta['type']) || 'object',
    };

    if (obj.enum) meta.enum = obj.enum as unknown[];
    if (obj.format) meta.format = obj.format as string;
    if (typeof obj.minimum === 'number') meta.minimum = obj.minimum;
    if (typeof obj.maximum === 'number') meta.maximum = obj.maximum;
    if (typeof obj.minLength === 'number') meta.minLength = obj.minLength;

    if (obj.items && typeof obj.items === 'object') {
      const itemsObj = obj.items as Record<string, unknown>;
      meta.items = {
        path: `${path}[]`,
        type: (itemsObj.type as SchemaPropertyMeta['type']) || 'string',
        format: itemsObj.format as string | undefined,
      };
    }

    if (obj.properties && typeof obj.properties === 'object') {
      const props = obj.properties as Record<string, Record<string, unknown>>;
      meta.properties = {};
      for (const key of Object.keys(props)) {
        const subPath = path ? `${path}.${key}` : key;
        meta.properties[key] = {
          path: subPath,
          type: (props[key].type as SchemaPropertyMeta['type']) || 'object',
        };
        walk(props[key], subPath);
      }
    }

    result[path] = meta;
  }

  walk(schema, '');
  return result;
}
