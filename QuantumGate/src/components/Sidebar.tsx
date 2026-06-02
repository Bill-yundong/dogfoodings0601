import { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: '监控仪表盘', icon: '📊' },
  { path: '/rabi-oscillation', label: '拉比振荡', icon: '📈' },
  { path: '/fidelity', label: '保真度计算', icon: '⚛️' },
  { path: '/error-correction', label: '量子纠错', icon: '🔄' },
  { path: '/settings', label: '系统设置', icon: '⚙️' },
];

export const Sidebar: Component = () => {
  const location = useLocation();

  return (
    <aside class="w-64 h-full glass-card border-r border-quantum-cyan/20 flex flex-col">
      <div class="p-6 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-quantum-cyan/20 flex items-center justify-center text-2xl">
            ⚛️
          </div>
          <div>
            <h1 class="text-lg font-display font-bold text-white neon-text">QuantumGate</h1>
            <p class="text-xs text-quantum-cyan/70 font-mono">v1.0.0</p>
          </div>
        </div>
      </div>

      <nav class="flex-1 p-4 overflow-y-auto">
        <ul class="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li>
                <A
                  href={item.path}
                  class={`
                    flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300
                    ${isActive 
                      ? 'bg-quantum-cyan/20 text-quantum-cyan border border-quantum-cyan/30' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                    }
                  `}
                >
                  <span class="text-xl">{item.icon}</span>
                  <span class="font-mono text-sm">{item.label}</span>
                  {isActive && <span class="ml-auto w-1.5 h-1.5 rounded-full bg-quantum-cyan animate-pulse" />}
                </A>
              </li>
            );
          })}
        </ul>
      </nav>

      <div class="p-4 border-t border-white/10">
        <div class="flex items-center gap-3 px-4 py-3 rounded-md bg-white/5">
          <div class="w-8 h-8 rounded-full bg-quantum-purple/30 flex items-center justify-center text-sm">
            👤
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white truncate">研究员</p>
            <p class="text-xs text-white/50 font-mono truncate">research@quantum-lab</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
