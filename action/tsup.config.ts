import { defineConfig } from 'tsup';

export default defineConfig({
  entry:      ['src/index.ts'],
  format:     ['cjs'],
  outDir:     'dist',
  target:     'node20',
  clean:      true,
  splitting:  false,
  sourcemap:  false,
  minify:     true,
  // Bundle @actions/core into the output so the action
  // works without a node_modules install step in the runner
  noExternal: ['@actions/core'],
});
