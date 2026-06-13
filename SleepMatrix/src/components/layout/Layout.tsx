import { A, useLocation } from '@solidjs/router'
import {
  Activity,
  BarChart3,
  Clock,
  Settings,
  Database,
  Moon,
  Zap,
} from 'lucide-solid'
import type { Component } from 'solid-js'

const navItems = [
  { path: '/', label: '实时监测', icon: Activity },
  { path: '/analysis', label: '关联分析', icon: BarChart3 },
  { path: '/timeline', label: '睡眠轨迹', icon: Clock },
  { path: '/control', label: '硬件控制', icon: Zap },
  { path: '/data', label: '数据管理', icon: Database },
]

const Layout: Component<{ children?: any }> = (props) => {
  const location = useLocation()

  return (
    <div class="flex h-full w-full">
      <aside class="w-64 flex-shrink-0 glass-card m-4 mr-0 flex flex-col overflow-hidden">
        <div class="p-6 border-b border-white/10">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-dream-purple to-calm-cyan flex items-center justify-center animate-glow">
              <Moon class="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 class="text-lg font-bold gradient-text">SleepMatrix</h1>
              <p class="text-xs text-slate-400">睡眠环境分析系统</p>
            </div>
          </div>
        </div>

        <nav class="flex-1 py-4 overflow-y-auto scrollbar-thin">
          <ul class="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon
              return (
                <li>
                  <A
                    href={item.path}
                    class={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      isActive
                        ? 'bg-dream-purple/20 text-dream-purple border border-dream-purple/30 glow-border'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon class="w-5 h-5" />
                    <span class="text-sm font-medium">{item.label}</span>
                  </A>
                </li>
              )
            })}
          </ul>
        </nav>

        <div class="p-4 border-t border-white/10">
          <div class="glass-card p-4 rounded-xl">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-calm-cyan to-dream-purple flex items-center justify-center">
                <Settings class="w-4 h-4 text-white" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">系统状态</p>
                <p class="text-xs text-emerald-400">● 在线运行中</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main class="flex-1 overflow-auto p-4 scrollbar-thin">
        {props.children}
      </main>
    </div>
  )
}

export default Layout
