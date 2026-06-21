import { LicenseInfo, RiskLevel } from './types';

export const LICENSE_DATABASE: Record<string, LicenseInfo> = {
  'MIT': {
    spdx: 'MIT',
    name: 'MIT License',
    category: 'permissive',
    copyleftStrength: 'none',
  },
  'MIT-0': {
    spdx: 'MIT-0',
    name: 'MIT No Attribution',
    category: 'permissive',
    copyleftStrength: 'none',
  },
  'Apache-2.0': {
    spdx: 'Apache-2.0',
    name: 'Apache License 2.0',
    category: 'permissive',
    copyleftStrength: 'none',
  },
  'Apache-1.1': {
    spdx: 'Apache-1.1',
    name: 'Apache License 1.1',
    category: 'permissive',
    copyleftStrength: 'none',
  },
  'BSD-3-Clause': {
    spdx: 'BSD-3-Clause',
    name: 'BSD 3-Clause "New" or "Revised" License',
    category: 'permissive',
    copyleftStrength: 'none',
  },
  'BSD-2-Clause': {
    spdx: 'BSD-2-Clause',
    name: 'BSD 2-Clause "Simplified" License',
    category: 'permissive',
    copyleftStrength: 'none',
  },
  'ISC': {
    spdx: 'ISC',
    name: 'ISC License',
    category: 'permissive',
    copyleftStrength: 'none',
  },
  'Unlicense': {
    spdx: 'Unlicense',
    name: 'The Unlicense',
    category: 'permissive',
    copyleftStrength: 'none',
  },
  'CC0-1.0': {
    spdx: 'CC0-1.0',
    name: 'Creative Commons Zero v1.0 Universal',
    category: 'permissive',
    copyleftStrength: 'none',
  },
  'GPL-2.0-only': {
    spdx: 'GPL-2.0-only',
    name: 'GNU General Public License v2.0 only',
    category: 'copyleft',
    copyleftStrength: 'strong',
  },
  'GPL-2.0-or-later': {
    spdx: 'GPL-2.0-or-later',
    name: 'GNU General Public License v2.0 or later',
    category: 'copyleft',
    copyleftStrength: 'strong',
  },
  'GPL-3.0-only': {
    spdx: 'GPL-3.0-only',
    name: 'GNU General Public License v3.0 only',
    category: 'copyleft',
    copyleftStrength: 'strong',
  },
  'GPL-3.0-or-later': {
    spdx: 'GPL-3.0-or-later',
    name: 'GNU General Public License v3.0 or later',
    category: 'copyleft',
    copyleftStrength: 'strong',
  },
  'AGPL-3.0-only': {
    spdx: 'AGPL-3.0-only',
    name: 'GNU Affero General Public License v3.0 only',
    category: 'copyleft',
    copyleftStrength: 'strong',
  },
  'AGPL-3.0-or-later': {
    spdx: 'AGPL-3.0-or-later',
    name: 'GNU Affero General Public License v3.0 or later',
    category: 'copyleft',
    copyleftStrength: 'strong',
  },
  'LGPL-2.1-only': {
    spdx: 'LGPL-2.1-only',
    name: 'GNU Lesser General Public License v2.1 only',
    category: 'weak-copyleft',
    copyleftStrength: 'weak',
  },
  'LGPL-2.1-or-later': {
    spdx: 'LGPL-2.1-or-later',
    name: 'GNU Lesser General Public License v2.1 or later',
    category: 'weak-copyleft',
    copyleftStrength: 'weak',
  },
  'LGPL-3.0-only': {
    spdx: 'LGPL-3.0-only',
    name: 'GNU Lesser General Public License v3.0 only',
    category: 'weak-copyleft',
    copyleftStrength: 'weak',
  },
  'LGPL-3.0-or-later': {
    spdx: 'LGPL-3.0-or-later',
    name: 'GNU Lesser General Public License v3.0 or later',
    category: 'weak-copyleft',
    copyleftStrength: 'weak',
  },
  'MPL-2.0': {
    spdx: 'MPL-2.0',
    name: 'Mozilla Public License 2.0',
    category: 'weak-copyleft',
    copyleftStrength: 'medium',
  },
  'MPL-1.1': {
    spdx: 'MPL-1.1',
    name: 'Mozilla Public License 1.1',
    category: 'weak-copyleft',
    copyleftStrength: 'medium',
  },
  'CDDL-1.0': {
    spdx: 'CDDL-1.0',
    name: 'Common Development and Distribution License 1.0',
    category: 'weak-copyleft',
    copyleftStrength: 'medium',
  },
  'EPL-2.0': {
    spdx: 'EPL-2.0',
    name: 'Eclipse Public License 2.0',
    category: 'weak-copyleft',
    copyleftStrength: 'medium',
  },
  'EPL-1.0': {
    spdx: 'EPL-1.0',
    name: 'Eclipse Public License 1.0',
    category: 'weak-copyleft',
    copyleftStrength: 'medium',
  },
  'Proprietary': {
    spdx: 'Proprietary',
    name: 'Proprietary License',
    category: 'proprietary',
    copyleftStrength: 'none',
  },
  'UNKNOWN': {
    spdx: 'UNKNOWN',
    name: 'Unknown License',
    category: 'unknown',
    copyleftStrength: 'none',
  },
};

export const LICENSE_ALIASES: Record<string, string> = {
  'GPL': 'GPL-3.0-only',
  'GPLv2': 'GPL-2.0-only',
  'GPLv3': 'GPL-3.0-only',
  'GPL-2.0': 'GPL-2.0-only',
  'GPL-3.0': 'GPL-3.0-only',
  'AGPL': 'AGPL-3.0-only',
  'AGPLv3': 'AGPL-3.0-only',
  'LGPL': 'LGPL-3.0-only',
  'LGPLv2.1': 'LGPL-2.1-only',
  'LGPLv3': 'LGPL-3.0-only',
  'LGPL-2.0': 'LGPL-2.1-only',
  'LGPL-3.0': 'LGPL-3.0-only',
  'APACHE': 'Apache-2.0',
  'APACHE2': 'Apache-2.0',
  'APACHE-2': 'Apache-2.0',
  'APACHE2.0': 'Apache-2.0',
  'APACHE 2.0': 'Apache-2.0',
  'BSD': 'BSD-3-Clause',
  'BSD3': 'BSD-3-Clause',
  'BSD2': 'BSD-2-Clause',
  'MPL': 'MPL-2.0',
  'MPLv2': 'MPL-2.0',
  'MPLv1.1': 'MPL-1.1',
  'CC0': 'CC0-1.0',
  'PUBLIC-DOMAIN': 'Unlicense',
  'PUBLIC DOMAIN': 'Unlicense',
};

export interface CompatibilityRule {
  licenseA: string;
  licenseB: string;
  compatible: boolean;
  riskLevel: RiskLevel;
  description: string;
}

export const COMPATIBILITY_MATRIX: CompatibilityRule[] = [
  {
    licenseA: 'GPL-2.0-only',
    licenseB: 'Apache-2.0',
    compatible: false,
    riskLevel: 'critical',
    description: 'GPLv2 is incompatible with Apache 2.0 - Apache 2.0 patent grant requirements conflict with GPLv2 terms',
  },
  {
    licenseA: 'GPL-2.0-only',
    licenseB: 'GPL-3.0-only',
    compatible: false,
    riskLevel: 'high',
    description: 'GPLv2 code cannot be combined with GPLv3 code - the licenses are explicitly incompatible',
  },
  {
    licenseA: 'GPL-2.0-or-later',
    licenseB: 'Apache-2.0',
    compatible: false,
    riskLevel: 'critical',
    description: 'GPLv2+ (without explicit linking exception) is generally considered incompatible with Apache 2.0',
  },
  {
    licenseA: 'GPL-3.0-only',
    licenseB: 'Apache-2.0',
    compatible: true,
    riskLevel: 'low',
    description: 'GPLv3 is compatible with Apache 2.0 - Apache 2.0 code can be included in GPLv3 projects',
  },
  {
    licenseA: 'AGPL-3.0-only',
    licenseB: 'GPL-3.0-only',
    compatible: false,
    riskLevel: 'high',
    description: 'AGPLv3 cannot be combined with GPLv3 without violating the network distribution clause of AGPL',
  },
  {
    licenseA: 'AGPL-3.0-or-later',
    licenseB: 'GPL-3.0-only',
    compatible: false,
    riskLevel: 'high',
    description: 'AGPLv3+ cannot be combined with GPLv3 without violating the network distribution clause of AGPL',
  },
  {
    licenseA: 'CDDL-1.0',
    licenseB: 'GPL-2.0-only',
    compatible: false,
    riskLevel: 'high',
    description: 'CDDL (used by OpenSolaris) is explicitly incompatible with GPLv2',
  },
  {
    licenseA: 'CDDL-1.0',
    licenseB: 'GPL-3.0-only',
    compatible: false,
    riskLevel: 'high',
    description: 'CDDL is incompatible with GPLv3 due to different copyleft requirements',
  },
  {
    licenseA: 'MPL-2.0',
    licenseB: 'GPL-2.0-only',
    compatible: false,
    riskLevel: 'high',
    description: 'MPL 2.0 is incompatible with GPLv2, but can be dual-licensed',
  },
  {
    licenseA: 'MPL-2.0',
    licenseB: 'GPL-3.0-only',
    compatible: true,
    riskLevel: 'medium',
    description: 'MPL 2.0 is explicitly compatible with GPLv3 and LGPLv3 via secondary licensing',
  },
  {
    licenseA: 'EPL-1.0',
    licenseB: 'GPL-2.0-only',
    compatible: false,
    riskLevel: 'high',
    description: 'EPL 1.0 is incompatible with GPLv2',
  },
  {
    licenseA: 'EPL-2.0',
    licenseB: 'GPL-3.0-only',
    compatible: true,
    riskLevel: 'low',
    description: 'EPL 2.0 is compatible with GPLv3 via explicit secondary licensing provision',
  },
  {
    licenseA: 'LGPL-2.1-only',
    licenseB: 'GPL-3.0-only',
    compatible: false,
    riskLevel: 'medium',
    description: 'LGPLv2.1 code cannot be directly linked with GPLv3-only code without upgrading to LGPLv3',
  },
  {
    licenseA: 'LGPL-3.0-only',
    licenseB: 'GPL-2.0-only',
    compatible: false,
    riskLevel: 'high',
    description: 'LGPLv3 is incompatible with GPLv2 due to additional requirements in LGPLv3',
  },
  {
    licenseA: 'Apache-2.0',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'low',
    description: 'Apache 2.0 and MIT are fully compatible permissive licenses',
  },
  {
    licenseA: 'MIT',
    licenseB: 'BSD-3-Clause',
    compatible: true,
    riskLevel: 'low',
    description: 'MIT and BSD are fully compatible permissive licenses',
  },
  {
    licenseA: 'MIT',
    licenseB: 'BSD-2-Clause',
    compatible: true,
    riskLevel: 'low',
    description: 'MIT and BSD-2-Clause are fully compatible permissive licenses',
  },
  {
    licenseA: 'MIT',
    licenseB: 'ISC',
    compatible: true,
    riskLevel: 'low',
    description: 'MIT and ISC are effectively equivalent and fully compatible',
  },
  {
    licenseA: 'Apache-2.0',
    licenseB: 'BSD-3-Clause',
    compatible: true,
    riskLevel: 'low',
    description: 'Apache 2.0 and BSD-3-Clause are fully compatible permissive licenses',
  },
  {
    licenseA: 'GPL-3.0-only',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'medium',
    description: 'MIT code can be included in GPLv3 projects, but the combined work will be under GPLv3 (copyleft infection)',
  },
  {
    licenseA: 'GPL-3.0-only',
    licenseB: 'BSD-3-Clause',
    compatible: true,
    riskLevel: 'medium',
    description: 'BSD code can be included in GPLv3 projects, but the combined work will be under GPLv3 (copyleft infection)',
  },
  {
    licenseA: 'GPL-2.0-only',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'medium',
    description: 'MIT code can be included in GPLv2 projects, but the combined work will be under GPLv2 (copyleft infection)',
  },
  {
    licenseA: 'GPL-2.0-only',
    licenseB: 'BSD-3-Clause',
    compatible: true,
    riskLevel: 'medium',
    description: 'BSD code can be included in GPLv2 projects, but the combined work will be under GPLv2 (copyleft infection)',
  },
  {
    licenseA: 'LGPL-3.0-only',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'low',
    description: 'MIT code can be combined with LGPLv3 code without issues',
  },
  {
    licenseA: 'LGPL-3.0-only',
    licenseB: 'Apache-2.0',
    compatible: true,
    riskLevel: 'low',
    description: 'Apache 2.0 code can be combined with LGPLv3 code without issues',
  },
  {
    licenseA: 'LGPL-2.1-only',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'low',
    description: 'MIT code can be combined with LGPLv2.1 code without issues',
  },
  {
    licenseA: 'Proprietary',
    licenseB: 'GPL-3.0-only',
    compatible: false,
    riskLevel: 'critical',
    description: 'Proprietary code cannot be distributed with GPL code - this is the classic GPL infection risk',
  },
  {
    licenseA: 'Proprietary',
    licenseB: 'GPL-2.0-only',
    compatible: false,
    riskLevel: 'critical',
    description: 'Proprietary code cannot be distributed with GPLv2 code - this is the classic GPL infection risk',
  },
  {
    licenseA: 'Proprietary',
    licenseB: 'AGPL-3.0-only',
    compatible: false,
    riskLevel: 'critical',
    description: 'Proprietary code using AGPL libraries over a network triggers AGPL copyleft requirements',
  },
  {
    licenseA: 'Proprietary',
    licenseB: 'LGPL-3.0-only',
    compatible: true,
    riskLevel: 'medium',
    description: 'Proprietary code can dynamically link with LGPL libraries, but static linking requires source disclosure',
  },
  {
    licenseA: 'Proprietary',
    licenseB: 'LGPL-2.1-only',
    compatible: true,
    riskLevel: 'medium',
    description: 'Proprietary code can dynamically link with LGPLv2.1 libraries, but static linking requires source disclosure',
  },
  {
    licenseA: 'Proprietary',
    licenseB: 'MIT',
    compatible: true,
    riskLevel: 'low',
    description: 'MIT license allows use in proprietary software with attribution',
  },
  {
    licenseA: 'Proprietary',
    licenseB: 'Apache-2.0',
    compatible: true,
    riskLevel: 'low',
    description: 'Apache 2.0 allows use in proprietary software with attribution and NOTICE preservation',
  },
  {
    licenseA: 'Proprietary',
    licenseB: 'BSD-3-Clause',
    compatible: true,
    riskLevel: 'low',
    description: 'BSD-3-Clause allows use in proprietary software with attribution',
  },
];

export const RISK_LEVEL_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function normalizeLicense(raw: string | undefined | null): string {
  if (!raw) return 'UNKNOWN';
  
  let license = raw.trim().toUpperCase();
  
  if (license.startsWith('(') && license.endsWith(')')) {
    license = license.slice(1, -1);
  }
  
  if (license.includes(' OR ') || license.includes('|')) {
    const parts = license.split(/\s+OR\s+|\s*\|\s*/).map(p => p.trim());
    return parts.map(normalizeSingleLicense).join(' OR ');
  }
  
  if (license.includes(' AND ')) {
    const parts = license.split(/\s+AND\s+/).map(p => p.trim());
    return parts.map(normalizeSingleLicense).join(' AND ');
  }
  
  return normalizeSingleLicense(license);
}

function normalizeSingleLicense(license: string): string {
  const upperLicense = license.toUpperCase().trim();
  
  if (LICENSE_DATABASE[upperLicense]) {
    return upperLicense;
  }
  
  if (LICENSE_DATABASE[license]) {
    return license;
  }
  
  if (LICENSE_ALIASES[upperLicense]) {
    return LICENSE_ALIASES[upperLicense];
  }
  
  for (const key of Object.keys(LICENSE_DATABASE)) {
    if (key.toUpperCase() === upperLicense) {
      return key;
    }
  }
  
  for (const [alias, canonical] of Object.entries(LICENSE_ALIASES)) {
    if (alias.toUpperCase() === upperLicense) {
      return canonical;
    }
  }
  
  return 'UNKNOWN';
}

export function getLicenseInfo(license: string): LicenseInfo {
  if (LICENSE_DATABASE[license]) {
    return LICENSE_DATABASE[license];
  }
  
  const normalized = normalizeLicense(license);
  if (LICENSE_DATABASE[normalized]) {
    return LICENSE_DATABASE[normalized];
  }
  
  return LICENSE_DATABASE['UNKNOWN'];
}
