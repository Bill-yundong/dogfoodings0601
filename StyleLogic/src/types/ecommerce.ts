import type { ColorData, MaterialData } from './';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency: string;
  images: string[];
  colors: ColorData[];
  materials: MaterialData[];
  sizes: string[];
  category: string;
  style: string;
  brand: string;
  stock: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  seasonality: string[];
  occasions: string[];
  matchScore?: number;
  colorMatchScore?: number;
  materialMatchScore?: number;
  createdAt: number;
}

export interface CartItem {
  productId: string;
  product: Product;
  selectedColor: ColorData;
  selectedMaterial: MaterialData;
  selectedSize: string;
  quantity: number;
  addedAt: number;
}

export interface RecommendationResult {
  product: Product;
  matchScore: number;
  colorMatchScore: number;
  materialMatchScore: number;
  styleMatchScore: number;
  reason: string;
  matchingItems: string[];
}

export interface SyncEvent {
  type: 'item_added' | 'item_removed' | 'item_updated' | 'preset_saved' | 'cart_updated';
  payload: Record<string, unknown>;
  timestamp: number;
  source: 'fitting' | 'ecommerce';
}
