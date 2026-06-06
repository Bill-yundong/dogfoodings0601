import type { Product } from '../../types';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  matchScores?: Map<string, number>;
  onAddToCart?: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
  onAddToWishlist?: (product: Product) => void;
  loading?: boolean;
  emptyText?: string;
  showMatchScore?: boolean;
}

export const ProductGrid = ({
  products,
  matchScores,
  onAddToCart,
  onViewDetails,
  onAddToWishlist,
  loading = false,
  emptyText = '暂无商品',
  showMatchScore = true,
}: ProductGridProps) => {
  if (loading) {
    return (
      <div className="product-grid product-grid--loading">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="product-card product-card--skeleton">
            <div className="product-card__image-wrapper product-card__image-wrapper--skeleton" />
            <div className="product-card__info">
              <div className="product-card__brand product-card__skeleton-line" />
              <div className="product-card__name product-card__skeleton-line" />
              <div className="product-card__price product-card__skeleton-line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="product-grid product-grid--empty">
        <div className="product-grid__empty-icon">🛍️</div>
        <p className="product-grid__empty-text">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          matchScore={matchScores?.get(product.id)}
          onAddToCart={onAddToCart}
          onViewDetails={onViewDetails}
          onAddToWishlist={onAddToWishlist}
          showMatchScore={showMatchScore}
        />
      ))}
    </div>
  );
};
