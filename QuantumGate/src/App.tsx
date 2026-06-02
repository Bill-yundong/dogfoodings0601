import { Component, createEffect } from 'solid-js';
import { Router, Route, useNavigate, useLocation, A } from '@solidjs/router';
import { ParticleBackground } from '@/components/ParticleBackground';
import { Dashboard } from '@/pages/Dashboard';
import { RabiOscillation } from '@/pages/RabiOscillation';
import { Fidelity } from '@/pages/Fidelity';
import { ErrorCorrection } from '@/pages/ErrorCorrection';
import { Settings } from '@/pages/Settings';

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

const AppLayout: Component<{ children: any }> = (props) => {
  const location = useLocation();

  return (
    <div class="h-screen w-screen flex overflow-hidden bg-quantum-dark grid-bg">
      <ParticleBackground />
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
                  </A>
                </li>
              );
            })}
          </ul>
        </nav>

        <div class="p-4 border-t border-white/10">
          <div class="p-3 bg-quantum-green/10 border border-quantum-green/30 rounded-lg">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-quantum-green animate-pulse" />
              <span class="text-quantum-green text-xs font-mono">系统在线</span>
            </div>
            <p class="text-white/50 text-xs font-mono">已连接至量子硬件模块</p>
          </div>
        </div>
      </aside>
      <main class="flex-1 overflow-hidden relative z-10">
        {props.children}
      </main>
    </div>
  );
};

const RedirectToDashboard = () => {
  const navigate = useNavigate();
  createEffect(() => {
    navigate('/dashboard', { replace: true });
  });
  return null;
};

const App: Component = () => {
  return (
    <Router>
      <Route path="/" component={RedirectToDashboard} />
      <Route path="/dashboard" component={() => <AppLayout><Dashboard /></AppLayout>} />
      <Route path="/rabi-oscillation" component={() => <AppLayout><RabiOscillation /></AppLayout>} />
      <Route path="/fidelity" component={() => <AppLayout><Fidelity /></AppLayout>} />
      <Route path="/error-correction" component={() => <AppLayout><ErrorCorrection /></AppLayout>} />
      <Route path="/settings" component={() => <AppLayout><Settings /></AppLayout>} />
    </Router>
  );
};

export default App;
