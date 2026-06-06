import type {
  RGB,
  ColorAnalysisResult,
  PersonalColorProfile,
  ColorData,
  SeasonalColorType,
  ColorTemperature,
  ColorSaturation,
  ColorDepth,
} from '../types';
import {
  calculateColorTemperature,
  calculateColorDistance,
} from '../utils/colorUtils';
import { springColors, summerColors, autumnColors, winterColors, neutralColors } from '../data/colorDatabase';

const SEASONAL_PROFILES: Record<
  SeasonalColorType,
  { temp: ColorTemperature; sat: ColorSaturation; depth: ColorDepth }
> = {
  spring: { temp: 'warm', sat: 'bright', depth: 'light' },
  summer: { temp: 'cool', sat: 'soft', depth: 'light' },
  autumn: { temp: 'warm', sat: 'muted', depth: 'deep' },
  winter: { temp: 'cool', sat: 'bright', depth: 'deep' },
};

export const analyzePersonalColors = async (
  skinTone: RGB,
  hairColor: RGB,
  eyeColor: RGB,
): Promise<ColorAnalysisResult> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const skinTemp = calculateColorTemperature(skinTone);
      const hairTemp = calculateColorTemperature(hairColor);
      const eyeTemp = calculateColorTemperature(eyeColor);

      const warmVotes = [skinTemp, hairTemp, eyeTemp].filter((t) => t === 'warm').length;
      const coolVotes = [skinTemp, hairTemp, eyeTemp].filter((t) => t === 'cool').length;
      const temperature: ColorTemperature = warmVotes > coolVotes ? 'warm' : coolVotes > warmVotes ? 'cool' : 'neutral';

      const skinHsl = (() => {
        const r = skinTone.r / 255, g = skinTone.g / 255, b = skinTone.b / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
      })();

      const hairHsl = (() => {
        const r = hairColor.r / 255, g = hairColor.g / 255, b = hairColor.b / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
      })();

      const saturation: ColorSaturation =
        skinHsl.s + hairHsl.s > 100 ? 'bright' : skinHsl.s + hairHsl.s > 60 ? 'muted' : 'soft';

      const depth: ColorDepth =
        (skinHsl.l + hairHsl.l) / 2 < 50 ? 'deep' : 'light';

      const scores: Record<SeasonalColorType, number> = {
        spring: 0,
        summer: 0,
        autumn: 0,
        winter: 0,
      };

      Object.entries(SEASONAL_PROFILES).forEach(([season, profile]) => {
        let score = 0;
        if (profile.temp === temperature || temperature === 'neutral') score += 30;
        if (profile.sat === saturation) score += 35;
        if (profile.depth === depth) score += 35;
        scores[season as SeasonalColorType] = score;
      });

      const sortedSeasons = (Object.entries(scores) as [SeasonalColorType, number][])
        .sort((a, b) => b[1] - a[1]);

      const primarySeason = sortedSeasons[0][0];
      const secondarySeason = sortedSeasons[1][0];
      const confidence = sortedSeasons[0][1] / 100;

      const contrastLevel = Math.abs(skinHsl.l - hairHsl.l) / 100;

      const recommendations = generateRecommendations(primarySeason, contrastLevel);

      resolve({
        seasonalType: primarySeason,
        confidence,
        primarySeason,
        secondarySeason,
        temperature,
        saturation,
        depth,
        colorHarmonyScore: confidence * 0.8 + contrastLevel * 0.2,
        recommendations,
      });
    }, 800);
  });
};

const generateRecommendations = (
  seasonalType: SeasonalColorType,
  contrastLevel: number,
): string[] => {
  const recs: string[] = [];

  switch (seasonalType) {
    case 'spring':
      recs.push('选择明亮温暖的色彩，如珊瑚色、杏黄色、嫩绿色');
      recs.push('避免冷调深色，如藏蓝、深紫');
      break;
    case 'summer':
      recs.push('选择柔和冷调的色彩，如薰衣草紫、灰蓝色、玫瑰粉');
      recs.push('避免过于鲜艳饱和的色彩');
      break;
    case 'autumn':
      recs.push('选择浓郁温暖的色彩，如焦糖棕、枫叶红、芥末黄');
      recs.push('避免冷调明亮的色彩');
      break;
    case 'winter':
      recs.push('选择纯正冷调的色彩，如正红色、皇家蓝、翠绿色');
      recs.push('避免浑浊柔和的中间色');
      break;
  }

  if (contrastLevel > 0.6) {
    recs.push('您适合高对比度穿搭，可以大胆尝试强烈的色彩碰撞');
  } else if (contrastLevel > 0.3) {
    recs.push('您适合中等对比度穿搭，色彩搭配保持适度对比');
  } else {
    recs.push('您适合低对比度穿搭，选择同色系或相近色搭配更和谐');
  }

  return recs;
};

export const createPersonalColorProfile = async (
  userId: string,
  skinTone: RGB,
  hairColor: RGB,
  eyeColor: RGB,
): Promise<PersonalColorProfile> => {
  const analysis = await analyzePersonalColors(skinTone, hairColor, eyeColor);

  const seasonColors: Record<SeasonalColorType, ColorData[]> = {
    spring: springColors,
    summer: summerColors,
    autumn: autumnColors,
    winter: winterColors,
  };

  const dominantColors = seasonColors[analysis.primarySeason].slice(0, 5);
  const accentColors = seasonColors[analysis.secondarySeason].slice(0, 3);

  const avoidColors = Object.entries(seasonColors)
    .filter(([season]) => season !== analysis.primarySeason && season !== analysis.secondarySeason)
    .flatMap(([, colors]) => colors)
    .slice(0, 5);

  return {
    id: `profile_${Date.now()}`,
    userId,
    seasonalType: analysis.primarySeason,
    dominantColors,
    accentColors,
    neutralColors,
    avoidColors,
    skinTone,
    hairColor,
    eyeColor,
    contrastLevel: Math.abs(
      (() => {
        const r = skinTone.r / 255, g = skinTone.g / 255, b = skinTone.b / 255;
        return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 * 100;
      })() -
      (() => {
        const r = hairColor.r / 255, g = hairColor.g / 255, b = hairColor.b / 255;
        return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 * 100;
      })()
    ) / 100,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export const getRecommendedColors = async (
  profile: PersonalColorProfile,
  count: number = 10,
): Promise<ColorData[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const recommended: ColorData[] = [...profile.dominantColors];

      for (const color of profile.accentColors) {
        if (!recommended.find((c) => c.id === color.id)) {
          recommended.push(color);
        }
      }

      for (const color of profile.neutralColors) {
        if (!recommended.find((c) => c.id === color.id) && recommended.length < count) {
          recommended.push(color);
        }
      }

      resolve(recommended.slice(0, count));
    }, 300);
  });
};

export const checkColorCompatibility = async (
  color: ColorData,
  profile: PersonalColorProfile,
): Promise<{ score: number; isRecommended: boolean; reason: string }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (profile.avoidColors.some((c) => c.id === color.id)) {
        resolve({
          score: 20,
          isRecommended: false,
          reason: '该颜色属于您的避用色范围，可能会显得气色不佳',
        });
        return;
      }

      const dominantMatch = profile.dominantColors.some((c) => c.id === color.id);
      const accentMatch = profile.accentColors.some((c) => c.id === color.id);
      const neutralMatch = profile.neutralColors.some((c) => c.id === color.id);

      let score: number;
      let reason: string;

      if (dominantMatch) {
        score = 95;
        reason = '完美匹配！这是您的主色，能够最大程度衬托您的气色';
      } else if (accentMatch) {
        score = 85;
        reason = '非常适合！这是您的辅助色，可以作为点缀色使用';
      } else if (neutralMatch) {
        score = 80;
        reason = '适合您！这是百搭的中性色，可以作为基础色使用';
      } else {
        const closestDominant = profile.dominantColors.reduce((prev, curr) => {
          const prevDist = calculateColorDistance(color.rgb, prev.rgb);
          const currDist = calculateColorDistance(color.rgb, curr.rgb);
          return currDist < prevDist ? curr : prev;
        });

        const distance = calculateColorDistance(color.rgb, closestDominant.rgb);
        score = Math.max(40, 100 - distance * 0.5);
        reason = score >= 70 ? '比较适合，与您的主色系相近' : '一般，建议与您的主色搭配使用';
      }

      if (color.seasonalType === profile.seasonalType) {
        score = Math.min(100, score + 5);
      }

      resolve({
        score: Math.round(score),
        isRecommended: score >= 60,
        reason,
      });
    }, 200);
  });
};
