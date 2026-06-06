export type MaterialCategory = 'cotton' | 'silk' | 'wool' | 'linen' | 'denim' | 'leather' | 'satin' | 'chiffon' | 'knit' | 'polyester';

export type MaterialTexture = 'smooth' | 'rough' | 'soft' | 'crisp' | 'shiny' | 'matte' | 'structured' | 'flowy';

export type MaterialWeight = 'light' | 'medium' | 'heavy';
export type MaterialBreathability = 'high' | 'medium' | 'low';
export type MaterialDrape = 'fluid' | 'moderate' | 'structured';

export interface MaterialProperty {
  texture: MaterialTexture;
  weight: MaterialWeight;
  breathability: MaterialBreathability;
  drape: MaterialDrape;
  stretch: number;
  thickness: number;
  shine: number;
}

export interface MaterialData {
  id: string;
  name: string;
  category: MaterialCategory;
  properties: MaterialProperty;
  seasonality: ('spring' | 'summer' | 'autumn' | 'winter')[];
  occasions: string[];
  careInstructions: string;
  description: string;
  complementaryMaterials: MaterialCategory[];
  conflictingMaterials: MaterialCategory[];
}

export interface MaterialMatchResult {
  material1: MaterialData;
  material2: MaterialData;
  compatibilityScore: number;
  textureBalance: number;
  weightBalance: number;
  seasonalityMatch: boolean;
  isRecommended: boolean;
  reason: string;
}
