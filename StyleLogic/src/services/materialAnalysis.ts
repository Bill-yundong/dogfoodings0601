import type { MaterialData, MaterialMatchResult } from '../types';

const textureScores: Record<MaterialData['properties']['texture'], number> = {
  smooth: 10,
  soft: 8,
  crisp: 7,
  rough: 4,
  shiny: 9,
  matte: 5,
  structured: 6,
  flowy: 8,
};

const weightScores: Record<MaterialData['properties']['weight'], number> = {
  light: 3,
  medium: 6,
  heavy: 9,
};



export const calculateTextureBalance = (
  material1: MaterialData,
  material2: MaterialData,
): number => {
  const score1 = textureScores[material1.properties.texture];
  const score2 = textureScores[material2.properties.texture];
  const diff = Math.abs(score1 - score2);
  if (diff <= 1) return 100;
  if (diff <= 3) return 80;
  if (diff <= 5) return 60;
  return 40;
};

export const calculateWeightBalance = (
  material1: MaterialData,
  material2: MaterialData,
): number => {
  const score1 = weightScores[material1.properties.weight];
  const score2 = weightScores[material2.properties.weight];
  const diff = Math.abs(score1 - score2);
  if (diff <= 1) return 100;
  if (diff <= 3) return 70;
  return 40;
};

export const checkSeasonalityMatch = (
  material1: MaterialData,
  material2: MaterialData,
): boolean => {
  return material1.seasonality.some((s) => material2.seasonality.includes(s));
};

export const checkMaterialCompatibility = async (
  material1: MaterialData,
  material2: MaterialData,
): Promise<MaterialMatchResult> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const textureBalance = calculateTextureBalance(material1, material2);
      const weightBalance = calculateWeightBalance(material1, material2);
      const seasonalityMatch = checkSeasonalityMatch(material1, material2);

      const isDirectComplementary = material1.complementaryMaterials.includes(
        material2.category,
      );
      const isConflicting = material1.conflictingMaterials.includes(
        material2.category,
      );

      let compatibilityScore = (textureBalance * 0.4 + weightBalance * 0.3) / 0.7;

      if (seasonalityMatch) {
        compatibilityScore += 10;
      } else {
        compatibilityScore -= 20;
      }

      if (isDirectComplementary) {
        compatibilityScore += 15;
      }

      if (isConflicting) {
        compatibilityScore -= 30;
      }

      compatibilityScore = Math.max(0, Math.min(100, compatibilityScore));

      let reason = '';
      if (isConflicting) {
        reason = `${material1.name}与${material2.name}材质风格冲突，不建议搭配`;
      } else if (isDirectComplementary) {
        reason = `${material1.name}与${material2.name}是经典互补材质，搭配效果极佳`;
      } else if (seasonalityMatch && compatibilityScore >= 70) {
        reason = `${material1.name}与${material2.name}质感平衡，季节适配，搭配和谐`;
      } else if (!seasonalityMatch) {
        reason = `${material1.name}与${material2.name}季节适应性不同，需要注意场合选择`;
      } else if (textureBalance < 60) {
        reason = `${material1.name}与${material2.name}质感差异较大，可能产生视觉冲突`;
      } else {
        reason = `${material1.name}与${material2.name}可以搭配，建议根据具体场合调整`;
      }

      resolve({
        material1,
        material2,
        compatibilityScore: Math.round(compatibilityScore),
        textureBalance,
        weightBalance,
        seasonalityMatch,
        isRecommended: compatibilityScore >= 60,
        reason,
      });
    }, 300);
  });
};

export const getMaterialRecommendations = async (
  baseMaterial: MaterialData,
  candidates: MaterialData[],
  season?: string,
): Promise<(MaterialMatchResult & { material: MaterialData })[]> => {
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const match = await checkMaterialCompatibility(baseMaterial, candidate);
      return { ...match, material: candidate };
    }),
  );

  let filtered = results.filter((r) => r.material.id !== baseMaterial.id);

  if (season) {
    filtered = filtered.filter((r) =>
      r.material.seasonality.includes(season as 'spring' | 'summer' | 'autumn' | 'winter'),
    );
  }

  return filtered.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
};

export const evaluateOutfitMaterials = async (
  materials: MaterialData[],
): Promise<{
  overallScore: number;
  pairScores: Array<{ pair: [MaterialData, MaterialData]; score: number }>;
  recommendations: string[];
}> => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const pairScores: Array<{ pair: [MaterialData, MaterialData]; score: number }> = [];

      for (let i = 0; i < materials.length; i++) {
        for (let j = i + 1; j < materials.length; j++) {
          const match = await checkMaterialCompatibility(
            materials[i],
            materials[j],
          );
          pairScores.push({
            pair: [materials[i], materials[j]],
            score: match.compatibilityScore,
          });
        }
      }

      const overallScore =
        pairScores.length > 0
          ? Math.round(
              pairScores.reduce((sum, p) => sum + p.score, 0) / pairScores.length,
            )
          : 100;

      const recommendations: string[] = [];

      const lowScorePairs = pairScores.filter((p) => p.score < 60);
      if (lowScorePairs.length > 0) {
        lowScorePairs.forEach((p) => {
          recommendations.push(
            `建议替换${p.pair[0].name}或${p.pair[1].name}，材质搭配分数较低(${p.score})`,
          );
        });
      }

      const highScorePairs = pairScores.filter((p) => p.score >= 80);
      if (highScorePairs.length > 0 && highScorePairs.length === pairScores.length) {
        recommendations.push('整体材质搭配非常和谐，质感层次分明');
      }

      const seasonConflicts = materials.filter((m) => {
        const mainSeason = materials[0]?.seasonality[0];
        return mainSeason && !m.seasonality.includes(mainSeason);
      });

      if (seasonConflicts.length > 0) {
        recommendations.push(
          `注意季节适应性：${seasonConflicts.map((m) => m.name).join('、')}的季节属性与主单品不同`,
        );
      }

      resolve({
        overallScore,
        pairScores,
        recommendations,
      });
    }, 500);
  });
};
