import { useEffect } from 'react';
import { ColorAnalysis } from '../components/color/ColorAnalysis';
import { usePersonalColorStore } from '../store/usePersonalColorStore';

export const ColorAnalysisPage = () => {
  const { loadProfile } = usePersonalColorStore();

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <div className="color-analysis-page">
      <ColorAnalysis />
    </div>
  );
};
