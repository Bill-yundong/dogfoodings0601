import { Component, For } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import { routes } from './router';
import { configStore } from './stores/config';
import { cn } from './lib/utils';

const App: Component = () => {
  return (
    <div class={cn(
      'min-h-screen antialiased',
      configStore.config.theme === 'dark' ? 'dark' : 'light'
    )}>
      <Router>
        <For each={routes}>{(route) => (
          <Route path={route.path} component={route.component} />
        )}</For>
      </Router>
    </div>
  );
};

export default App;
