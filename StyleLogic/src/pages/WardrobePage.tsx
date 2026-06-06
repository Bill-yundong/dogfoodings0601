import { useState, useEffect } from 'react';
import { WardrobeGrid } from '../components/wardrobe/WardrobeGrid';
import { useWardrobeStore } from '../store/useWardrobeStore';


import type { ClothingItem } from '../types';
import {
  Plus,
  Filter,
  Download,
  Upload,
  Folder,
  Star,
} from 'lucide-react';

const CATEGORIES = [
  { value: '', label: '全部' },
  { value: 'top', label: '上衣' },
  { value: 'bottom', label: '下装' },
  { value: 'outerwear', label: '外套' },
  { value: 'dress', label: '连衣裙' },
  { value: 'shoes', label: '鞋子' },
  { value: 'accessory', label: '配饰' },
];

export const WardrobePage = () => {
  const {
    items,
    isLoading,
    presets,
    snapshots,
    loadItems,
    loadPresets,
    loadSnapshots,
    initMockData,
    removeItem,
    addToCurrentOutfit,
    createSnapshot,
    restoreSnapshot,
    filterItems,
  } = useWardrobeStore();



  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'presets' | 'snapshots'>('items');

  useEffect(() => {
    initMockData();
    loadItems();
    loadPresets();
    loadSnapshots();
  }, [initMockData, loadItems, loadPresets, loadSnapshots]);

  const filteredItems = selectedCategory
    ? filterItems({ category: selectedCategory as ClothingItem['category'] })
    : items;

  const handleAddToOutfit = (item: ClothingItem) => {
    addToCurrentOutfit(item);
  };

  const handleRemove = (item: ClothingItem) => {
    if (confirm(`确定要删除 "${item.name}" 吗？`)) {
      removeItem(item.id);
    }
  };

  const handleCreateSnapshot = () => {
    createSnapshot();
    alert('快照创建成功！');
  };

  const handleRestoreSnapshot = (snapshot: typeof snapshots[0]) => {
    if (confirm('确定要恢复到此快照吗？当前数据将被覆盖。')) {
      restoreSnapshot(snapshot);
      loadItems();
      loadPresets();
    }
  };

  return (
    <div className="wardrobe-page">
      <div className="wardrobe-page__header">
        <h1>
          <Folder size={24} />
          我的衣橱
        </h1>
        <div className="wardrobe-page__tabs">
          <button
            type="button"
            className={`wardrobe-page__tab ${activeTab === 'items' ? 'wardrobe-page__tab--active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            服饰 ({items.length})
          </button>
          <button
            type="button"
            className={`wardrobe-page__tab ${activeTab === 'presets' ? 'wardrobe-page__tab--active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            <Star size={14} />
            穿搭预设 ({presets.length})
          </button>
          <button
            type="button"
            className={`wardrobe-page__tab ${activeTab === 'snapshots' ? 'wardrobe-page__tab--active' : ''}`}
            onClick={() => setActiveTab('snapshots')}
          >
            快照 ({snapshots.length})
          </button>
        </div>
      </div>

      {activeTab === 'items' && (
        <>
          <div className="wardrobe-page__filters">
            <div className="wardrobe-page__categories">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  className={`wardrobe-page__category-btn ${
                    selectedCategory === cat.value
                      ? 'wardrobe-page__category-btn--active'
                      : ''
                  }`}
                  onClick={() => setSelectedCategory(cat.value)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="wardrobe-page__actions">
              <button
                type="button"
                className="wardrobe-page__action-btn"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter size={16} />
                筛选
              </button>
              <button
                type="button"
                className="wardrobe-page__action-btn"
                onClick={handleCreateSnapshot}
              >
                <Download size={16} />
                创建快照
              </button>
              <button
                type="button"
                className="wardrobe-page__action-btn wardrobe-page__action-btn--primary"
              >
                <Plus size={16} />
                添加衣物
              </button>
            </div>
          </div>

          <WardrobeGrid
            items={filteredItems}
            onAddToOutfit={handleAddToOutfit}
            onRemove={handleRemove}
            loading={isLoading}
            emptyText="衣橱里还没有衣物，点击上方按钮添加"
          />
        </>
      )}

      {activeTab === 'presets' && (
        <div className="wardrobe-page__presets">
          {presets.length === 0 ? (
            <div className="wardrobe-page__empty">
              <Star size={48} />
              <p>还没有穿搭预设</p>
              <p className="wardrobe-page__empty-subtitle">
                去试衣间搭配并保存您的穿搭吧
              </p>
            </div>
          ) : (
            <div className="wardrobe-page__presets-grid">
              {presets.map((preset) => (
                <div key={preset.id} className="preset-card">
                  <div className="preset-card__header">
                    <h3>{preset.name}</h3>
                    <div className="preset-card__score">
                      {preset.outfit.totalScore}分
                    </div>
                  </div>
                  {preset.description && (
                    <p className="preset-card__description">{preset.description}</p>
                  )}
                  <div className="preset-card__items">
                    {preset.outfit.items.map((item) => (
                      <div
                        key={item.clothingItem.id}
                        className="preset-card__item"
                      >
                        {item.clothingItem.imageUrl ? (
                          <img src={item.clothingItem.imageUrl} alt="" />
                        ) : (
                          <span>👔</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="preset-card__footer">
                    <span className="preset-card__date">
                      {new Date(preset.savedAt).toLocaleDateString()}
                    </span>
                    {preset.isFavorite && <Star size={14} fill="#FFD166" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'snapshots' && (
        <div className="wardrobe-page__snapshots">
          <div className="wardrobe-page__snapshots-header">
            <p>快照可以保存衣橱的完整状态，方便随时恢复。</p>
            <button
              type="button"
              className="wardrobe-page__action-btn wardrobe-page__action-btn--primary"
              onClick={handleCreateSnapshot}
            >
              <Plus size={16} />
              新建快照
            </button>
          </div>
          {snapshots.length === 0 ? (
            <div className="wardrobe-page__empty">
              <Download size={48} />
              <p>还没有快照</p>
              <p className="wardrobe-page__empty-subtitle">
                创建快照可以备份您的衣橱数据
              </p>
            </div>
          ) : (
            <div className="wardrobe-page__snapshots-list">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id} className="snapshot-card">
                  <div className="snapshot-card__info">
                    <div className="snapshot-card__version">
                      版本 v{snapshot.version}
                    </div>
                    <div className="snapshot-card__date">
                      {new Date(snapshot.timestamp).toLocaleString()}
                    </div>
                    <div className="snapshot-card__meta">
                      <span>{snapshot.items.length} 件衣物</span>
                      <span>·</span>
                      <span>{snapshot.presets.length} 个预设</span>
                    </div>
                    <div className="snapshot-card__checksum">
                      校验码: {snapshot.checksum}
                    </div>
                  </div>
                  <div className="snapshot-card__actions">
                    <button
                      type="button"
                      className="snapshot-card__action-btn"
                      onClick={() => handleRestoreSnapshot(snapshot)}
                    >
                      <Upload size={16} />
                      恢复
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
