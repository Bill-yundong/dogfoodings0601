import { Link } from 'react-router-dom';
import {
  Palette,
  Shirt,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Database,
  Wifi,
} from 'lucide-react';
import { usePersonalColorStore } from '../store/usePersonalColorStore';
import { useWardrobeStore } from '../store/useWardrobeStore';
import { useEcommerceStore } from '../store/useEcommerceStore';

export const HomePage = () => {
  const { profile } = usePersonalColorStore();
  const { items } = useWardrobeStore();
  const { products } = useEcommerceStore();

  const features = [
    {
      icon: <Palette size={32} />,
      title: '个人色彩分析',
      description: '基于您的肤色、发色、眸色，智能分析专属色彩类型，推荐最适合的穿搭色彩。',
      link: '/color-analysis',
      linkText: profile ? '查看我的色彩' : '开始分析',
      color: '#FF6F61',
    },
    {
      icon: <Shirt size={32} />,
      title: '虚拟试衣间',
      description: '自由组合衣橱中的服饰，实时获取色彩平衡和材质匹配评分，智能推荐最优搭配。',
      link: '/fitting',
      linkText: '进入试衣间',
      color: '#06D6A0',
    },
    {
      icon: <ShoppingBag size={32} />,
      title: '时尚电商',
      description: '根据您的个人色彩和衣橱智能匹配商品，推荐最适合您的时尚单品。',
      link: '/ecommerce',
      linkText: '逛商城',
      color: '#118AB2',
    },
    {
      icon: <Database size={32} />,
      title: '离线存储',
      description: '基于 IndexedDB 实现穿搭预设快照本地存储，离线也能使用，跨平台同步。',
      link: '/wardrobe',
      linkText: '管理衣橱',
      color: '#7C3AED',
    },
  ];

  const stats = [
    { label: '服饰数量', value: items.length, suffix: '件' },
    { label: '商城商品', value: products.length, suffix: '件' },
    { label: '色彩类型', value: profile ? '已分析' : '待分析', suffix: '' },
    { label: '同步状态', value: '实时', suffix: <Wifi size={14} /> },
  ];

  return (
    <div className="home-page">
      <section className="home-page__hero">
        <div className="home-page__hero-content">
          <div className="home-page__hero-badge">
            <Sparkles size={16} />
            AI 驱动的时尚穿搭助手
          </div>
          <h1 className="home-page__hero-title">
            StyleLogic
            <span className="home-page__hero-subtitle">
              虚拟衣橱 · 智能穿搭 · 时尚电商
            </span>
          </h1>
          <p className="home-page__hero-description">
            基于 React 构建的下一代虚拟衣橱系统，融合个人色彩分析、材质匹配模型与智能推荐算法，
            实现服饰材质特性与个人色彩数据在试衣模块与时尚电商系统间的实时对齐。
          </p>
          <div className="home-page__hero-actions">
            <Link
              to="/color-analysis"
              className="home-page__hero-btn home-page__hero-btn--primary"
            >
              开始使用 <ArrowRight size={18} />
            </Link>
            <Link
              to="/fitting"
              className="home-page__hero-btn home-page__hero-btn--secondary"
            >
              虚拟试衣
            </Link>
          </div>
        </div>
        <div className="home-page__hero-visual">
          <div className="home-page__hero-color-wheel">
            {profile?.dominantColors.slice(0, 5).map((color, i) => (
              <div
                key={color.id}
                className="home-page__color-dot"
                style={{
                  backgroundColor: color.hex,
                  transform: `rotate(${i * 72}deg) translateY(-80px)`,
                }}
              />
            ))}
            <div className="home-page__color-wheel-center">
              {profile ? profile.seasonalType.toUpperCase() : '?'}
            </div>
          </div>
        </div>
      </section>

      <section className="home-page__stats">
        {stats.map((stat, i) => (
          <div key={i} className="home-page__stat-item">
            <div className="home-page__stat-value">
              {stat.value}
              <span className="home-page__stat-suffix">{stat.suffix}</span>
            </div>
            <div className="home-page__stat-label">{stat.label}</div>
          </div>
        ))}
      </section>

      <section className="home-page__features">
        <h2 className="home-page__section-title">核心功能</h2>
        <div className="home-page__features-grid">
          {features.map((feature, i) => (
            <div
              key={i}
              className="home-page__feature-card"
              style={{ borderColor: feature.color + '40' }}
            >
              <div
                className="home-page__feature-icon"
                style={{ backgroundColor: feature.color + '15', color: feature.color }}
              >
                {feature.icon}
              </div>
              <h3 className="home-page__feature-title">{feature.title}</h3>
              <p className="home-page__feature-description">{feature.description}</p>
              <Link
                to={feature.link}
                className="home-page__feature-link"
                style={{ color: feature.color }}
              >
                {feature.linkText} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="home-page__tech">
        <h2 className="home-page__section-title">技术架构</h2>
        <div className="home-page__tech-grid">
          <div className="home-page__tech-card">
            <h4>🎨 异步色彩平衡模型</h4>
            <p>
              基于 RGB/HSL 色彩空间转换，计算色彩对比度、温度平衡、饱和度平衡，
              结合个人色彩档案，实时评估穿搭色彩和谐度。
            </p>
          </div>
          <div className="home-page__tech-card">
            <h4>🧵 材质匹配算法</h4>
            <p>
              量化材质的纹理、重量、透气性、悬垂性等特性，计算材质间的兼容性分数，
              推荐季节适配、质感平衡的穿搭组合。
            </p>
          </div>
          <div className="home-page__tech-card">
            <h4>💾 IndexedDB 离线存储</h4>
            <p>
              实现穿搭预设快照的本地持久化存储，支持版本控制、快照恢复、
              离线操作与在线同步，为跨平台推荐提供底层数据支持。
            </p>
          </div>
          <div className="home-page__tech-card">
            <h4>🔄 实时数据对齐</h4>
            <p>
              基于事件驱动的同步机制，实现试衣模块与电商系统间的数据实时同步，
              确保商品推荐与衣橱状态的一致性。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
