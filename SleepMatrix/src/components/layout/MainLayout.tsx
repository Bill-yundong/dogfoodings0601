import { Component, ParentProps } from 'solid-js';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface MainLayoutProps extends ParentProps {
  class?: string;
}

export const MainLayout: Component<MainLayoutProps> = (props) => {
  return (
    <div class="flex h-screen bg-midnight-950 overflow-hidden">
      <Sidebar />
      <div class="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main class={cn(
          'flex-1 overflow-y-auto p-6',
          'bg-gradient-to-br from-midnight-950 via-midnight-900/50 to-midnight-950',
          props.class
        )}>
          {props.children}
        </main>
      </div>
    </div>
  );
};
