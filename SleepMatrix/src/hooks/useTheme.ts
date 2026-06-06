import { createSignal, onMount } from 'solid-js';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = createSignal<Theme>('dark');

  onMount(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    } else {
      setTheme('light');
    }

    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme());
    localStorage.setItem('theme', theme());
  });

  const toggleTheme = () => {
    const newTheme = theme() === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return {
    theme,
    toggleTheme,
    isDark: () => theme() === 'dark'
  };
} 
