import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/graphql',
  plugins: [],
  test: {
    watch: false,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    testTimeout: 10_000,
    coverage: {
      enabled: true,
      reporter: ['text'],
      provider: 'v8' as const,
      thresholds: {
        autoUpdate: true,
        lines: 100,
        functions: 100,
        // Below what a run reaches, not at it: the `genres` resolver’s fallback branch is taken only
        // when the genre lookup over the network fails, so the measured figure moves between 95.8
        // and 97.2 from one run to the next. autoUpdate raises this on a lucky local run; do not
        // commit that.
        branches: 95.5,
        statements: 100,
      },
    },
  },
}));
