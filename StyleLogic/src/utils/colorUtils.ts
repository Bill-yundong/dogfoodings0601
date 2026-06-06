import type { RGB, HSL, ColorData, ColorTemperature, ColorSaturation, ColorDepth } from '../types';

export const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

export const rgbToHex = (rgb: RGB): string => {
  return (
    '#' +
    [rgb.r, rgb.g, rgb.b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
};

export const rgbToHsl = (rgb: RGB): HSL => {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

export const hslToRgb = (hsl: HSL): RGB => {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

export const calculateColorTemperature = (rgb: RGB): ColorTemperature => {
  const r = rgb.r;
  const b = rgb.b;
  const diff = r - b;

  if (diff > 30) return 'warm';
  if (diff < -30) return 'cool';
  return 'neutral';
};

export const calculateColorSaturation = (hsl: HSL): ColorSaturation => {
  if (hsl.s >= 70) return 'bright';
  if (hsl.s >= 40) return 'muted';
  return 'soft';
};

export const calculateColorDepth = (hsl: HSL): ColorDepth => {
  return hsl.l < 50 ? 'deep' : 'light';
};

export const calculateColorContrast = (rgb1: RGB, rgb2: RGB): number => {
  const l1 = calculateRelativeLuminance(rgb1);
  const l2 = calculateRelativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

export const calculateRelativeLuminance = (rgb: RGB): number => {
  const sRGB = {
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255,
  };

  const convert = (c: number) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * convert(sRGB.r) + 0.7152 * convert(sRGB.g) + 0.0722 * convert(sRGB.b)
  );
};

export const calculateColorDistance = (rgb1: RGB, rgb2: RGB): number => {
  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;
  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
};

export const createColorData = (
  id: string,
  name: string,
  hex: string,
  description: string,
): ColorData => {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);

  return {
    id,
    name,
    hex: hex.toUpperCase(),
    rgb,
    hsl,
    temperature: calculateColorTemperature(rgb),
    saturation: calculateColorSaturation(hsl),
    depth: calculateColorDepth(hsl),
    seasonalType: determineSeasonalType(
      calculateColorTemperature(rgb),
      calculateColorSaturation(hsl),
      calculateColorDepth(hsl),
    ),
    description,
  };
};

const determineSeasonalType = (
  temp: ColorTemperature,
  sat: ColorSaturation,
  depth: ColorDepth,
): ColorData['seasonalType'] => {
  if (temp === 'warm') {
    if (sat === 'bright') return depth === 'deep' ? 'autumn' : 'spring';
    return depth === 'deep' ? 'autumn' : 'spring';
  }
  if (temp === 'cool') {
    if (sat === 'bright') return depth === 'deep' ? 'winter' : 'summer';
    return depth === 'deep' ? 'winter' : 'summer';
  }
  return sat === 'bright' ? 'spring' : 'summer';
};
