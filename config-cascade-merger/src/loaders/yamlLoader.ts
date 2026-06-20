import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TypedConfig } from '../types';

export function loadYamlConfig(filePath: string): Partial<TypedConfig> {
  if (!filePath) {
    return {};
  }

  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    console.warn(`[YAML 加载器] 警告：文件不存在 - ${absolutePath}，跳过该层配置`);
    return {};
  }

  try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const parsed = yaml.load(content) as Partial<TypedConfig>;

    if (parsed === null || parsed === undefined) {
      console.warn(`[YAML 加载器] 警告：文件内容为空 - ${absolutePath}`);
      return {};
    }

    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`YAML 根节点必须是对象类型，实际得到: ${Array.isArray(parsed) ? '数组' : typeof parsed}`);
    }

    return parsed;
  } catch (error) {
    const err = error as Error;
    throw new Error(`[YAML 加载器] 解析失败 (${absolutePath}): ${err.message}`);
  }
}
