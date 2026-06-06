import type { Product, RecommendationResult } from '../../types';
import { Heart, ShoppingCart, Eye, Star, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface ProductCardProps {
  product: Product | RecommendationResult['product'];
  matchScore?: number;
  onAddToCart?: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
  onAddToWishlist?: (product: Product) => void;
  showMatchScore?: boolean;
}

export const ProductCard = ({
  product,
  matchScore,
  onAddToCart,
  onViewDetails,
  onAddToWishlist,
  showMatchScore = true,
}: ProductCardProps) => {
  const [imageError, setImageError] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#00A651';
    if (score >= 60) return '#FFD166';
    return '#E60012';
  };

  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / (product.originalPrice || product.price)) * 100)
    : 0;

  const prod = product as Product;
  const primaryColor = prod.colors?.[0];
  const primaryMaterial = prod.materials?.[0];

  return (
    <div className="product-card">
      <div className="product-card__image-wrapper">
        {prod.images && prod.images[0] && !imageError ? (
          <>
            <img
              src={prod.images[0]}
              alt={prod.name}
              className="product-card__image"
              loading="lazy"
              onError={() => setImageError(true)}
            />
            <div
              className="product-card__overlay"
              style={{
                background: primaryColor
                  ? `linear-gradient(135deg, ${primaryColor.hex}20 0%, ${primaryColor.hex}40 100%)`
                  : 'transparent',
              }}
            />
          </>
        ) : (
          <div
            className="product-card__placeholder"
            style={{
              background: primaryColor
                ? `linear-gradient(135deg, ${primaryColor.hex}30 0%, ${primaryColor.hex}60 100%)`
                : 'var(--bg-tertiary)',
            }}
          >
            <div className="product-card__placeholder-icon">👔</div>
            <div className="product-card__placeholder-text">
              {primaryColor?.name} · {primaryMaterial?.name}
            </div>
          </div>
        )}
        {hasDiscount && (
          <div className="product-card__discount-badge">-{discountPercent}%</div>
        )}
        {showMatchScore && matchScore !== undefined && (
          <div
            className="product-card__match-badge"
            style={{ backgroundColor: getScoreColor(matchScore) }}
          >
            <TrendingUp size={12} />
            {matchScore}% 匹配
          </div>
        )}
        <div className="product-card__color-options">
          {prod.colors?.slice(0, 4).map((color) => (
            <div
              key={color.id}
              className="product-card__color-dot"
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <div className="product-card__info">
        <div className="product-card__brand">{prod.brand}</div>
        <h3 className="product-card__name">{prod.name}</h3>
        <div className="product-card__rating">
          <Star size={14} fill="#FFD166" stroke="#FFD166" />
          <span>{prod.rating?.toFixed(1) || '0.0'}</span>
          <span className="product-card__review-count">
            ({prod.reviewCount || 0})
          </span>
        </div>
        <div className="product-card__price">
          <span className="product-card__price-current">¥{prod.price}</span>
          {hasDiscount && (
            <span className="product-card__price-original">
              ¥{prod.originalPrice}
            </span>
          )}
        </div>
        {matchScore !== undefined && showMatchScore && (
          <div className="product-card__match-bar">
            <div
              className="product-card__match-bar-fill"
              style={{
                width: `${matchScore}%`,
                backgroundColor: getScoreColor(matchScore),
              }}
            />
          </div>
        )}
      </div>

      <div className="product-card__actions">
        {onAddToWishlist && (
          <button
            type="button"
            className="product-card__action-btn"
            onClick={() => onAddToWishlist(prod)}
            title="加入心愿单"
          >
            <Heart size={16} />
          </button>
        )}
        {onViewDetails && (
          <button
            type="button"
            className="product-card__action-btn"
            onClick={() => onViewDetails(prod)}
            title="查看详情"
          >
            <Eye size={16} />
          </button>
        )}
        {onAddToCart && (
          <button
            type="button"
            className="product-card__action-btn product-card__action-btn--primary"
            onClick={() => onAddToCart(prod)}
            title="加入购物车"
          >
            <ShoppingCart size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
