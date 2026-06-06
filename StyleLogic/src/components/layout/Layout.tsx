import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Palette, Shirt, ShoppingBag, User, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { DataSync } from '../sync/DataSync';
import { useEcommerceStore } from '../../store/useEcommerceStore';

export const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { calculateItemCount } = useEcommerceStore();
  const navigate = useNavigate();

  const cartCount = calculateItemCount();

  const navItems = [
    { to: '/', icon: <Home size={18} />, label: '首页' },
    { to: '/color-analysis', icon: <Palette size={18} />, label: '色彩分析' },
    { to: '/wardrobe', icon: <Shirt size={18} />, label: '衣橱' },
    { to: '/fitting', icon: <Shirt size={18} />, label: '试衣间' },
    { to: '/ecommerce', icon: <ShoppingBag size={18} />, label: '商城' },
  ];

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header__inner">
          <div
            className="app-header__logo"
            onClick={() => navigate('/')}
          >
            <span className="app-header__logo-icon">👗</span>
            <span className="app-header__logo-text">StyleLogic</span>
          </div>

          <nav className="app-header__nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `app-header__nav-item ${isActive ? 'app-header__nav-item--active' : ''}`
                }
                end={item.to === '/'}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.to === '/ecommerce' && cartCount > 0 && (
                  <span className="app-header__nav-badge">{cartCount}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="app-header__right">
            <DataSync showStatus />
            <button className="app-header__user-btn" type="button">
              <User size={18} />
            </button>
            <button
              type="button"
              className="app-header__mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="app-header__mobile-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `app-header__mobile-nav-item ${
                    isActive ? 'app-header__mobile-nav-item--active' : ''
                  }`
                }
                onClick={() => setMobileMenuOpen(false)}
                end={item.to === '/'}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="app-footer__inner">
          <div className="app-footer__copyright">
            © 2026 StyleLogic. 基于 React 构建的虚拟衣橱穿搭系统
          </div>
          <div className="app-footer__tech">
            React + TypeScript + Vite + Zustand + IndexedDB
          </div>
        </div>
      </footer>
    </div>
  );
};
