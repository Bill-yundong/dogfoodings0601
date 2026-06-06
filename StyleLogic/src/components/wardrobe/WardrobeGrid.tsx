import type { ClothingItem } from '../../types';
import { ClothingCard } from './ClothingCard';

interface WardrobeGridProps {
  items: ClothingItem[];
  onItemClick?: (item: ClothingItem) => void;
  onAddToOutfit?: (item: ClothingItem) => void;
  onRemove?: (item: ClothingItem) => void;
  onViewDetails?: (item: ClothingItem) => void;
  selectedItemId?: string;
  showActions?: boolean;
  loading?: boolean;
  emptyText?: string;
}

export const WardrobeGrid = ({
  items,
  onItemClick,
  onAddToOutfit,
  onRemove,
  onViewDetails,
  selectedItemId,
  showActions = true,
  loading = false,
  emptyText = '衣橱里还没有衣物',
}: WardrobeGridProps) => {
  if (loading) {
    return (
      <div className="wardrobe-grid wardrobe-grid--loading">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="clothing-card clothing-card--skeleton">
            <div className="clothing-card__image-wrapper clothing-card__image-wrapper--skeleton" />
            <div className="clothing-card__info">
              <div className="clothing-card__name clothing-card__skeleton-line" />
              <div className="clothing-card__meta clothing-card__skeleton-line" />
              <div className="clothing-card__tags clothing-card__skeleton-line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="wardrobe-grid wardrobe-grid--empty">
        <div className="wardrobe-grid__empty-icon">👗</div>
        <p className="wardrobe-grid__empty-text">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="wardrobe-grid">
      {items.map((item) => (
        <ClothingCard
          key={item.id}
          item={item}
          onClick={() => onItemClick?.(item)}
          onAddToOutfit={onAddToOutfit ? () => onAddToOutfit(item) : undefined}
          onRemove={onRemove ? () => onRemove(item) : undefined}
          onViewDetails={onViewDetails ? () => onViewDetails(item) : undefined}
          showActions={showActions}
          selected={item.id === selectedItemId}
        />
      ))}
    </div>
  );
};
