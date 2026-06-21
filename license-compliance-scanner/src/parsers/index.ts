import * as fs from 'fs';
import * as path from 'path';
import { parsePackageJson } from './npm-parser';
import { parseRequirementsTxt } from './pip-parser';
import { parseGoMod } from './go-parser';
import { ParserResult, DependencyNode, DependencyInfo } from '../types';

export interface MultiParserResult {
  parsers: ParserResult[];
  allDependencies: DependencyInfo[];
  rootDependencies: DependencyNode[];
}

export function parseProject(projectPath: string, includeDev: boolean = true): MultiParserResult {
  const parsers: ParserResult[] = [];

  if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    parsers.push(parsePackageJson(projectPath, includeDev));
  }

  if (fs.existsSync(path.join(projectPath, 'requirements.txt')) ||
      fs.existsSync(path.join(projectPath, 'setup.py')) ||
      fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
    parsers.push(parseRequirementsTxt(projectPath));
  }

  if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
    parsers.push(parseGoMod(projectPath));
  }

  const allDependencies: DependencyInfo[] = [];
  const rootDependencies: DependencyNode[] = [];
  const seen = new Set<string>();

  for (const parser of parsers) {
    for (const dep of parser.allDependencies) {
      const key = `${dep.packageManager}:${dep.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        allDependencies.push(dep);
      }
    }

    for (const root of parser.rootDependencies) {
      rootDependencies.push(root);
    }
  }

  return {
    parsers,
    allDependencies,
    rootDependencies,
  };
}

export { parsePackageJson, parseRequirementsTxt, parseGoMod };
