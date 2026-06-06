import { useState } from 'react';
import { ColorPicker } from '../common/ColorPicker';
import { ColorCard } from '../common/ColorCard';
import { usePersonalColorStore } from '../../store/usePersonalColorStore';
import type { RGB } from '../../types';
import { Sparkles, ArrowRight, Palette } from 'lucide-react';

const skinPresets = [
  '#F5DEB3', '#DEB887', '#D2B48C', '#BC8F5F', '#8B7355', '#5C4033',
  '#FFE4C4', '#FFDAB9', '#FFE4B5', '#FFEFD5', '#FFF8DC', '#FAEBD7',
];

const hairPresets = [
  '#1B1B1B', '#2C2C2C', '#4A3728', '#6B4423', '#8B6914', '#A67C52',
  '#C68642', '#D4A574', '#E8C39E', '#9A6400', '#8B0000', '#A52A2A',
];

const eyePresets = [
  '#2C1810', '#3D2314', '#4A3728', '#5C4033', '#6B4423', '#8B6914',
  '#1B4D3E', '#2E5A88', '#3D5A80', '#4A6FA5', '#5C7EAD', '#6B8EBA',
];

export const ColorAnalysis = () => {
  const { analyzeColors, createProfile, analysisResult, profile } =
    usePersonalColorStore();

  const [step, setStep] = useState<'input' | 'analyzing' | 'result'>('input');
  const [skinTone, setSkinTone] = useState<RGB>({ r: 245, g: 222, b: 179 });
  const [hairColor, setHairColor] = useState<RGB>({ r: 43, g: 55, b: 40 });
  const [eyeColor, setEyeColor] = useState<RGB>({ r: 107, g: 68, b: 35 });
  const [skinHex, setSkinHex] = useState('#F5DEB3');
  const [hairHex, setHairHex] = useState('#2B3728');
  const [eyeHex, setEyeHex] = useState('#6B4423');

  const seasonLabels: Record<string, string> = {
    spring: '🌸 春季型',
    summer: '🌊 夏季型',
    autumn: '🍂 秋季型',
    winter: '❄️ 冬季型',
  };

  const seasonDescriptions: Record<string, string> = {
    spring: '您属于明亮温暖的春季型色彩，适合清新明亮、带有黄色调的暖色系。',
    summer: '您属于柔和冷调的夏季型色彩，适合柔和灰调、带有蓝色调的冷色系。',
    autumn: '您属于浓郁温暖的秋季型色彩，适合深沉浓郁、带有黄色调的暖色系。',
    winter: '您属于纯正冷调的冬季型色彩，适合纯正鲜明、带有蓝色调的冷色系。',
  };

  const handleAnalyze = async () => {
    setStep('analyzing');
    await analyzeColors(skinTone, hairColor, eyeColor);
    await createProfile('user_001', skinTone, hairColor, eyeColor);
    setStep('result');
  };

  const handleReset = () => {
    setStep('input');
  };

  if (step === 'input') {
    return (
      <div className="color-analysis">
        <div className="color-analysis__header">
          <h1>
            <Palette />
            个人色彩分析
          </h1>
          <p>
            请选择您的肤色、发色和眸色，我们将通过智能算法分析您的专属色彩类型，为您推荐最适合的穿搭色彩。
          </p>
        </div>

        <div className="color-analysis__pickers">
          <ColorPicker
            label="肤色"
            value={skinHex}
            onChange={(hex, rgb) => {
              setSkinHex(hex);
              setSkinTone(rgb);
            }}
            presetColors={skinPresets}
          />
          <ColorPicker
            label="发色"
            value={hairHex}
            onChange={(hex, rgb) => {
              setHairHex(hex);
              setHairColor(rgb);
            }}
            presetColors={hairPresets}
          />
          <ColorPicker
            label="眸色"
            value={eyeHex}
            onChange={(hex, rgb) => {
              setEyeHex(hex);
              setEyeColor(rgb);
            }}
            presetColors={eyePresets}
          />
        </div>

        <div className="color-analysis__preview">
          <h3>您的色彩特征预览</h3>
          <div className="color-analysis__preview-colors">
            <div
              className="color-analysis__preview-swatch"
              style={{ backgroundColor: skinHex }}
            >
              <span>肤色</span>
            </div>
            <div
              className="color-analysis__preview-swatch"
              style={{ backgroundColor: hairHex }}
            >
              <span>发色</span>
            </div>
            <div
              className="color-analysis__preview-swatch"
              style={{ backgroundColor: eyeHex }}
            >
              <span>眸色</span>
            </div>
          </div>
        </div>

        <div className="color-analysis__actions">
          <button
            type="button"
            className="color-analysis__btn color-analysis__btn--primary"
            onClick={handleAnalyze}
          >
            开始分析
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'analyzing') {
    return (
      <div className="color-analysis color-analysis--analyzing">
        <Sparkles className="color-analysis__spinner" size={64} />
        <h2>正在分析您的色彩特征...</h2>
        <p>我们正在通过智能色彩算法为您匹配最佳色彩类型</p>
      </div>
    );
  }

  if (step === 'result' && analysisResult && profile) {
    return (
      <div className="color-analysis color-analysis--result">
        <div className="color-analysis__result-header">
          <h2>分析结果</h2>
          <div className="color-analysis__result-season">
            {seasonLabels[analysisResult.seasonalType]}
          </div>
          <div className="color-analysis__result-confidence">
            置信度: {Math.round(analysisResult.confidence * 100)}%
          </div>
        </div>

        <div className="color-analysis__result-description">
          {seasonDescriptions[analysisResult.seasonalType]}
        </div>

        <div className="color-analysis__result-section">
          <h3>🎨 您的主色调</h3>
          <div className="color-analysis__colors-grid">
            {profile.dominantColors.map((color) => (
              <ColorCard key={color.id} color={color} showDetails />
            ))}
          </div>
        </div>

        <div className="color-analysis__result-section">
          <h3>✨ 辅助色</h3>
          <div className="color-analysis__colors-grid">
            {profile.accentColors.map((color) => (
              <ColorCard key={color.id} color={color} showDetails />
            ))}
          </div>
        </div>

        <div className="color-analysis__result-section">
          <h3>⚪ 中性百搭色</h3>
          <div className="color-analysis__colors-grid">
            {profile.neutralColors.slice(0, 6).map((color) => (
              <ColorCard key={color.id} color={color} showDetails />
            ))}
          </div>
        </div>

        <div className="color-analysis__result-section">
          <h3>⚠️ 建议避用色</h3>
          <div className="color-analysis__colors-grid">
            {profile.avoidColors.map((color) => (
              <ColorCard key={color.id} color={color} showDetails />
            ))}
          </div>
        </div>

        <div className="color-analysis__result-section">
          <h3>💡 穿搭建议</h3>
          <ul className="color-analysis__recommendations-list">
            {analysisResult.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>

        <div className="color-analysis__actions">
          <button
            type="button"
            className="color-analysis__btn"
            onClick={handleReset}
          >
            重新分析
          </button>
        </div>
      </div>
    );
  }

  return null;
};
