import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

// WHY: Bundler settings are isolated here to keep package.json free of build noise
// and to enable path aliases that mirror TypeScript path mapping.
export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': resolve(currentDirectory, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
