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
        lines: 74.4,
        functions: 95.55,
        branches: 84.21,
        statements: 74.8,
      },
    },
  },
}));
