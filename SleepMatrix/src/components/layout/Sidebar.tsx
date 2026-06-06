import { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import {
  LayoutDashboard,
  LineChart,
  Archive,
  Settings,
  Cpu,
  BarChart3,
  Moon,
} from 'lucide-solid';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: Component<{ class?: string }>;
}

const navItems: NavItem[] = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/analysis', label: '关联分析', icon: LineChart },
  { path: '/visualize', label: '数据可视化', icon: BarChart3 },
  { path: '/archive', label: '睡眠档案', icon: Archive },
  { path: '/devices', label: '设备管理', icon: Cpu },
  { path: '/settings', label: '系统设置', icon: Settings },
];

export const Sidebar: Component = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside class="w-64 bg-midnight-900/80 backdrop-blur-xl border-r border-midnight-700/50 flex flex-col h-full">
      <div class="p-6 border-b border-midnight-700/50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-moon-500 to-moon-600 flex items-center justify-center shadow-lg shadow-moon-500/30">
            <Moon class="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 class="text-lg font-bold text-white font-display">SleepMatrix</h1>
            <p class="text-xs text-midnight-400">智能睡眠分析</p>
          </div>
        </div>
      </div>

      <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <A
            href={item.path}
            class={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
              isActive(item.path)
                ? 'bg-moon-500/20 text-moon-400 shadow-lg shadow-moon-500/10'
                : 'text-midnight-300 hover:bg-midnight-800/50 hover:text-white'
            )}
          >
            <item.icon
              class={cn(
                'w-5 h-5 transition-transform group-hover:scale-110',
                isActive(item.path) && 'text-moon-400'
              )}
            />
            <span class="font-medium">{item.label}</span>
            {isActive(item.path) && (
              <div class="ml-auto w-1.5 h-1.5 rounded-full bg-moon-400 animate-pulse" />
            )}
          </A>
        ))}
      </nav>

      <div class="p-4 border-t border-midnight-700/50">
        <div class="bg-gradient-to-r from-midnight-800/80 to-midnight-800/40 rounded-xl p-4 backdrop-blur-sm">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-full bg-mint-500/20 flex items-center justify-center">
              <div class="w-3 h-3 rounded-full bg-mint-400 animate-pulse" />
            </div>
            <div>
              <p class="text-sm font-medium text-white">系统运行中</p>
              <p class="text-xs text-midnight-400">实时数据流正常</p>
            </div>
          </div>
          <div class="flex gap-2">
            <div class="flex-1 bg-midnight-900/60 rounded-lg px-2 py-1.5 text-center">
              <p class="text-[10px] text-midnight-400">CPU</p>
              <p class="text-sm font-semibold text-mint-400">23%</p>
            </div>
            <div class="flex-1 bg-midnight-900/60 rounded-lg px-2 py-1.5 text-center">
              <p class="text-[10px] text-midnight-400">内存</p>
              <p class="text-sm font-semibold text-moon-400">412MB</p>
            </div>
            <div class="flex-1 bg-midnight-900/60 rounded-lg px-2 py-1.5 text-center">
              <p class="text-[10px] text-midnight-400">连接</p>
              <p class="text-sm font-semibold text-amber-400">4</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
