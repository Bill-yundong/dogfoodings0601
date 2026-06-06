import { create } from 'zustand';
import type {
  ClothingItem,
  OutfitCombination,
  PersonalColorProfile,
  ColorBalanceAnalysis,
  OutfitScore,
} from '../types';
import {
  evaluateOutfit,
  generateOutfitRecommendations,
  analyzeColorBalance,
} from '../services/recommendationModel';

interface FittingState {
  selectedItems: Map<string, ClothingItem>;
  currentOutfit: OutfitCombination | null;
  outfitScore: OutfitScore | null;
  colorAnalysis: ColorBalanceAnalysis | null;
  recommendations: OutfitCombination[];
  isAnalyzing: boolean;
  isGenerating: boolean;
  error: string | null;
  selectedOccasion: string;
  selectedSeason: string;
  setItem: (slot: string, item: ClothingItem | null) => void;
  removeItem: (slot: string) => void;
  clearOutfit: () => void;
  analyzeCurrentOutfit: (profile: PersonalColorProfile) => Promise<void>;
  generateRecommendations: (
    wardrobe: ClothingItem[],
    profile: PersonalColorProfile,
    occasion?: string,
    season?: string,
    count?: number,
  ) => Promise<void>;
  applyOutfit: (outfit: OutfitCombination) => void;
  setOccasion: (occasion: string) => void;
  setSeason: (season: string) => void;
  getSelectedItemsList: () => ClothingItem[];
}

const SLOT_ORDER = ['top', 'bottom', 'outerwear', 'dress', 'shoes', 'accessory'];

export const useFittingStore = create<FittingState>((set, get) => ({
  selectedItems: new Map(),
  currentOutfit: null,
  outfitScore: null,
  colorAnalysis: null,
  recommendations: [],
  isAnalyzing: false,
  isGenerating: false,
  error: null,
  selectedOccasion: 'daily',
  selectedSeason: 'spring',

  setItem: (slot, item) => {
    set((state) => {
      const newItems = new Map(state.selectedItems);
      if (item) {
        newItems.set(slot, item);
        if (slot === 'dress') {
          newItems.delete('top');
          newItems.delete('bottom');
        } else if (slot === 'top' || slot === 'bottom') {
          newItems.delete('dress');
        }
      }
      return { selectedItems: newItems };
    });
  },

  removeItem: (slot) => {
    set((state) => {
      const newItems = new Map(state.selectedItems);
      newItems.delete(slot);
      return { selectedItems: newItems };
    });
  },

  clearOutfit: () => {
    set({
      selectedItems: new Map(),
      currentOutfit: null,
      outfitScore: null,
      colorAnalysis: null,
    });
  },

  analyzeCurrentOutfit: async (profile) => {
    const items = get().getSelectedItemsList();
    if (items.length === 0) {
      set({ outfitScore: null, colorAnalysis: null });
      return;
    }

    set({ isAnalyzing: true, error: null });
    try {
      const { selectedOccasion, selectedSeason } = get();
      const result = await evaluateOutfit(
        items,
        profile,
        selectedOccasion,
        selectedSeason,
      );

      const colorResult = await analyzeColorBalance(
        items.map((i) => i.color),
        profile,
      );

      const outfit: OutfitCombination = {
        id: `outfit_${Date.now()}`,
        name: '当前穿搭',
        items: items.map((item) => ({
          slot: item.category as OutfitCombination['items'][0]['slot'],
          clothingItem: item,
        })),
        overallColorScore: result.colorScore,
        overallMaterialScore: result.materialScore,
        overallStyleScore: result.styleScore,
        totalScore: result.totalScore,
        occasion: selectedOccasion,
        season: selectedSeason,
        createdAt: Date.now(),
      };

      set({
        outfitScore: {
          colorScore: result.colorScore,
          materialScore: result.materialScore,
          styleScore: result.styleScore,
          seasonScore: result.seasonScore,
          occasionScore: result.occasionScore,
          totalScore: result.totalScore,
        },
        colorAnalysis: colorResult,
        currentOutfit: outfit,
        isAnalyzing: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isAnalyzing: false });
    }
  },

  generateRecommendations: async (
    wardrobe,
    profile,
    occasion,
    season,
    count = 5,
  ) => {
    set({ isGenerating: true, error: null });
    try {
      const occ = occasion || get().selectedOccasion;
      const sea = season || get().selectedSeason;
      const recommendations = await generateOutfitRecommendations(
        wardrobe,
        profile,
        occ,
        sea,
        count,
      );
      set({
        recommendations,
        selectedOccasion: occ,
        selectedSeason: sea,
        isGenerating: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isGenerating: false });
    }
  },

  applyOutfit: (outfit) => {
    const newItems = new Map<string, ClothingItem>();
    outfit.items.forEach((item) => {
      newItems.set(item.slot, item.clothingItem);
    });
    set({
      selectedItems: newItems,
      currentOutfit: outfit,
      selectedOccasion: outfit.occasion,
      selectedSeason: outfit.season,
    });
  },

  setOccasion: (occasion) => {
    set({ selectedOccasion: occasion });
  },

  setSeason: (season) => {
    set({ selectedSeason: season });
  },

  getSelectedItemsList: () => {
    const { selectedItems } = get();
    return SLOT_ORDER.map((slot) => selectedItems.get(slot)).filter(
      (item): item is ClothingItem => item !== undefined,
    );
  },
}));
