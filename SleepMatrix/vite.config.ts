import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

export default defineConfig({
  build: {
    sourcemap: 'hidden',
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  plugins: [
    solid({
      solid: {
        generate: 'dom',
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }),
    tsconfigPaths()
  ],
  worker: {
    format: 'es',
  },
})
