/** Configures React bundling, relative build paths, and the local development server. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/__runner': {
        target: 'http://127.0.0.1:5180',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__runner/, ''),
      },
    },
  },
});
