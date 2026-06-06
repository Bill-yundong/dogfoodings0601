import type {
  ClothingItem,
  OutfitCombination,
  PersonalColorProfile,
  ColorData,
  MaterialData,
  RecommendationResult,
  OutfitScore,
  ColorBalanceAnalysis,
} from '../types';
import { calculateColorContrast, calculateColorDistance } from '../utils/colorUtils';
import { checkColorCompatibility } from './colorAnalysis';
import { checkMaterialCompatibility, evaluateOutfitMaterials } from './materialAnalysis';

export const analyzeColorBalance = async (
  colors: ColorData[],
  profile: PersonalColorProfile,
): Promise<ColorBalanceAnalysis> => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      if (colors.length === 0) {
        resolve({
          overallHarmony: 0,
          contrastLevel: 0,
          temperatureBalance: 0,
          saturationBalance: 0,
          dominantColorRatio: 0,
          recommendations: ['请选择服饰以进行色彩分析'],
        });
        return;
      }

      const personalColorChecks = await Promise.all(
        colors.map((color) => checkColorCompatibility(color, profile)),
      );

      const personalColorScores = personalColorChecks.map((c) => c.score);
      const personalColorAvg =
        personalColorScores.reduce((a, b) => a + b, 0) / personalColorScores.length;

      const contrastLevels: number[] = [];
      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          const contrast = calculateColorContrast(colors[i].rgb, colors[j].rgb);
          contrastLevels.push(contrast);
        }
      }

      const avgContrast =
        contrastLevels.length > 0
          ? contrastLevels.reduce((a, b) => a + b, 0) / contrastLevels.length
          : 0;

      const idealContrast = profile.contrastLevel > 0.5 ? 4.5 : 2.5;
      const contrastScore = Math.max(0, 100 - Math.abs(avgContrast - idealContrast) * 20);

      const warmCount = colors.filter((c) => c.temperature === 'warm').length;
      const coolCount = colors.filter((c) => c.temperature === 'cool').length;
      const tempBalance =
        colors.length > 0
          ? 100 - (Math.abs(warmCount - coolCount) / colors.length) * 100
          : 100;

      const brightCount = colors.filter((c) => c.saturation === 'bright').length;
      const softCount = colors.filter((c) => c.saturation === 'soft').length;
      const satBalance =
        colors.length > 0
          ? 100 - (Math.abs(brightCount - softCount) / colors.length) * 100
          : 100;

      const colorDistances: number[] = [];
      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          const distance = calculateColorDistance(colors[i].rgb, colors[j].rgb);
          colorDistances.push(distance);
        }
      }

      const colorHarmony =
        colorDistances.length > 0
          ? Math.max(
              0,
              100 -
                colorDistances.reduce((a, b) => a + b, 0) / colorDistances.length / 5,
            )
          : 100;

      const overallHarmony =
        personalColorAvg * 0.4 +
        colorHarmony * 0.3 +
        contrastScore * 0.15 +
        tempBalance * 0.075 +
        satBalance * 0.075;

      const recommendations: string[] = [];

      if (personalColorAvg < 70) {
        const badColors = personalColorChecks
          .filter((_c, i) => personalColorChecks[i].score < 60)
          .map((_c, i) => colors[i].name);
        recommendations.push(
          `以下颜色与您的个人色彩匹配度较低：${badColors.join('、')}`,
        );
      }

      if (avgContrast < 2 && profile.contrastLevel > 0.5) {
        recommendations.push('您的对比度较高，建议增加服饰色彩对比');
      } else if (avgContrast > 6 && profile.contrastLevel < 0.5) {
        recommendations.push('您的对比度较低，建议降低服饰色彩对比');
      }

      if (warmCount > coolCount + 2 && profile.seasonalType === 'summer') {
        recommendations.push('夏季型建议减少暖色调，增加冷色调比例');
      } else if (coolCount > warmCount + 2 && profile.seasonalType === 'autumn') {
        recommendations.push('秋季型建议减少冷色调，增加暖色调比例');
      }

      if (colors.length >= 3) {
        recommendations.push('整体色彩搭配和谐，建议尝试不同的色彩组合');
      }

      resolve({
        overallHarmony: Math.round(overallHarmony),
        contrastLevel: Math.round(avgContrast * 10) / 10,
        temperatureBalance: Math.round(tempBalance),
        saturationBalance: Math.round(satBalance),
        dominantColorRatio: Math.round(
          (Math.max(warmCount, coolCount) / Math.max(1, colors.length)) * 100,
        ),
        recommendations,
      });
    }, 600);
  });
};

export const evaluateOutfit = async (
  outfit: ClothingItem[],
  profile: PersonalColorProfile,
  occasion?: string,
  season?: string,
): Promise<OutfitScore & { colorAnalysis: ColorBalanceAnalysis }> => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const colors = outfit.map((item) => item.color);
      const materials = outfit.map((item) => item.material);

      const colorAnalysis = await analyzeColorBalance(colors, profile);

      const materialAnalysis = await evaluateOutfitMaterials(materials);

      let styleScore = 100;
      const styles = outfit.map((item) => item.style);
      const uniqueStyles = [...new Set(styles)];
      if (uniqueStyles.length > 2) {
        styleScore -= (uniqueStyles.length - 2) * 15;
      }

      let seasonScore = 100;
      if (season) {
        const mismatchedItems = outfit.filter(
          (item) => !item.seasonality.includes(season as 'spring' | 'summer' | 'autumn' | 'winter'),
        );
        seasonScore -= mismatchedItems.length * 20;
      }

      let occasionScore = 100;
      if (occasion) {
        const mismatchedItems = outfit.filter(
          (item) => !item.occasions.includes(occasion),
        );
        occasionScore -= mismatchedItems.length * 15;
      }

      const colorScore = colorAnalysis.overallHarmony;
      const materialScore = materialAnalysis.overallScore;

      const totalScore = Math.round(
        colorScore * 0.35 +
          materialScore * 0.3 +
          styleScore * 0.15 +
          seasonScore * 0.1 +
          occasionScore * 0.1,
      );

      resolve({
        colorScore,
        materialScore,
        styleScore: Math.max(0, styleScore),
        seasonScore: Math.max(0, seasonScore),
        occasionScore: Math.max(0, occasionScore),
        totalScore: Math.max(0, Math.min(100, totalScore)),
        colorAnalysis,
      });
    }, 800);
  });
};

export const generateOutfitRecommendations = async (
  wardrobe: ClothingItem[],
  profile: PersonalColorProfile,
  occasion: string = 'daily',
  season: string = 'spring',
  count: number = 5,
): Promise<OutfitCombination[]> => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const tops = wardrobe.filter((item) => item.category === 'top');
      const bottoms = wardrobe.filter((item) => item.category === 'bottom');
      const outerwears = wardrobe.filter((item) => item.category === 'outerwear');
      const dresses = wardrobe.filter((item) => item.category === 'dress');
      const shoes = wardrobe.filter((item) => item.category === 'shoes');
      const accessories = wardrobe.filter((item) => item.category === 'accessory');



      const createOutfit = async (items: ClothingItem[], name: string): Promise<OutfitCombination | null> => {
        const score = await evaluateOutfit(items, profile, occasion, season);
        if (score.totalScore < 50) return null;

        return {
          id: `outfit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name,
          items: items.map((item) => ({
            slot: item.category as OutfitCombination['items'][0]['slot'],
            clothingItem: item,
          })),
          overallColorScore: score.colorScore,
          overallMaterialScore: score.materialScore,
          overallStyleScore: score.styleScore,
          totalScore: score.totalScore,
          occasion,
          season,
          createdAt: Date.now(),
        };
      };

      const promises: Promise<OutfitCombination | null>[] = [];

      for (const top of tops.slice(0, 10)) {
        for (const bottom of bottoms.slice(0, 10)) {
          for (const shoe of shoes.slice(0, 5)) {
            const items = [top, bottom, shoe];
            if (outerwears.length > 0) {
              items.push(outerwears[Math.floor(Math.random() * outerwears.length)]);
            }
            if (accessories.length > 0) {
              items.push(accessories[Math.floor(Math.random() * accessories.length)]);
            }
            promises.push(
              createOutfit(
                items,
                `${top.name} + ${bottom.name}`,
              ),
            );
          }
        }
      }

      for (const dress of dresses.slice(0, 10)) {
        for (const shoe of shoes.slice(0, 5)) {
          const items = [dress, shoe];
          if (outerwears.length > 0) {
            items.push(outerwears[Math.floor(Math.random() * outerwears.length)]);
          }
          if (accessories.length > 0) {
            items.push(accessories[Math.floor(Math.random() * accessories.length)]);
          }
          promises.push(
            createOutfit(
              items,
              dress.name,
            ),
          );
        }
      }

      const results = await Promise.all(promises);
      const validOutfits = results.filter(
        (o): o is OutfitCombination => o !== null,
      );

      validOutfits.sort((a, b) => b.totalScore - a.totalScore);

      resolve(validOutfits.slice(0, count));
    }, 1500);
  });
};

export const matchProductToWardrobe = async (
  product: { colors: ColorData[]; materials: MaterialData[]; style: string },
  wardrobe: ClothingItem[],
  profile: PersonalColorProfile,
): Promise<RecommendationResult> => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const colorChecks = await Promise.all(
        product.colors.map((color) => checkColorCompatibility(color, profile)),
      );
      const colorMatchScore = Math.max(...colorChecks.map((c) => c.score));

      const materialChecks = await Promise.all(
        product.materials.map(async (material) => {
          const scores = await Promise.all(
            wardrobe.map((item) =>
              checkMaterialCompatibility(material, item.material),
            ),
          );
          return scores.length > 0
            ? scores.reduce((a, b) => a + b.compatibilityScore, 0) / scores.length
            : 70;
        }),
      );
      const materialMatchScore = Math.max(...materialChecks);

      const styleMatchScore =
        wardrobe.filter((item) => item.style === product.style).length > 0
          ? 85
          : 65;

      const matchScore = Math.round(
        colorMatchScore * 0.4 + materialMatchScore * 0.35 + styleMatchScore * 0.25,
      );

      const matchingItems = wardrobe
        .filter((item) => {
          const colorMatch = product.colors.some((c) => {
            const dist = calculateColorDistance(c.rgb, item.color.rgb);
            return dist < 100;
          });
          return colorMatch || item.style === product.style;
        })
        .slice(0, 3)
        .map((item) => item.id);

      let reason = '';
      if (matchScore >= 80) {
        reason = '完美匹配！这件商品非常适合您的个人色彩和衣橱风格';
      } else if (matchScore >= 60) {
        reason = '较为适合，可以与您衣橱中的多款单品搭配';
      } else {
        reason = '一般匹配，建议搭配您衣橱中已有的相似风格单品';
      }

      resolve({
        product: product as unknown as RecommendationResult['product'],
        matchScore,
        colorMatchScore,
        materialMatchScore,
        styleMatchScore,
        reason,
        matchingItems,
      });
    }, 600);
  });
};
