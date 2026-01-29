import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/query',
  plugins: [],
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      enabled: true,
      reporter: ['text'],
      provider: 'v8' as const,
      thresholds: {
        autoUpdate: true,
        lines: 56.81,
        functions: 40.25,
        branches: 91.22,
        statements: 56.81,
      },
    },
  },
}));