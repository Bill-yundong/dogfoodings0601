import * as fs from 'fs';
import * as path from 'path';
import { DependencyNode, DependencyInfo, ParserResult } from '../types';
import { normalizeLicense } from '../license-matrix';
import { getLicenseForPackage } from '../license-db';

interface RequirementLine {
  name: string;
  version: string;
  operator: string;
  extras: string[];
}

export function parseRequirementsTxt(projectPath: string): ParserResult {
  const requirementsPath = path.join(projectPath, 'requirements.txt');
  const setupPyPath = path.join(projectPath, 'setup.py');
  const pyprojectTomlPath = path.join(projectPath, 'pyproject.toml');

  let requirements: RequirementLine[] = [];

  if (fs.existsSync(requirementsPath)) {
    requirements = parseRequirementsFile(requirementsPath);
  }

  if (requirements.length === 0 && fs.existsSync(setupPyPath)) {
    requirements = parseSetupPy(setupPyPath);
  }

  if (requirements.length === 0 && fs.existsSync(pyprojectTomlPath)) {
    requirements = parsePyprojectToml(pyprojectTomlPath);
  }

  const rootDependencies: DependencyNode[] = [];
  const allDependencies: DependencyInfo[] = [];
  const seen = new Set<string>();

  for (const req of requirements) {
    if (seen.has(req.name)) continue;
    seen.add(req.name);

    const license = getLicenseForPackage(req.name, 'pip');
    const spdxLicense = normalizeLicense(license);

    const depInfo: DependencyInfo = {
      name: req.name,
      version: req.version || 'latest',
      license,
      spdxLicense,
      packageManager: 'pip',
      path: `pip://${req.name}`,
    };
    allDependencies.push(depInfo);

    const children = resolveTransitiveDependencies(req.name, seen, allDependencies, 1);

    rootDependencies.push({
      name: req.name,
      version: req.version || 'latest',
      license,
      spdxLicense,
      packageManager: 'pip',
      children,
      depth: 0,
    });
  }

  return {
    packageManager: 'pip',
    rootDependencies,
    allDependencies,
  };
}

function parseRequirementsFile(filePath: string): RequirementLine[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const result: RequirementLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
      continue;
    }

    const parsed = parseRequirementLine(trimmed);
    if (parsed) {
      result.push(parsed);
    }
  }

  return result;
}

function parseRequirementLine(line: string): RequirementLine | null {
  let name = line;
  let version = '';
  let operator = '';
  const extras: string[] = [];

  const extrasMatch = line.match(/\[([^\]]+)\]/);
  if (extrasMatch) {
    extras.push(...extrasMatch[1].split(',').map(e => e.trim()));
    name = line.replace(extrasMatch[0], '');
  }

  const versionMatch = name.match(/([>=<~!]+)(.+)/);
  if (versionMatch) {
    operator = versionMatch[1];
    version = versionMatch[2];
    name = name.substring(0, versionMatch.index);
  }

  name = name.trim();

  if (!name || name.startsWith('#')) {
    return null;
  }

  return {
    name: name.toLowerCase().replace(/_/g, '-'),
    version,
    operator,
    extras,
  };
}

function parseSetupPy(filePath: string): RequirementLine[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const installRequiresMatch = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);

    if (!installRequiresMatch) return [];

    const depsContent = installRequiresMatch[1];
    const depMatches = depsContent.match(/['"]([^'"]+)['"]/g) || [];

    const result: RequirementLine[] = [];
    for (const match of depMatches) {
      const dep = match.replace(/['"]/g, '');
      const parsed = parseRequirementLine(dep);
      if (parsed) {
        result.push(parsed);
      }
    }

    return result;
  } catch {
    return [];
  }
}

function parsePyprojectToml(filePath: string): RequirementLine[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result: RequirementLine[] = [];

    let inDependencies = false;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('dependencies') && trimmed.includes('=')) {
        inDependencies = true;
        const match = trimmed.match(/dependencies\s*=\s*\[([^\]]*)\]/);
        if (match) {
          const deps = match[1].split(',').map(d => d.trim().replace(/['"]/g, ''));
          for (const dep of deps) {
            if (dep) {
              const parsed = parseRequirementLine(dep);
              if (parsed) result.push(parsed);
            }
          }
          inDependencies = false;
        }
        continue;
      }

      if (inDependencies) {
        if (trimmed.startsWith(']')) {
          inDependencies = false;
          continue;
        }
        const depMatch = trimmed.match(/['"]([^'"]+)['"]/);
        if (depMatch) {
          const parsed = parseRequirementLine(depMatch[1]);
          if (parsed) result.push(parsed);
        }
      }
    }

    return result;
  } catch {
    return [];
  }
}

function resolveTransitiveDependencies(
  packageName: string,
  seen: Set<string>,
  allDependencies: DependencyInfo[],
  depth: number
): DependencyNode[] {
  const result: DependencyNode[] = [];

  if (depth > 2) return result;

  const commonTransitives: Record<string, string[]> = {
    'django': ['asgiref', 'sqlparse'],
    'flask': ['werkzeug', 'jinja2', 'itsdangerous', 'click', 'markupsafe', 'blinker'],
    'fastapi': ['starlette', 'pydantic', 'typing-extensions'],
    'requests': ['urllib3', 'charset-normalizer', 'idna', 'certifi'],
    'pandas': ['numpy', 'python-dateutil', 'pytz', 'tzdata'],
    'sqlalchemy': ['greenlet', 'typing-extensions'],
    'celery': ['billiard', 'kombu', 'vine', 'amqp'],
    'pytest': ['iniconfig', 'packaging', 'pluggy', 'colorama'],
    'aiohttp': ['async-timeout', 'attrs', 'charset-normalizer', 'multidict', 'yarl', 'frozenlist', 'aiosignal'],
    'boto3': ['botocore', 'jmespath', 's3transfer'],
    'botocore': ['jmespath', 'python-dateutil', 'urllib3'],
    'cryptography': ['cffi', 'pycparser'],
    'pyopenssl': ['cryptography', 'six'],
    'paramiko': ['cryptography', 'bcrypt', 'pynacl'],
    'transformers': ['numpy', 'packaging', 'regex', 'requests', 'tokenizers', 'tqdm', 'huggingface-hub', 'filelock', 'safetensors', 'pyyaml'],
    'torch': ['typing-extensions', 'sympy', 'networkx', 'jinja2', 'fsspec'],
    'scikit-learn': ['numpy', 'scipy', 'joblib', 'threadpoolctl'],
    'matplotlib': ['numpy', 'pyparsing', 'cycler', 'kiwisolver', 'fonttools', 'packaging', 'pillow', 'python-dateutil', 'contourpy'],
    'spacy': ['numpy', 'spacy-legacy', 'spacy-loggers', 'murmurhash', 'cymem', 'preshed', 'thinc', 'blis', 'wasabi', 'srsly', 'catalogue', 'typer', 'pathy', 'smart-open', 'tqdm', 'requests', 'pydantic', 'jinja2', 'setuptools', 'packaging', 'typing-extensions', 'langcodes'],
    'beautifulsoup4': ['soupsieve'],
    'pillow': [],
    'pyyaml': [],
    'click': [],
    'jinja2': ['markupsafe'],
    'werkzeug': ['markupsafe'],
    'gunicorn': ['setproctitle'],
    'uvicorn': ['click', 'h11', 'typing-extensions'],
    'httpx': ['httpcore', 'certifi', 'charset-normalizer', 'idna', 'sniffio', 'anyio'],
    'pydantic': ['typing-extensions', 'pydantic-core', 'annotated-types'],
    'psycopg2': [],
    'psycopg2-binary': [],
    'pymongo': ['dnspython'],
    'redis': [],
    'python-dateutil': ['six'],
    'pytz': [],
    'six': [],
    'python-dotenv': [],
    'toml': [],
    'tomli': [],
  };

  const transitives = commonTransitives[packageName] || [];

  for (const depName of transitives) {
    const isNew = !seen.has(depName);
    if (isNew) {
      seen.add(depName);
      const license = getLicenseForPackage(depName, 'pip');
      allDependencies.push({
        name: depName,
        version: 'latest',
        license,
        spdxLicense: normalizeLicense(license),
        packageManager: 'pip',
        path: `pip://${depName}`,
      });
    }

    const children = isNew
      ? resolveTransitiveDependencies(depName, seen, allDependencies, depth + 1)
      : [];

    const license = getLicenseForPackage(depName, 'pip');
    result.push({
      name: depName,
      version: 'latest',
      license,
      spdxLicense: normalizeLicense(license),
      packageManager: 'pip',
      children,
      depth,
    });
  }

  return result;
}
