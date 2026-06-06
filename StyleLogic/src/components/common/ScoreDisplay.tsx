interface ScoreDisplayProps {
  scores: {
    colorScore: number;
    materialScore: number;
    styleScore: number;
    totalScore: number;
  };
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ScoreDisplay = ({
  scores,
  showDetails = true,
  size = 'md',
}: ScoreDisplayProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#00A651';
    if (score >= 60) return '#FFD166';
    return '#E60012';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    if (score >= 40) return '一般';
    return '待提升';
  };

  const items = [
    { key: 'colorScore', label: '色彩', value: scores.colorScore, icon: '🎨' },
    { key: 'materialScore', label: '材质', value: scores.materialScore, icon: '🧵' },
    { key: 'styleScore', label: '风格', value: scores.styleScore, icon: '✨' },
  ];

  return (
    <div className={`score-display score-display--${size}`}>
      <div className="score-display__total">
        <div
          className="score-display__total-value"
          style={{ color: getScoreColor(scores.totalScore) }}
        >
          {scores.totalScore}
        </div>
        <div className="score-display__total-label">
          {getScoreLabel(scores.totalScore)}
        </div>
        <div className="score-display__total-ring">
          <svg viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#e0e0e0"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={getScoreColor(scores.totalScore)}
              strokeWidth="8"
              strokeDasharray={`${(scores.totalScore / 100) * 339.292} 339.292`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          </svg>
        </div>
      </div>
      {showDetails && (
        <div className="score-display__items">
          {items.map((item) => (
            <div key={item.key} className="score-display__item">
              <div className="score-display__item-icon">{item.icon}</div>
              <div className="score-display__item-info">
                <div className="score-display__item-label">{item.label}</div>
                <div className="score-display__item-bar">
                  <div
                    className="score-display__item-fill"
                    style={{
                      width: `${item.value}%`,
                      backgroundColor: getScoreColor(item.value),
                    }}
                  />
                </div>
              </div>
              <div
                className="score-display__item-value"
                style={{ color: getScoreColor(item.value) }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
