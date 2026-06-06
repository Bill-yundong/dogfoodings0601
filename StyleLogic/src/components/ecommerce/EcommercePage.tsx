import { useState, useEffect } from 'react';
import { useEcommerceStore } from '../../store/useEcommerceStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { usePersonalColorStore } from '../../store/usePersonalColorStore';
import { ProductGrid } from './ProductGrid';
import { ShoppingCart } from './ShoppingCart';
import type { Product, ColorData, MaterialData } from '../../types';
import { Search, Filter, ShoppingBag, ArrowUpDown, Sparkles } from 'lucide-react';

const CATEGORIES = ['全部', '上衣', '下装', '外套', '连衣裙', '鞋履', '配饰'];
const SORT_OPTIONS = [
  { value: 'matchScore', label: '匹配度' },
  { value: 'price', label: '价格' },
  { value: 'rating', label: '评分' },
];

export const EcommercePage = () => {
  const {
    products,
    recommendations,
    isMatching,
    searchQuery,
    filterCategory,
    sortBy,
    sortOrder,
    loadProducts,
    loadCart,
    addToCart,
    matchProducts,
    getFilteredProducts,
    setSelectedProduct,
    setSearchQuery,
    setFilterCategory,
    setSortBy,
    setSortOrder,
    calculateItemCount,
  } = useEcommerceStore();

  const { items: wardrobeItems } = useWardrobeStore();
  const { profile } = usePersonalColorStore();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCart();
  }, [loadProducts, loadCart]);

  useEffect(() => {
    if (products.length > 0 && wardrobeItems.length > 0 && profile) {
      matchProducts(products, wardrobeItems, profile);
    }
  }, [products, wardrobeItems, profile, matchProducts]);

  const matchScoresMap = new Map(
    recommendations.map((r) => [r.product.id, r.matchScore]),
  );

  const filteredProducts = getFilteredProducts();

  const handleAddToCart = (product: Product) => {
    const defaultColor = product.colors[0] as ColorData;
    const defaultMaterial = product.materials[0] as MaterialData;
    const defaultSize = product.sizes[0] || 'M';
    addToCart(product, defaultColor, defaultMaterial, defaultSize, 1);
  };

  const cartItemCount = calculateItemCount();

  return (
    <div className="ecommerce-page">
      <div className="ecommerce-page__header">
        <div className="ecommerce-page__header-top">
          <h1>
            <Sparkles size={24} />
            时尚商城
          </h1>
          <button
            type="button"
            className="ecommerce-page__cart-btn"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingBag size={20} />
            {cartItemCount > 0 && (
              <span className="ecommerce-page__cart-badge">{cartItemCount}</span>
            )}
          </button>
        </div>

        <div className="ecommerce-page__search-bar">
          <div className="ecommerce-page__search">
            <Search size={18} />
            <input
              type="text"
              placeholder="搜索商品、品牌..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={`ecommerce-page__filter-btn ${showFilters ? 'ecommerce-page__filter-btn--active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            筛选
          </button>
        </div>

        {showFilters && (
          <div className="ecommerce-page__filters">
            <div className="ecommerce-page__filter-section">
              <label>分类：</label>
              <div className="ecommerce-page__category-chips">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`ecommerce-page__category-chip ${
                      (cat === '全部' && filterCategory === '') ||
                      filterCategory === cat
                        ? 'ecommerce-page__category-chip--active'
                        : ''
                    }`}
                    onClick={() => setFilterCategory(cat === '全部' ? '' : cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="ecommerce-page__filter-section">
              <label>排序：</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'price' | 'rating' | 'matchScore')}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ecommerce-page__sort-order-btn"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <ArrowUpDown size={16} />
                {sortOrder === 'asc' ? '升序' : '降序'}
              </button>
            </div>
          </div>
        )}
      </div>

      {profile && isMatching && (
        <div className="ecommerce-page__matching-tip">
          <Sparkles size={16} className="ecommerce-page__matching-spinner" />
          正在根据您的个人色彩和衣橱智能匹配商品...
        </div>
      )}

      <div className="ecommerce-page__results-info">
        共找到 {filteredProducts.length} 件商品
        {profile && !isMatching && recommendations.length > 0 && (
          <span className="ecommerce-page__match-tip">
            · 已为您智能匹配
          </span>
        )}
      </div>

      <div className="ecommerce-page__products">
        <ProductGrid
          products={filteredProducts as Product[]}
          matchScores={matchScoresMap}
          onAddToCart={handleAddToCart}
          onViewDetails={setSelectedProduct}
          showMatchScore={!!profile}
        />
      </div>

      <ShoppingCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
