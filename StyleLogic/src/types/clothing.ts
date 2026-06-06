import type { ColorData, MaterialData } from './';

export type ClothingCategory = 'top' | 'bottom' | 'outerwear' | 'dress' | 'shoes' | 'accessory';
export type ClothingStyle = 'casual' | 'formal' | 'business' | 'sporty' | 'elegant' | 'bohemian' | 'minimalist' | 'streetwear';
export type ClothingSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  style: ClothingStyle;
  color: ColorData;
  material: MaterialData;
  size: ClothingSize;
  brand: string;
  imageUrl: string;
  description: string;
  seasonality: ('spring' | 'summer' | 'autumn' | 'winter')[];
  occasions: string[];
  price?: number;
  isOwned: boolean;
  purchasedAt?: number;
  addedToWardrobeAt: number;
  lastWornAt?: number;
  wearCount: number;
  tags: string[];
}

export interface OutfitItem {
  slot: 'top' | 'bottom' | 'outerwear' | 'dress' | 'shoes' | 'accessory';
  clothingItem: ClothingItem;
}

export interface OutfitCombination {
  id: string;
  name: string;
  items: OutfitItem[];
  overallColorScore: number;
  overallMaterialScore: number;
  overallStyleScore: number;
  totalScore: number;
  occasion: string;
  season: string;
  createdAt: number;
}

export interface OutfitPreset {
  id: string;
  name: string;
  description?: string;
  outfit: OutfitCombination;
  personalColorProfileId: string;
  savedAt: number;
  tags: string[];
  isFavorite: boolean;
  syncStatus: 'synced' | 'pending' | 'offline';
}

export interface OutfitScore {
  colorScore: number;
  materialScore: number;
  styleScore: number;
  seasonScore: number;
  occasionScore: number;
  totalScore: number;
}

export interface WardrobeSnapshot {
  id: string;
  timestamp: number;
  items: ClothingItem[];
  presets: OutfitPreset[];
  version: number;
  checksum: string;
}
