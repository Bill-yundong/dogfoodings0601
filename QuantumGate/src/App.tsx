import { Component } from 'solid-js';
import { Router, Route, useNavigate } from '@solidjs/router';
import { Sidebar } from '@/components/Sidebar';
import { ParticleBackground } from '@/components/ParticleBackground';
import { Dashboard } from '@/pages/Dashboard';
import { RabiOscillation } from '@/pages/RabiOscillation';
import { Fidelity } from '@/pages/Fidelity';
import { ErrorCorrection } from '@/pages/ErrorCorrection';
import { Settings } from '@/pages/Settings';

const RedirectToDashboard = () => {
  const navigate = useNavigate();
  navigate('/dashboard');
  return null;
};

const App: Component = () => {
  return (
    <Router>
      <div class="h-screen w-screen flex overflow-hidden bg-quantum-dark grid-bg">
        <ParticleBackground />
        <Sidebar />
        <main class="flex-1 overflow-hidden relative z-10">
          <Route path="/" component={RedirectToDashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/rabi-oscillation" component={RabiOscillation} />
          <Route path="/fidelity" component={Fidelity} />
          <Route path="/error-correction" component={ErrorCorrection} />
          <Route path="/settings" component={Settings} />
        </main>
      </div>
    </Router>
  );
};

export default App;
