import { normalizeLicense } from '../license-matrix';

describe('normalizeLicense', () => {
  describe('alias conversion', () => {
    it('converts "GPL" to GPL-3.0-only', () => {
      expect(normalizeLicense('GPL')).toBe('GPL-3.0-only');
    });

    it('converts "GPLv2" to GPL-2.0-only', () => {
      expect(normalizeLicense('GPLv2')).toBe('GPL-2.0-only');
    });

    it('converts "APACHE" to Apache-2.0', () => {
      expect(normalizeLicense('APACHE')).toBe('Apache-2.0');
    });

    it('converts "BSD" to BSD-3-Clause', () => {
      expect(normalizeLicense('BSD')).toBe('BSD-3-Clause');
    });

    it('converts "MPL" to MPL-2.0', () => {
      expect(normalizeLicense('MPL')).toBe('MPL-2.0');
    });

    it('passes through canonical SPDX identifiers unchanged', () => {
      expect(normalizeLicense('MIT')).toBe('MIT');
      expect(normalizeLicense('Apache-2.0')).toBe('Apache-2.0');
      expect(normalizeLicense('GPL-3.0-only')).toBe('GPL-3.0-only');
      expect(normalizeLicense('BSD-2-Clause')).toBe('BSD-2-Clause');
    });

    it('handles case-insensitive SPDX lookup', () => {
      expect(normalizeLicense('apache-2.0')).toBe('Apache-2.0');
      expect(normalizeLicense('mit')).toBe('MIT');
    });
  });

  describe('compound expressions', () => {
    it('normalizes "MIT OR Apache-2.0" preserving OR semantics', () => {
      const result = normalizeLicense('MIT OR Apache-2.0');
      expect(result).toBe('MIT OR Apache-2.0');
    });

    it('expands aliases inside OR expressions', () => {
      const result = normalizeLicense('MIT OR GPL');
      expect(result).toBe('MIT OR GPL-3.0-only');
    });

    it('normalizes AND expressions', () => {
      const result = normalizeLicense('MIT AND Apache-2.0');
      expect(result).toBe('MIT AND Apache-2.0');
    });

    it('treats pipe separator as OR', () => {
      const result = normalizeLicense('MIT | Apache-2.0');
      expect(result).toBe('MIT OR Apache-2.0');
    });

    it('strips surrounding parentheses before processing', () => {
      expect(normalizeLicense('(MIT)')).toBe('MIT');
      expect(normalizeLicense('(MIT OR Apache-2.0)')).toBe('MIT OR Apache-2.0');
    });
  });

  describe('empty and null values', () => {
    it('returns UNKNOWN for undefined', () => {
      expect(normalizeLicense(undefined)).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for null', () => {
      expect(normalizeLicense(null)).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for empty string', () => {
      expect(normalizeLicense('')).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for whitespace-only string', () => {
      expect(normalizeLicense('   ')).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for unrecognized license string', () => {
      expect(normalizeLicense('Some-Fake-License-XYZ')).toBe('UNKNOWN');
    });
  });
});
