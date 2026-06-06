import type { ClothingItem } from '../../types';
import { ShoppingBag, Eye, Trash2 } from 'lucide-react';

interface ClothingCardProps {
  item: ClothingItem;
  onClick?: () => void;
  onAddToOutfit?: () => void;
  onRemove?: () => void;
  onViewDetails?: () => void;
  showActions?: boolean;
  selected?: boolean;
  matchScore?: number;
}

export const ClothingCard = ({
  item,
  onClick,
  onAddToOutfit,
  onRemove,
  onViewDetails,
  showActions = true,
  selected = false,
  matchScore,
}: ClothingCardProps) => {
  const categoryIcons: Record<string, string> = {
    top: '👕',
    bottom: '👖',
    outerwear: '🧥',
    dress: '👗',
    shoes: '👟',
    accessory: '👜',
  };

  const seasonLabels: Record<string, string> = {
    spring: '春',
    summer: '夏',
    autumn: '秋',
    winter: '冬',
  };

  return (
    <div
      className={`clothing-card ${selected ? 'clothing-card--selected' : ''}`}
      onClick={onClick}
    >
      <div className="clothing-card__image-wrapper">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="clothing-card__image"
            loading="lazy"
          />
        ) : (
          <div className="clothing-card__placeholder">
            {categoryIcons[item.category]}
          </div>
        )}
        <div
          className="clothing-card__color-indicator"
          style={{ backgroundColor: item.color.hex }}
          title={item.color.name}
        />
        {matchScore !== undefined && (
          <div
            className={`clothing-card__match-score ${
              matchScore >= 70
                ? 'clothing-card__match-score--good'
                : matchScore >= 50
                ? 'clothing-card__match-score--medium'
                : 'clothing-card__match-score--low'
            }`}
          >
            {matchScore}%
          </div>
        )}
      </div>

      <div className="clothing-card__info">
        <h3 className="clothing-card__name">{item.name}</h3>
        <div className="clothing-card__meta">
          <span className="clothing-card__brand">{item.brand}</span>
          <span className="clothing-card__size">{item.size}</span>
        </div>
        <div className="clothing-card__tags">
          {item.seasonality.slice(0, 2).map((s) => (
            <span key={s} className="clothing-card__tag">
              {seasonLabels[s]}
            </span>
          ))}
          <span className="clothing-card__tag clothing-card__tag--material">
            {item.material.name}
          </span>
        </div>
        {item.price && (
          <div className="clothing-card__price">¥{item.price}</div>
        )}
      </div>

      {showActions && (
        <div className="clothing-card__actions">
          {onAddToOutfit && (
            <button
              type="button"
              className="clothing-card__action-btn clothing-card__action-btn--primary"
              onClick={(e) => {
                e.stopPropagation();
                onAddToOutfit();
              }}
              title="添加到穿搭"
            >
              <ShoppingBag size={16} />
            </button>
          )}
          {onViewDetails && (
            <button
              type="button"
              className="clothing-card__action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
              title="查看详情"
            >
              <Eye size={16} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="clothing-card__action-btn clothing-card__action-btn--danger"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="删除"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
