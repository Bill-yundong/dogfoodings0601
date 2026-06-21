import * as fs from 'fs';
import * as path from 'path';
import { DependencyNode, DependencyInfo, ParserResult } from '../types';
import { normalizeLicense } from '../license-matrix';
import { getLicenseForPackage } from '../license-db';

interface GoModule {
  name: string;
  version: string;
  indirect: boolean;
  replace?: string;
}

export function parseGoMod(projectPath: string): ParserResult {
  const goModPath = path.join(projectPath, 'go.mod');

  if (!fs.existsSync(goModPath)) {
    return {
      packageManager: 'go',
      rootDependencies: [],
      allDependencies: [],
    };
  }

  const content = fs.readFileSync(goModPath, 'utf-8');
  const modules = parseGoModContent(content);

  const rootDependencies: DependencyNode[] = [];
  const allDependencies: DependencyInfo[] = [];
  const seen = new Set<string>();

  for (const mod of modules) {
    if (mod.indirect) continue;
    if (seen.has(mod.name)) continue;
    seen.add(mod.name);

    const license = getLicenseForPackage(mod.name, 'go');
    const spdxLicense = normalizeLicense(license);

    const depInfo: DependencyInfo = {
      name: mod.name,
      version: mod.version,
      license,
      spdxLicense,
      packageManager: 'go',
      path: `go://${mod.name}`,
    };
    allDependencies.push(depInfo);

    const children = resolveGoTransitiveDependencies(mod.name, seen, allDependencies, 1);

    rootDependencies.push({
      name: mod.name,
      version: mod.version,
      license,
      spdxLicense,
      packageManager: 'go',
      children,
      depth: 0,
    });
  }

  for (const mod of modules) {
    if (!mod.indirect) continue;
    if (seen.has(mod.name)) continue;
    seen.add(mod.name);

    const license = getLicenseForPackage(mod.name, 'go');
    const spdxLicense = normalizeLicense(license);

    allDependencies.push({
      name: mod.name,
      version: mod.version,
      license,
      spdxLicense,
      packageManager: 'go',
      path: `go://${mod.name}`,
    });
  }

  return {
    packageManager: 'go',
    rootDependencies,
    allDependencies,
  };
}

function parseGoModContent(content: string): GoModule[] {
  const result: GoModule[] = [];
  const lines = content.split('\n');

  let inRequireBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }

    if (trimmed.startsWith('module ') || trimmed.startsWith('go ') || trimmed.startsWith('toolchain ')) {
      continue;
    }

    if (trimmed.startsWith('require (')) {
      inRequireBlock = true;
      continue;
    }

    if (trimmed.startsWith('replace (')) {
      continue;
    }

    if (trimmed === ')') {
      inRequireBlock = false;
      continue;
    }

    if (inRequireBlock || trimmed.startsWith('require ')) {
      let depLine = trimmed;
      if (trimmed.startsWith('require ')) {
        depLine = trimmed.substring(8).trim();
      }

      const parts = depLine.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts[0];
        const version = parts[1].replace(/^v/, '');
        const indirect = parts.length >= 3 && parts[2] === '//' && parts[3] === 'indirect';

        result.push({
          name,
          version,
          indirect,
        });
      }
    }
  }

  return result;
}

function resolveGoTransitiveDependencies(
  moduleName: string,
  seen: Set<string>,
  allDependencies: DependencyInfo[],
  depth: number
): DependencyNode[] {
  const result: DependencyNode[] = [];

  if (depth > 2) return result;

  const commonTransitives: Record<string, string[]> = {
    'github.com/gin-gonic/gin': [
      'github.com/gin-contrib/sse',
      'github.com/go-playground/validator/v10',
      'github.com/goccy/go-json',
      'github.com/json-iterator/go',
      'github.com/modern-go/concurrent',
      'github.com/modern-go/reflect2',
      'github.com/pelletier/go-toml/v2',
      'github.com/twitchyliquid64/golang-asm',
      'github.com/ugorji/go/codec',
      'golang.org/x/arch',
      'golang.org/x/crypto',
      'golang.org/x/net',
      'golang.org/x/sys',
      'golang.org/x/text',
      'google.golang.org/protobuf',
      'gopkg.in/yaml.v3',
    ],
    'github.com/gorilla/mux': [
      'github.com/gorilla/context',
    ],
    'github.com/gorilla/websocket': [],
    'gorm.io/gorm': [
      'github.com/jinzhu/inflection',
      'gorm.io/utils',
    ],
    'gorm.io/driver/mysql': [
      'gorm.io/gorm',
      'github.com/go-sql-driver/mysql',
    ],
    'gorm.io/driver/postgres': [
      'gorm.io/gorm',
      'github.com/lib/pq',
    ],
    'github.com/go-redis/redis/v8': [
      'github.com/cespare/xxhash/v2',
      'github.com/dgryski/go-rendezvous',
      'github.com/onsi/ginkgo',
      'github.com/onsi/gomega',
    ],
    'github.com/redis/go-redis/v9': [
      'github.com/cespare/xxhash/v2',
      'github.com/dgryski/go-rendezvous',
    ],
    'github.com/spf13/cobra': [
      'github.com/inconshreveable/mousetrap',
      'github.com/spf13/pflag',
      'github.com/cpuguy83/go-md2man/v2',
    ],
    'github.com/spf13/viper': [
      'github.com/fsnotify/fsnotify',
      'github.com/hashicorp/hcl',
      'github.com/magiconair/properties',
      'github.com/mitchellh/mapstructure',
      'github.com/pelletier/go-toml',
      'github.com/spf13/afero',
      'github.com/spf13/cast',
      'github.com/spf13/jwalterweatherman',
      'github.com/spf13/pflag',
      'github.com/subosito/gotenv',
      'gopkg.in/ini.v1',
      'gopkg.in/yaml.v2',
    ],
    'github.com/sirupsen/logrus': [
      'github.com/davecgh/go-spew',
      'github.com/pmezard/go-difflib',
      'github.com/stretchr/testify',
      'golang.org/x/sys',
      'golang.org/x/crypto',
    ],
    'github.com/rs/zerolog': [
      'github.com/rs/xid',
      'github.com/mattn/go-colorable',
      'github.com/mattn/go-isatty',
      'golang.org/x/sys',
    ],
    'go.uber.org/zap': [
      'go.uber.org/atomic',
      'go.uber.org/multierr',
      'go.uber.org/zap/buffer',
      'go.uber.org/zap/zapcore',
      'github.com/benbjohnson/clock',
    ],
    'google.golang.org/grpc': [
      'github.com/golang/protobuf',
      'github.com/google/go-cmp',
      'github.com/google/uuid',
      'golang.org/x/net',
      'golang.org/x/sys',
      'golang.org/x/text',
      'google.golang.org/genproto',
      'google.golang.org/protobuf',
    ],
    'github.com/json-iterator/go': [
      'github.com/modern-go/concurrent',
      'github.com/modern-go/reflect2',
    ],
    'github.com/stretchr/testify': [
      'github.com/davecgh/go-spew',
      'github.com/pmezard/go-difflib',
      'github.com/stretchr/objx',
      'gopkg.in/yaml.v3',
    ],
    'github.com/go-sql-driver/mysql': [
      'github.com/go-sql-driver/mysql/driver',
    ],
    'github.com/lib/pq': [],
    'github.com/mattn/go-sqlite3': [],
    'github.com/labstack/echo/v4': [
      'github.com/labstack/gommon',
      'github.com/mattn/go-colorable',
      'github.com/mattn/go-isatty',
      'github.com/valyala/fasttemplate',
      'golang.org/x/crypto',
      'golang.org/x/net',
      'golang.org/x/sys',
      'golang.org/x/text',
    ],
    'github.com/gofiber/fiber/v2': [
      'github.com/andybalholm/brotli',
      'github.com/mattn/go-colorable',
      'github.com/mattn/go-isatty',
      'github.com/valyala/fasthttp',
      'github.com/valyala/fasttemplate',
      'github.com/klauspost/compress',
      'golang.org/x/sys',
    ],
    'github.com/valyala/fasthttp': [
      'github.com/andybalholm/brotli',
      'github.com/klauspost/compress',
      'github.com/valyala/bytebufferpool',
      'golang.org/x/sys',
    ],
    'github.com/urfave/cli/v2': [
      'github.com/cpuguy83/go-md2man/v2',
      'github.com/russross/blackfriday/v2',
      'github.com/xrash/smetrics',
    ],
    'github.com/tidwall/gjson': [
      'github.com/tidwall/match',
      'github.com/tidwall/pretty',
    ],
    'gopkg.in/yaml.v3': [],
    'gopkg.in/yaml.v2': [],
    'github.com/google/uuid': [],
    'github.com/mitchellh/mapstructure': [
      'github.com/mitchellh/reflectwalk',
    ],
    'github.com/pkg/errors': [],
    'github.com/robfig/cron/v3': [],
    'github.com/olekukonko/tablewriter': [
      'github.com/mattn/go-runewidth',
    ],
    'github.com/fatih/color': [
      'github.com/mattn/go-colorable',
      'github.com/mattn/go-isatty',
    ],
    'github.com/mattn/go-colorable': [
      'github.com/mattn/go-isatty',
      'golang.org/x/sys',
    ],
    'github.com/mattn/go-isatty': [
      'golang.org/x/sys',
    ],
    'github.com/go-playground/validator/v10': [
      'github.com/go-playground/universal-translator',
      'github.com/go-playground/locales',
      'github.com/leodido/go-urn',
    ],
    'github.com/pelletier/go-toml/v2': [],
    'github.com/pelletier/go-toml': [],
    'github.com/cespare/xxhash/v2': [],
    'github.com/dgryski/go-rendezvous': [],
    'github.com/modern-go/concurrent': [],
    'github.com/modern-go/reflect2': [
      'github.com/modern-go/concurrent',
    ],
    'github.com/ugorji/go/codec': [],
    'golang.org/x/crypto': [
      'golang.org/x/sys',
    ],
    'golang.org/x/net': [
      'golang.org/x/sys',
      'golang.org/x/text',
    ],
    'golang.org/x/sys': [],
    'golang.org/x/text': [],
    'google.golang.org/protobuf': [
      'google.golang.org/protobuf/reflect',
      'google.golang.org/protobuf/runtime',
      'google.golang.org/protobuf/types',
      'google.golang.org/protobuf/encoding',
      'google.golang.org/protobuf/internal',
    ],
    'github.com/golang/protobuf': [
      'google.golang.org/protobuf',
    ],
  };

  const transitives = commonTransitives[moduleName] || [];

  for (const depName of transitives) {
    const isNew = !seen.has(depName);
    if (isNew) {
      seen.add(depName);
      const license = getLicenseForPackage(depName, 'go');
      allDependencies.push({
        name: depName,
        version: 'latest',
        license,
        spdxLicense: normalizeLicense(license),
        packageManager: 'go',
        path: `go://${depName}`,
      });
    }

    const children = isNew
      ? resolveGoTransitiveDependencies(depName, seen, allDependencies, depth + 1)
      : [];

    const license = getLicenseForPackage(depName, 'go');
    result.push({
      name: depName,
      version: 'latest',
      license,
      spdxLicense: normalizeLicense(license),
      packageManager: 'go',
      children,
      depth,
    });
  }

  return result;
}
