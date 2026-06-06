import type { ColorData } from '../../types';

interface ColorCardProps {
  color: ColorData;
  showDetails?: boolean;
  matchScore?: number;
  onClick?: () => void;
  selected?: boolean;
}

export const ColorCard = ({
  color,
  showDetails = false,
  matchScore,
  onClick,
  selected = false,
}: ColorCardProps) => {
  const seasonalLabels: Record<string, string> = {
    spring: '春季型',
    summer: '夏季型',
    autumn: '秋季型',
    winter: '冬季型',
  };

  const tempLabels: Record<string, string> = {
    warm: '暖调',
    cool: '冷调',
    neutral: '中性',
  };

  return (
    <div
      className={`color-card ${selected ? 'color-card--selected' : ''}`}
      onClick={onClick}
    >
      <div
        className="color-card__swatch"
        style={{ backgroundColor: color.hex }}
      />
      <div className="color-card__info">
        <div className="color-card__name">{color.name}</div>
        <div className="color-card__hex">{color.hex}</div>
        {showDetails && (
          <div className="color-card__details">
            <span className="color-card__tag">{seasonalLabels[color.seasonalType]}</span>
            <span className="color-card__tag">{tempLabels[color.temperature]}</span>
          </div>
        )}
        {matchScore !== undefined && (
          <div className={`color-card__score ${matchScore >= 70 ? 'color-card__score--good' : matchScore >= 50 ? 'color-card__score--medium' : 'color-card__score--low'}`}>
            匹配度 {matchScore}%
          </div>
        )}
      </div>
    </div>
  );
};
