import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Figma loads `dist/ui.html` inside an iframe (non-root URL).
 * - `base: './'` → asset URLs are always `./assets/...`, never `/assets/...`.
 * - `inlineDynamicImports` → one JS bundle (no lazy chunks with fragile relative paths).
 */
export default defineConfig({
  base: './',
  root: path.resolve(__dirname, 'src/ui'),
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  plugins: [react()],
  build: {
    target: 'es2017',
    outDir: path.resolve(__dirname, 'dist'),
    assetsDir: 'assets',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        ui: path.resolve(__dirname, 'src/ui/ui.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
        inlineDynamicImports: true,
      },
    },
  },
});
