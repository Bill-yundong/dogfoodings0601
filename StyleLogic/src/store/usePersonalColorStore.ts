import { create } from 'zustand';
import type { PersonalColorProfile, RGB, ColorAnalysisResult, ColorData } from '../types';
import {
  createPersonalColorProfile,
  analyzePersonalColors,
  getRecommendedColors,
  checkColorCompatibility,
} from '../services/colorAnalysis';
import { personalProfileStore } from '../services/indexedDB';

interface PersonalColorState {
  profile: PersonalColorProfile | null;
  analysisResult: ColorAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  analyzeColors: (skinTone: RGB, hairColor: RGB, eyeColor: RGB) => Promise<void>;
  createProfile: (userId: string, skinTone: RGB, hairColor: RGB, eyeColor: RGB) => Promise<void>;
  loadProfile: () => Promise<void>;
  clearProfile: () => void;
  getRecommendedColors: (count?: number) => Promise<ColorData[]>;
  checkCompatibility: (color: ColorData) => Promise<{
    score: number;
    isRecommended: boolean;
    reason: string;
  }>;
}

export const usePersonalColorStore = create<PersonalColorState>((set, get) => ({
  profile: null,
  analysisResult: null,
  isLoading: false,
  error: null,

  analyzeColors: async (skinTone, hairColor, eyeColor) => {
    set({ isLoading: true, error: null });
    try {
      const result = await analyzePersonalColors(skinTone, hairColor, eyeColor);
      set({ analysisResult: result, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createProfile: async (userId, skinTone, hairColor, eyeColor) => {
    set({ isLoading: true, error: null });
    try {
      const profile = await createPersonalColorProfile(userId, skinTone, hairColor, eyeColor);
      await personalProfileStore.save(profile);
      set({ profile, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const profile = await personalProfileStore.get();
      set({ profile: profile || null, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  clearProfile: () => {
    set({ profile: null, analysisResult: null });
    personalProfileStore.clear();
  },

  getRecommendedColors: async (count = 10) => {
    const profile = get().profile;
    if (!profile) return [];
    return getRecommendedColors(profile, count);
  },

  checkCompatibility: async (color) => {
    const profile = get().profile;
    if (!profile) {
      return { score: 50, isRecommended: true, reason: '请先完成个人色彩分析' };
    }
    return checkColorCompatibility(color, profile);
  },
}));
