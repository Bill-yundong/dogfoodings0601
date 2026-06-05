import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Calculator,
  PiggyBank,
  TrendingUp,
  Settings,
  Menu,
  X,
  LockKeyhole,
} from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/transactions', icon: Receipt, label: '记账' },
  { path: '/tax', icon: Calculator, label: '税务' },
  { path: '/investments', icon: PiggyBank, label: '理财' },
  { path: '/simulator', icon: TrendingUp, label: '复利模拟' },
  { path: '/settings', icon: Settings, label: '设置' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={{ width: collapsed ? 80 : 260 }}
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative h-screen glass-card border-r border-primary-200/30 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-primary-200/20">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center">
              <LockKeyhole className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg gradient-text">FinanceNexus</h1>
              <p className="text-xs text-primary-400">智能财务管理</p>
            </div>
          </motion.div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-primary-100/50 transition-colors"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item, index) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/20 to-sky-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'hover:bg-primary-100/50 text-primary-400 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`w-5 h-5 flex-shrink-0 transition-transform ${
                    isActive ? 'scale-110' : 'group-hover:scale-110'
                  }`}
                />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="font-medium text-sm whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-primary-200/20">
          <div className="glass-card-hover rounded-xl p-4">
            <p className="text-xs text-primary-400 mb-2">数据安全</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-emerald-400">本地加密存储</span>
            </div>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
