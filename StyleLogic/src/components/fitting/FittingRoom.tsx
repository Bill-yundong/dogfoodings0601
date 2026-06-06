import { useState, useEffect } from 'react';
import type { ClothingItem, PersonalColorProfile } from '../../types';
import { OutfitSlot } from './OutfitSlot';
import { ScoreDisplay } from '../common/ScoreDisplay';
import { useFittingStore } from '../../store/useFittingStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { Sparkles, RefreshCw, Save, Shuffle } from 'lucide-react';

interface FittingRoomProps {
  profile: PersonalColorProfile;
  onSavePreset?: (name: string) => void;
}

const SLOTS = [
  { key: 'outerwear', label: '外套' },
  { key: 'top', label: '上衣' },
  { key: 'bottom', label: '下装' },
  { key: 'dress', label: '连衣裙' },
  { key: 'shoes', label: '鞋子' },
  { key: 'accessory', label: '配饰' },
];

const OCCASIONS = [
  { value: 'daily', label: '日常' },
  { value: 'work', label: '工作' },
  { value: 'date', label: '约会' },
  { value: 'party', label: '派对' },
  { value: 'travel', label: '旅行' },
  { value: 'formal', label: '正式' },
];

const SEASONS = [
  { value: 'spring', label: '春季' },
  { value: 'summer', label: '夏季' },
  { value: 'autumn', label: '秋季' },
  { value: 'winter', label: '冬季' },
];

export const FittingRoom = ({ profile, onSavePreset }: FittingRoomProps) => {
  const {
    selectedItems,
    outfitScore,
    colorAnalysis,
    recommendations,
    isAnalyzing,
    isGenerating,
    selectedOccasion,
    selectedSeason,
    setItem,
    removeItem,
    clearOutfit,
    analyzeCurrentOutfit,
    generateRecommendations,
    applyOutfit,
    setOccasion,
    setSeason,
    getSelectedItemsList,
  } = useFittingStore();

  const { items, getItemsByCategory } = useWardrobeStore();
  const [showPicker, setShowPicker] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    const items = getSelectedItemsList();
    if (items.length > 0 && profile) {
      analyzeCurrentOutfit(profile);
    }
  }, [selectedItems, profile, analyzeCurrentOutfit, getSelectedItemsList]);

  const handleGenerateRecommendations = () => {
    generateRecommendations(items, profile, selectedOccasion, selectedSeason, 5);
  };

  const handleSavePreset = () => {
    if (outfitScore && onSavePreset && presetName.trim()) {
      const currentOutfit = useFittingStore.getState().currentOutfit;
      if (currentOutfit) {
        useWardrobeStore
          .getState()
          .savePreset(presetName, currentOutfit, '手动保存的穿搭');
        setShowSaveDialog(false);
        setPresetName('');
      }
    }
  };

  const renderPicker = (slot: string) => {
    if (showPicker !== slot) return null;

    const categoryItems = getItemsByCategory(
      slot as ClothingItem['category'],
    );

    return (
      <div className="fitting-room__picker-overlay" onClick={() => setShowPicker(null)}>
        <div
          className="fitting-room__picker"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="fitting-room__picker-header">
            <h3>选择{SLOTS.find((s) => s.key === slot)?.label}</h3>
            <button
              type="button"
              className="fitting-room__picker-close"
              onClick={() => setShowPicker(null)}
            >
              ×
            </button>
          </div>
          <div className="fitting-room__picker-grid">
            {categoryItems.map((item) => (
              <div
                key={item.id}
                className="fitting-room__picker-item"
                onClick={() => {
                  setItem(slot, item);
                  setShowPicker(null);
                }}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} />
                ) : (
                  <div>👔</div>
                )}
                <div className="fitting-room__picker-item-name">{item.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fitting-room">
      <div className="fitting-room__header">
        <h2>虚拟试衣间</h2>
        <div className="fitting-room__filters">
          <div className="fitting-room__filter-group">
            <label>场合：</label>
            <select
              value={selectedOccasion}
              onChange={(e) => setOccasion(e.target.value)}
            >
              {OCCASIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fitting-room__filter-group">
            <label>季节：</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSeason(e.target.value)}
            >
              {SEASONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="fitting-room__content">
        <div className="fitting-room__slots">
          {SLOTS.map((slot) => (
            <OutfitSlot
              key={slot.key}
              slot={slot.key}
              label={slot.label}
              item={selectedItems.get(slot.key) || null}
              onAdd={() => setShowPicker(slot.key)}
              onRemove={() => removeItem(slot.key)}
              disabled={isGenerating}
            />
          ))}
        </div>

        <div className="fitting-room__analysis">
          {isAnalyzing ? (
            <div className="fitting-room__analyzing">
              <RefreshCw className="fitting-room__spinner" size={32} />
              <p>正在分析穿搭...</p>
            </div>
          ) : outfitScore ? (
            <>
              <ScoreDisplay scores={outfitScore} />
              {colorAnalysis && colorAnalysis.recommendations.length > 0 && (
                <div className="fitting-room__recommendations">
                  <h4>💡 穿搭建议</h4>
                  <ul>
                    {colorAnalysis.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="fitting-room__empty">
              <Sparkles size={48} />
              <p>选择衣物开始搭配</p>
            </div>
          )}

          <div className="fitting-room__actions">
            <button
              type="button"
              className="fitting-room__action-btn"
              onClick={handleGenerateRecommendations}
              disabled={isGenerating}
            >
              <Shuffle size={16} />
              {isGenerating ? '生成中...' : '智能推荐'}
            </button>
            <button
              type="button"
              className="fitting-room__action-btn"
              onClick={clearOutfit}
            >
              清空
            </button>
            {outfitScore && (
              <button
                type="button"
                className="fitting-room__action-btn fitting-room__action-btn--primary"
                onClick={() => setShowSaveDialog(true)}
              >
                <Save size={16} />
                保存穿搭
              </button>
            )}
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="fitting-room__recommendation-list">
          <h3>✨ 为您推荐</h3>
          <div className="fitting-room__recommendation-grid">
            {recommendations.map((outfit) => (
              <div
                key={outfit.id}
                className="fitting-room__recommendation-card"
                onClick={() => applyOutfit(outfit)}
              >
                <div className="fitting-room__recommendation-score">
                  {outfit.totalScore}分
                </div>
                <div className="fitting-room__recommendation-items">
                  {outfit.items.slice(0, 3).map((item) =>
                    item.clothingItem.imageUrl ? (
                      <img
                        key={item.clothingItem.id}
                        src={item.clothingItem.imageUrl}
                        alt={item.clothingItem.name}
                      />
                    ) : (
                      <div key={item.clothingItem.id}>👔</div>
                    ),
                  )}
                </div>
                <div className="fitting-room__recommendation-name">
                  {outfit.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {SLOTS.map((slot) => renderPicker(slot.key))}

      {showSaveDialog && (
        <div
          className="fitting-room__dialog-overlay"
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="fitting-room__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>保存穿搭预设</h3>
            <input
              type="text"
              placeholder="输入穿搭名称..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              autoFocus
            />
            <div className="fitting-room__dialog-actions">
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="fitting-room__action-btn--primary"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
