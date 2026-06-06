import { create } from 'zustand';
import type { ClothingItem, OutfitPreset, WardrobeSnapshot, OutfitCombination } from '../types';
import { wardrobeStore, outfitPresetStore, snapshotStore, initDB } from '../services/indexedDB';
import { generateMockWardrobe } from '../data/mockData';

const DATA_VERSION = 'v2.1.0';
const VERSION_KEY = 'stylelogic_data_version';

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
      
      const storedVersion = localStorage.getItem(VERSION_KEY);
      const existing = await wardrobeStore.getAll();
      
      const needForceUpdate = storedVersion !== DATA_VERSION || existing.length === 0;
      
      if (needForceUpdate) {
        await wardrobeStore.clear();
        const newWardrobe = generateMockWardrobe(30);
        await wardrobeStore.bulkAdd(newWardrobe);
        localStorage.setItem(VERSION_KEY, DATA_VERSION);
        set({ items: newWardrobe });
      } else {
        const hasCorrectData = existing.every(item => {
          const name = item.name.toLowerCase();
          const material = item.material.name.toLowerCase();
          
          if ((name.includes('皮') || name.includes('皮革')) && !material.includes('皮') && !material.includes('革')) return false;
          if ((name.includes('毛') || name.includes('呢') || name.includes('羊绒')) && !material.includes('羊毛') && !material.includes('针织')) return false;
          if (name.includes('牛仔') && !material.includes('牛仔')) return false;
          if ((name.includes('丝') || name.includes('缎')) && !material.includes('真丝') && !material.includes('雪纺') && !material.includes('缎面')) return false;
          if (name.includes('亚麻') && !material.includes('亚麻')) return false;
          if (name.includes('棉') && !material.includes('棉')) return false;
          if (name.includes('针织') && !material.includes('针织') && !material.includes('羊毛')) return false;
          if (name.includes('雪纺') && !material.includes('雪纺')) return false;
          
          return true;
        });
        
        if (!hasCorrectData) {
          await wardrobeStore.clear();
          const newWardrobe = generateMockWardrobe(30);
          await wardrobeStore.bulkAdd(newWardrobe);
          localStorage.setItem(VERSION_KEY, DATA_VERSION);
          set({ items: newWardrobe });
        } else {
          const needAdditionalUpdate = existing.some(item => {
            const name = item.name.toLowerCase();
            const material = item.material.name.toLowerCase();
            
            if ((name.includes('风衣') || name.includes('大衣')) && !material.includes('羊毛')) return true;
            if (name.includes('项链') || name.includes('耳环')) return true;
            if (name.includes('发带') && !material.includes('真丝')) return true;
            if (name.includes('链条') && material.includes('亚麻')) return true;
            
            return false;
          });
          
          if (needAdditionalUpdate) {
            await wardrobeStore.clear();
            const newWardrobe = generateMockWardrobe(30);
            await wardrobeStore.bulkAdd(newWardrobe);
            localStorage.setItem(VERSION_KEY, DATA_VERSION);
            set({ items: newWardrobe });
          } else {
            set({ items: existing });
          }
        }
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
