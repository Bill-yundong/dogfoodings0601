export type SeasonalColorType = 'spring' | 'summer' | 'autumn' | 'winter';

export type ColorTemperature = 'warm' | 'cool' | 'neutral';
export type ColorSaturation = 'bright' | 'muted' | 'soft';
export type ColorDepth = 'deep' | 'light';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface ColorData {
  id: string;
  name: string;
  hex: string;
  rgb: RGB;
  hsl: HSL;
  temperature: ColorTemperature;
  saturation: ColorSaturation;
  depth: ColorDepth;
  seasonalType: SeasonalColorType;
  description: string;
}

export interface PersonalColorProfile {
  id: string;
  userId: string;
  seasonalType: SeasonalColorType;
  dominantColors: ColorData[];
  accentColors: ColorData[];
  neutralColors: ColorData[];
  avoidColors: ColorData[];
  skinTone: RGB;
  hairColor: RGB;
  eyeColor: RGB;
  contrastLevel: number;
  createdAt: number;
  updatedAt: number;
}

export interface ColorAnalysisResult {
  seasonalType: SeasonalColorType;
  confidence: number;
  primarySeason: SeasonalColorType;
  secondarySeason: SeasonalColorType;
  temperature: ColorTemperature;
  saturation: ColorSaturation;
  depth: ColorDepth;
  colorHarmonyScore: number;
  recommendations: string[];
}

export interface ColorMatchResult {
  color1: ColorData;
  color2: ColorData;
  harmonyScore: number;
  contrastLevel: number;
  balanceScore: number;
  isRecommended: boolean;
  reason: string;
}

export interface ColorBalanceAnalysis {
  overallHarmony: number;
  contrastLevel: number;
  temperatureBalance: number;
  saturationBalance: number;
  dominantColorRatio: number;
  recommendations: string[];
}
