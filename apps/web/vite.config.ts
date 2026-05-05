import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // AudioWorklet modules must be served as standalone files. Browsers do
    // not reliably support data: URLs in audioWorklet.addModule().
    assetsInlineLimit: (filePath) => (filePath.includes('chunk-worklet') ? false : undefined),
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
