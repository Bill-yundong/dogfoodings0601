import { useEffect } from 'react';
import { FittingRoom } from '../components/fitting/FittingRoom';
import { usePersonalColorStore } from '../store/usePersonalColorStore';
import { useWardrobeStore } from '../store/useWardrobeStore';
import { useFittingStore } from '../store/useFittingStore';
import { Link } from 'react-router-dom';
import { Palette, AlertTriangle } from 'lucide-react';

export const FittingPage = () => {
  const { profile, loadProfile } = usePersonalColorStore();
  const { items, initMockData, loadItems, savePreset } = useWardrobeStore();
  const { clearOutfit } = useFittingStore();

  useEffect(() => {
    loadProfile();
    initMockData();
    loadItems();
    clearOutfit();
  }, [loadProfile, initMockData, loadItems, clearOutfit]);

  const handleSavePreset = (name: string) => {
    const currentOutfit = useFittingStore.getState().currentOutfit;
    if (currentOutfit) {
      savePreset(name, currentOutfit, '从试衣间保存');
    }
  };

  if (!profile) {
    return (
      <div className="fitting-page fitting-page--no-profile">
        <div className="fitting-page__no-profile-card">
          <AlertTriangle size={48} className="fitting-page__warning-icon" />
          <h2>请先完成个人色彩分析</h2>
          <p>
            为了给您提供最准确的穿搭建议和评分，请先完成个人色彩分析，
            建立您的专属色彩档案。
          </p>
          <Link
            to="/color-analysis"
            className="fitting-page__action-btn fitting-page__action-btn--primary"
          >
            <Palette size={18} />
            去做色彩分析
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="fitting-page fitting-page--no-items">
        <div className="fitting-page__no-profile-card">
          <AlertTriangle size={48} className="fitting-page__warning-icon" />
          <h2>衣橱中还没有衣物</h2>
          <p>请先在衣橱中添加衣物，或者等待模拟数据加载完成。</p>
          <Link
            to="/wardrobe"
            className="fitting-page__action-btn fitting-page__action-btn--primary"
          >
            去衣橱看看
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fitting-page">
      <FittingRoom profile={profile} onSavePreset={handleSavePreset} />
    </div>
  );
};
