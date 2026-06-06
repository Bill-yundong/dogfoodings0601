import type { ClothingItem } from '../../types';
import { Plus, X } from 'lucide-react';
import { generatePlaceholderSVG } from '../../utils/imageUtils';

interface OutfitSlotProps {
  slot: string;
  label: string;
  item: ClothingItem | null;
  onAdd: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

const slotIcons: Record<string, string> = {
  top: '👕',
  bottom: '👖',
  outerwear: '🧥',
  dress: '👗',
  shoes: '👟',
  accessory: '👜',
};

export const OutfitSlot = ({
  slot,
  label,
  item,
  onAdd,
  onRemove,
  disabled = false,
}: OutfitSlotProps) => {

  const placeholderSvg = item
    ? generatePlaceholderSVG(item.color, item.material, slot, item.name)
    : null;

  return (
    <div className={`outfit-slot ${item ? 'outfit-slot--filled' : ''} ${disabled ? 'outfit-slot--disabled' : ''}`}>
      <div className="outfit-slot__header">
        <span className="outfit-slot__label">{label}</span>
        {item && !disabled && (
          <button
            type="button"
            className="outfit-slot__remove-btn"
            onClick={onRemove}
            title="移除"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {item ? (
        <div className="outfit-slot__item" onClick={disabled ? undefined : onAdd}>
          <div className="outfit-slot__item-image-wrapper">
            {placeholderSvg ? (
              <img
                src={placeholderSvg}
                alt={item.name}
                className="outfit-slot__item-image outfit-slot__item-image--placeholder"
              />
            ) : (
              <div
                className="outfit-slot__item-placeholder"
                style={{
                  background: `linear-gradient(135deg, ${item.color.hex}30 0%, ${item.color.hex}60 100%)`,
                }}
              >
                <div className="outfit-slot__item-placeholder-icon">
                  {slotIcons[slot] || '👔'}
                </div>
                <div className="outfit-slot__item-placeholder-text">
                  {item.color.name}
                </div>
              </div>
            )}
            <div
              className="outfit-slot__item-overlay"
              style={{
                background: `linear-gradient(135deg, ${item.color.hex}20 0%, ${item.color.hex}40 100%)`,
              }}
            />
            <div
              className="outfit-slot__color-dot"
              style={{ backgroundColor: item.color.hex }}
              title={item.color.name}
            />
          </div>
          <div className="outfit-slot__item-info">
            <div className="outfit-slot__item-name">{item.name}</div>
            <div className="outfit-slot__item-meta">
              <span>{item.material.name}</span>
              <span>·</span>
              <span>{item.brand}</span>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="outfit-slot__add-btn"
          onClick={onAdd}
          disabled={disabled}
        >
          <Plus size={24} />
          <span>添加{label}</span>
        </button>
      )}
    </div>
  );
};
