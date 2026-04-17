import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  // Don't bundle node_modules — Cloud Run / Docker installs them via npm ci
  // This avoids issues with native modules (mongoose) and keeps bundle small
  external: [/node_modules/],
});
