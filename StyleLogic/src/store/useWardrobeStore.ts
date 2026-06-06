import { create } from 'zustand';
import type { ClothingItem, OutfitPreset, WardrobeSnapshot, OutfitCombination } from '../types';
import { wardrobeStore, outfitPresetStore, snapshotStore, initDB } from '../services/indexedDB';
import { mockWardrobe } from '../data/mockData';

interface WardrobeState {
  items: ClothingItem[];
  presets: OutfitPreset[];
  snapshots: WardrobeSnapshot[];
  isLoading: boolean;
  error: string | null;
  currentOutfit: ClothingItem[];
  selectedItem: ClothingItem | null;
  initMockData: () => Promise<void>;
  loadItems: () => Promise<void>;
  loadPresets: () => Promise<void>;
  loadSnapshots: () => Promise<void>;
  addItem: (item: ClothingItem) => Promise<void>;
  updateItem: (item: ClothingItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  savePreset: (name: string, outfit: OutfitCombination, description?: string) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  createSnapshot: () => Promise<void>;
  restoreSnapshot: (snapshot: WardrobeSnapshot) => Promise<void>;
  setCurrentOutfit: (items: ClothingItem[]) => void;
  addToCurrentOutfit: (item: ClothingItem) => void;
  removeFromCurrentOutfit: (itemId: string) => void;
  clearCurrentOutfit: () => void;
  setSelectedItem: (item: ClothingItem | null) => void;
  filterItems: (filters: Partial<ClothingItem>) => ClothingItem[];
  getItemsByCategory: (category: ClothingItem['category']) => ClothingItem[];
}

export const useWardrobeStore = create<WardrobeState>((set, get) => ({
  items: [],
  presets: [],
  snapshots: [],
  isLoading: false,
  error: null,
  currentOutfit: [],
  selectedItem: null,

  initMockData: async () => {
    set({ isLoading: true, error: null });
    try {
      await initDB();
      const existing = await wardrobeStore.getAll();
      if (existing.length === 0) {
        await wardrobeStore.bulkAdd(mockWardrobe);
        set({ items: mockWardrobe });
      } else {
        set({ items: existing });
      }
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const items = await wardrobeStore.getAll();
      set({ items, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadPresets: async () => {
    set({ isLoading: true, error: null });
    try {
      const presets = await outfitPresetStore.getAll();
      set({ presets, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadSnapshots: async () => {
    set({ isLoading: true, error: null });
    try {
      const snapshots = await snapshotStore.getAll();
      set({ snapshots, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addItem: async (item) => {
    try {
      await wardrobeStore.add(item);
      set((state) => ({ items: [...state.items, item] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateItem: async (item) => {
    try {
      await wardrobeStore.update(item);
      set((state) => ({
        items: state.items.map((i) => (i.id === item.id ? item : i)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  removeItem: async (id) => {
    try {
      await wardrobeStore.remove(id);
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  savePreset: async (name, outfit, description) => {
    try {
      const profileId = 'default_profile';
      const preset: OutfitPreset = {
        id: `preset_${Date.now()}`,
        name,
        description,
        outfit,
        personalColorProfileId: profileId,
        savedAt: Date.now(),
        tags: [],
        isFavorite: false,
        syncStatus: 'pending',
      };
      await outfitPresetStore.add(preset);
      set((state) => ({ presets: [...state.presets, preset] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deletePreset: async (id) => {
    try {
      await outfitPresetStore.remove(id);
      set((state) => ({
        presets: state.presets.filter((p) => p.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  toggleFavorite: async (id) => {
    try {
      const preset = get().presets.find((p) => p.id === id);
      if (preset) {
        const updated = { ...preset, isFavorite: !preset.isFavorite };
        await outfitPresetStore.update(updated);
        set((state) => ({
          presets: state.presets.map((p) => (p.id === id ? updated : p)),
        }));
      }
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createSnapshot: async () => {
    try {
      const { items, presets } = get();
      const snapshot = await snapshotStore.createSnapshot(items, presets);
      set((state) => ({
        snapshots: [snapshot, ...state.snapshots],
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  restoreSnapshot: async (snapshot) => {
    try {
      await snapshotStore.restore(snapshot);
      set({
        items: snapshot.items,
        presets: snapshot.presets,
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  setCurrentOutfit: (items) => {
    set({ currentOutfit: items });
  },

  addToCurrentOutfit: (item) => {
    set((state) => {
      const existing = state.currentOutfit.filter((i) => i.category !== item.category);
      return { currentOutfit: [...existing, item] };
    });
  },

  removeFromCurrentOutfit: (itemId) => {
    set((state) => ({
      currentOutfit: state.currentOutfit.filter((i) => i.id !== itemId),
    }));
  },

  clearCurrentOutfit: () => {
    set({ currentOutfit: [] });
  },

  setSelectedItem: (item) => {
    set({ selectedItem: item });
  },

  filterItems: (filters) => {
    const { items } = get();
    return items.filter((item) => {
      return Object.entries(filters).every(([key, value]: [string, unknown]) => {
        if (Array.isArray(value)) {
          return value.some((v) => (item as unknown as Record<string, unknown>)[key] === v);
        }
        return (item as unknown as Record<string, unknown>)[key] === value;
      });
    });
  },

  getItemsByCategory: (category) => {
    return get().items.filter((item) => item.category === category);
  },
}));
