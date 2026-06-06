import { create } from 'zustand';
import type { Product, CartItem, RecommendationResult, ClothingItem, PersonalColorProfile, ColorData, MaterialData } from '../types';
import { mockProducts } from '../data/mockData';
import { cartStore } from '../services/indexedDB';
import { matchProductToWardrobe } from '../services/recommendationModel';

interface EcommerceState {
  products: Product[];
  cart: CartItem[];
  recommendations: RecommendationResult[];
  isLoading: boolean;
  isMatching: boolean;
  error: string | null;
  selectedProduct: Product | null;
  searchQuery: string;
  filterCategory: string;
  sortBy: 'price' | 'rating' | 'matchScore';
  sortOrder: 'asc' | 'desc';
  loadProducts: () => void;
  loadCart: () => Promise<void>;
  addToCart: (
    product: Product,
    color: ColorData,
    material: MaterialData,
    size: string,
    quantity?: number,
  ) => Promise<void>;
  updateCartItem: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  calculateTotal: () => number;
  calculateItemCount: () => number;
  matchProducts: (
    products: Product[],
    wardrobe: ClothingItem[],
    profile: PersonalColorProfile,
  ) => Promise<void>;
  getMatchedProducts: () => RecommendationResult[];
  setSelectedProduct: (product: Product | null) => void;
  setSearchQuery: (query: string) => void;
  setFilterCategory: (category: string) => void;
  setSortBy: (sortBy: 'price' | 'rating' | 'matchScore') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  getFilteredProducts: () => (Product | (Product & { matchScore?: number }))[];
}

export const useEcommerceStore = create<EcommerceState>((set, get) => ({
  products: [],
  cart: [],
  recommendations: [],
  isLoading: false,
  isMatching: false,
  error: null,
  selectedProduct: null,
  searchQuery: '',
  filterCategory: '',
  sortBy: 'matchScore',
  sortOrder: 'desc',

  loadProducts: () => {
    set({ products: mockProducts });
  },

  loadCart: async () => {
    set({ isLoading: true, error: null });
    try {
      const cart = await cartStore.getAll();
      set({ cart, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addToCart: async (product, color, material, size, quantity = 1) => {
    try {
      const cartItem: CartItem = {
        productId: product.id,
        product,
        selectedColor: color,
        selectedMaterial: material,
        selectedSize: size,
        quantity,
        addedAt: Date.now(),
      };
      await cartStore.add(cartItem);
      set((state) => {
        const existing = state.cart.find((c) => c.productId === product.id);
        if (existing) {
          return {
            cart: state.cart.map((c) =>
              c.productId === product.id
                ? { ...c, quantity: c.quantity + quantity }
                : c,
            ),
          };
        }
        return { cart: [...state.cart, cartItem] };
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateCartItem: async (productId, quantity) => {
    try {
      await cartStore.update(productId, quantity);
      set((state) => ({
        cart: state.cart
          .map((c) =>
            c.productId === productId ? { ...c, quantity } : c,
          )
          .filter((c) => c.quantity > 0),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  removeFromCart: async (productId) => {
    try {
      await cartStore.remove(productId);
      set((state) => ({
        cart: state.cart.filter((c) => c.productId !== productId),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  clearCart: async () => {
    try {
      await cartStore.clear();
      set({ cart: [] });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  calculateTotal: () => {
    return get().cart.reduce((total, item) => {
      return total + item.product.price * item.quantity;
    }, 0);
  },

  calculateItemCount: () => {
    return get().cart.reduce((count, item) => count + item.quantity, 0);
  },

  matchProducts: async (products, wardrobe, profile) => {
    set({ isMatching: true, error: null });
    try {
      const recommendations = await Promise.all(
        products.map((product) =>
          matchProductToWardrobe(product, wardrobe, profile),
        ),
      );
      set({ recommendations, isMatching: false });
    } catch (error) {
      set({ error: (error as Error).message, isMatching: false });
    }
  },

  getMatchedProducts: () => {
    return get().recommendations.sort((a, b) => b.matchScore - a.matchScore);
  },

  setSelectedProduct: (product) => {
    set({ selectedProduct: product });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setFilterCategory: (category) => {
    set({ filterCategory: category });
  },

  setSortBy: (sortBy) => {
    set({ sortBy });
  },

  setSortOrder: (order) => {
    set({ sortOrder: order });
  },

  getFilteredProducts: () => {
    const {
      products,
      recommendations,
      searchQuery,
      filterCategory,
      sortBy,
      sortOrder,
    } = get();

    let filtered = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query),
      );
    }

    if (filterCategory) {
      filtered = filtered.filter((p) => p.category === filterCategory);
    }

    const matchMap = new Map(
      recommendations.map((r) => [r.product.id, r.matchScore]),
    );

    const productsWithScores = filtered.map((p) => ({
      ...p,
      matchScore: matchMap.get(p.id),
    }));

    productsWithScores.sort((a, b) => {
      let valA: number;
      let valB: number;

      switch (sortBy) {
        case 'price':
          valA = a.price;
          valB = b.price;
          break;
        case 'rating':
          valA = a.rating;
          valB = b.rating;
          break;
        case 'matchScore':
        default:
          valA = a.matchScore ?? 50;
          valB = b.matchScore ?? 50;
          break;
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return productsWithScores;
  },
}));
