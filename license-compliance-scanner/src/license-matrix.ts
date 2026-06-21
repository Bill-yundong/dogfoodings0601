import { LicenseCompatibilityRule, RiskLevel } from './types';

const LICENSE_CATEGORIES: Record<string, string> = {
  'MIT': 'Permissive',
  'MIT-0': 'Permissive',
  'BSD-2-Clause': 'Permissive',
  'BSD-3-Clause': 'Permissive',
  'Apache-2.0': 'Permissive',
  'ISC': 'Permissive',
  'Unlicense': 'Public Domain',
  'CC0-1.0': 'Public Domain',
  '0BSD': 'Public Domain',
  'WTFPL': 'Public Domain',
  'MPL-2.0': 'Weak Copyleft',
  'LGPL-2.1': 'Weak Copyleft',
  'LGPL-3.0': 'Weak Copyleft',
  'EPL-1.0': 'Weak Copyleft',
  'EPL-2.0': 'Weak Copyleft',
  'GPL-2.0': 'Strong Copyleft',
  'GPL-3.0': 'Strong Copyleft',
  'AGPL-3.0': 'Network Copyleft',
  'SSPL-1.0': 'Network Copyleft',
  'BUSL-1.1': 'Source Available',
  'BSL-1.0': 'Boost Software',
  'Python-2.0': 'Permissive',
  'PSF-2.0': 'Permissive',
  'Zlib': 'Permissive',
  'X11': 'Permissive',
};

const LICENSE_ALIASES: Record<string, string> = {
  'mit': 'MIT',
  'MIT License': 'MIT',
  'The MIT License': 'MIT',
  'apache': 'Apache-2.0',
  'apache-2': 'Apache-2.0',
  'Apache 2.0': 'Apache-2.0',
  'Apache License 2.0': 'Apache-2.0',
  'apache2': 'Apache-2.0',
  'gpl': 'GPL-3.0',
  'gpl-3': 'GPL-3.0',
  'gpl3': 'GPL-3.0',
  'gpl-2': 'GPL-2.0',
  'gpl2': 'GPL-2.0',
  'lgpl': 'LGPL-3.0',
  'lgpl-3': 'LGPL-3.0',
  'lgpl-2.1': 'LGPL-2.1',
  'bsd': 'BSD-3-Clause',
  'bsd-3': 'BSD-3-Clause',
  'bsd3': 'BSD-3-Clause',
  'bsd-2': 'BSD-2-Clause',
  'bsd2': 'BSD-2-Clause',
  'mpl': 'MPL-2.0',
  'mpl-2': 'MPL-2.0',
  'mpl2': 'MPL-2.0',
  'isc': 'ISC',
  'ISC License': 'ISC',
  'agpl': 'AGPL-3.0',
  'agpl-3': 'AGPL-3.0',
  'agpl3': 'AGPL-3.0',
  'unlicense': 'Unlicense',
  'cc0': 'CC0-1.0',
  'cc0-1': 'CC0-1.0',
  'wtfpl': 'WTFPL',
  'epl': 'EPL-2.0',
  'epl-2': 'EPL-2.0',
  'epl-1': 'EPL-1.0',
  'python': 'Python-2.0',
  'python-2': 'Python-2.0',
  'psf': 'PSF-2.0',
  '0bsd': '0BSD',
  'bsl': 'BSL-1.0',
  'zlib': 'Zlib',
  'x11': 'X11',
};

const COMPATIBILITY_MATRIX: LicenseCompatibilityRule[] = [
  {
    licenseA: 'GPL-2.0',
    licenseB: 'GPL-3.0',
    compatible: false,
    riskLevel: 'high',
    description: 'GPL-2.0 和 GPL-3.0 不兼容，不能在同一作品中混用'
  },
  {
    licenseA: 'GPL-3.0',
    licenseB: 'GPL-2.0',
    compatible: false,
    riskLevel: 'high',
    description: 'GPL-3.0 和 GPL-2.0 不兼容，不能在同一作品中混用'
  },
  {
    licenseA: 'AGPL-3.0',
    licenseB: 'GPL-2.0',
    compatible: false,
    riskLevel: 'critical',
    description: 'AGPL-3.0 与 GPL-2.0 不兼容，存在严重传染风险'
  },
  {
    licenseA: 'GPL-2.0',
    licenseB: 'AGPL-3.0',
    compatible: false,
    riskLevel: 'critical',
    description: 'GPL-2.0 与 AGPL-3.0 不兼容，存在严重传染风险'
  },
  {
    licenseA: 'AGPL-3.0',
    licenseB: 'GPL-3.0',
    compatible: true,
    riskLevel: 'medium',
    description: 'AGPL-3.0 代码可以并入 GPL-3.0 项目，但反之不行'
  },
  {
    licenseA: 'GPL-3.0',
    licenseB: 'AGPL-3.0',
    compatible: false,
    riskLevel: 'high',
    description: 'GPL-3.0 代码不能直接并入 AGPL-3.0 项目'
  },
  {
    licenseA: 'MIT',
    licenseB: 'GPL-2.0',
    compatible: true,
    riskLevel: 'medium',
    description: 'MIT 代码可以在 GPL-2.0 项目中使用，MIT 代码将被 GPL-2.0 传染'
  },
  {
    licenseA: 'GPL-2.0',
    licenseB: 'MIT',
    compatible: false,
    riskLevel: 'high',
    description: 'GPL-2.0 代码不能在 MIT 许可的项目中使用，会导致整个项目被 GPL 传染'
  },
  {
    licenseA: 'MIT',
    licenseB: 'GPL-3.0',
    compatible: true,
    riskLevel: 'medium',
    description: 'MIT 代码可以在 GPL-3.0 项目中使用，MIT 代码将被 GPL-3.0 传染'
  },
  {
    licenseA: 'GPL-3.0',
    licenseB: 'MIT',
    compatible: false,
    riskLevel: 'high',
    description: 'GPL-3.0 代码不能在 MIT 许可的项目中使用，会导致整个项目被 GPL 传染'
  },
  {
    licenseA: 'Apache-2.0',
    licenseB: 'GPL-2.0',
    compatible: false,
    riskLevel: 'critical',
    description: 'Apache-2.0 与 GPL-2.0 不兼容，Apache-2.0 的专利授权条款与 GPL-2.0 冲突'
  },
  {
    licenseA: 'GPL-2.0',
    licenseB: 'Apache-2.0',
    compatible: false,
    riskLevel: 'critical',
    description: 'GPL-2.0 与 Apache-2.0 不兼容，Apache-2.0 的专利授权条款与 GPL-2.0 冲突'
  },
  {
    licenseA: 'Apache-2.0',
    licenseB: 'GPL-3.0',
    compatible: true,
    riskLevel: 'medium',
    description: 'Apache-2.0 代码可以在 GPL-3.0 项目中使用'
  },
  {
    licenseA: 'GPL-3.0',
    licenseB: 'Apache-2.0',
    compatible: false,
    riskLevel: 'high',
    description: 'GPL-3.0 代码不能在 Apache-2.0 许可的项目中使用，会导致传染'
  },
  {
    licenseA: 'MIT',
    licenseB: 'Apache-2.0',
    compatible: true,
    riskLevel: 'low',
    description: 'MIT 与 Apache-2.0 兼容，可以自由混用'
  },
  {
    licenseA: 'Apache-2.0',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'low',
    description: 'Apache-2.0 与 MIT 兼容，可以自由混用'
  },
  {
    licenseA: 'MIT',
    licenseB: 'BSD-3-Clause',
    compatible: true,
    riskLevel: 'low',
    description: 'MIT 与 BSD-3-Clause 兼容，可以自由混用'
  },
  {
    licenseA: 'BSD-3-Clause',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'low',
    description: 'BSD-3-Clause 与 MIT 兼容，可以自由混用'
  },
  {
    licenseA: 'BSD-2-Clause',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'low',
    description: 'BSD-2-Clause 与 MIT 兼容，可以自由混用'
  },
  {
    licenseA: 'MIT',
    licenseB: 'BSD-2-Clause',
    compatible: true,
    riskLevel: 'low',
    description: 'MIT 与 BSD-2-Clause 兼容，可以自由混用'
  },
  {
    licenseA: 'LGPL-2.1',
    licenseB: 'GPL-2.0',
    compatible: true,
    riskLevel: 'medium',
    description: 'LGPL-2.1 代码可以在 GPL-2.0 项目中使用'
  },
  {
    licenseA: 'GPL-2.0',
    licenseB: 'LGPL-2.1',
    compatible: false,
    riskLevel: 'high',
    description: 'GPL-2.0 代码不能在 LGPL-2.1 项目中使用，会导致传染升级'
  },
  {
    licenseA: 'LGPL-3.0',
    licenseB: 'GPL-3.0',
    compatible: true,
    riskLevel: 'medium',
    description: 'LGPL-3.0 代码可以在 GPL-3.0 项目中使用'
  },
  {
    licenseA: 'GPL-3.0',
    licenseB: 'LGPL-3.0',
    compatible: false,
    riskLevel: 'high',
    description: 'GPL-3.0 代码不能在 LGPL-3.0 项目中使用，会导致传染升级'
  },
  {
    licenseA: 'MPL-2.0',
    licenseB: 'GPL-2.0',
    compatible: false,
    riskLevel: 'high',
    description: 'MPL-2.0 与 GPL-2.0 不兼容'
  },
  {
    licenseA: 'GPL-2.0',
    licenseB: 'MPL-2.0',
    compatible: false,
    riskLevel: 'high',
    description: 'GPL-2.0 与 MPL-2.0 不兼容'
  },
  {
    licenseA: 'MPL-2.0',
    licenseB: 'GPL-3.0',
    compatible: true,
    riskLevel: 'medium',
    description: 'MPL-2.0 代码可以在 GPL-3.0 项目中使用'
  },
  {
    licenseA: 'GPL-3.0',
    licenseB: 'MPL-2.0',
    compatible: false,
    riskLevel: 'high',
    description: 'GPL-3.0 代码不能在 MPL-2.0 项目中使用'
  },
  {
    licenseA: 'MIT',
    licenseB: 'ISC',
    compatible: true,
    riskLevel: 'low',
    description: 'MIT 与 ISC 兼容，可以自由混用'
  },
  {
    licenseA: 'ISC',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'low',
    description: 'ISC 与 MIT 兼容，可以自由混用'
  },
  {
    licenseA: 'Unlicense',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'low',
    description: 'Unlicense 属于公共领域，与所有许可证兼容'
  },
  {
    licenseA: 'CC0-1.0',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'low',
    description: 'CC0-1.0 属于公共领域，与所有许可证兼容'
  },
  {
    licenseA: 'SSPL-1.0',
    licenseB: 'MIT',
    compatible: false,
    riskLevel: 'critical',
    description: 'SSPL-1.0 是强传染性许可证，不能与 MIT 等宽松许可证混用'
  },
  {
    licenseA: 'MIT',
    licenseB: 'SSPL-1.0',
    compatible: false,
    riskLevel: 'critical',
    description: 'MIT 代码不能与 SSPL-1.0 代码混用，存在严重传染风险'
  },
  {
    licenseA: 'BUSL-1.1',
    licenseB: 'MIT',
    compatible: false,
    riskLevel: 'high',
    description: 'BUSL-1.1 是源码可用许可证，与开源许可证不兼容'
  },
  {
    licenseA: 'MIT',
    licenseB: 'BUSL-1.1',
    compatible: false,
    riskLevel: 'high',
    description: 'MIT 代码不能与 BUSL-1.1 代码混用'
  },
];

const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function normalizeLicense(license: string): string {
  if (!license) return 'UNKNOWN';

  const cleaned = license.trim();

  if (LICENSE_ALIASES[cleaned]) {
    return LICENSE_ALIASES[cleaned];
  }

  const lowerCleaned = cleaned.toLowerCase();
  for (const [alias, spdx] of Object.entries(LICENSE_ALIASES)) {
    if (alias.toLowerCase() === lowerCleaned) {
      return spdx;
    }
  }

  const spdxMatch = cleaned.match(/^[A-Za-z0-9-.]+$/);
  if (spdxMatch && cleaned.length >= 3) {
    return cleaned;
  }

  return 'UNKNOWN';
}

export function getLicenseCategory(license: string): string {
  return LICENSE_CATEGORIES[license] || 'Unknown';
}

export function checkCompatibility(licenseA: string, licenseB: string): LicenseCompatibilityRule | null {
  if (licenseA === licenseB) {
    return {
      licenseA,
      licenseB,
      compatible: true,
      riskLevel: 'low',
      description: '相同许可证完全兼容'
    };
  }

  if (licenseA === 'UNKNOWN' || licenseB === 'UNKNOWN') {
    return {
      licenseA,
      licenseB,
      compatible: false,
      riskLevel: 'high',
      description: '存在未知许可证，需要人工审查'
    };
  }

  const rule = COMPATIBILITY_MATRIX.find(
    r => r.licenseA === licenseA && r.licenseB === licenseB
  );

  if (rule) return rule;

  const categoryA = getLicenseCategory(licenseA);
  const categoryB = getLicenseCategory(licenseB);

  if (categoryA === 'Public Domain' || categoryB === 'Public Domain') {
    return {
      licenseA,
      licenseB,
      compatible: true,
      riskLevel: 'low',
      description: '公共领域许可证与所有许可证兼容'
    };
  }

  if (categoryA === 'Permissive' && categoryB === 'Permissive') {
    return {
      licenseA,
      licenseB,
      compatible: true,
      riskLevel: 'low',
      description: '宽松许可证之间通常兼容'
    };
  }

  return {
    licenseA,
    licenseB,
    compatible: false,
    riskLevel: 'medium',
    description: `${licenseA} 与 ${licenseB} 的兼容性未在矩阵中定义，建议人工审查`
  };
}

export function compareRiskLevels(a: RiskLevel, b: RiskLevel): number {
  return RISK_LEVEL_ORDER[a] - RISK_LEVEL_ORDER[b];
}

export function isStrongCopyleft(license: string): boolean {
  const category = getLicenseCategory(license);
  return category === 'Strong Copyleft' || category === 'Network Copyleft';
}

export function isWeakCopyleft(license: string): boolean {
  return getLicenseCategory(license) === 'Weak Copyleft';
}

export function isPermissive(license: string): boolean {
  return getLicenseCategory(license) === 'Permissive' || getLicenseCategory(license) === 'Public Domain';
}

export { LICENSE_CATEGORIES, LICENSE_ALIASES, COMPATIBILITY_MATRIX, RISK_LEVEL_ORDER };
