import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/query',
  plugins: [nxReadySignal()],
  test: {
    watch: false,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      enabled: true,
      reporter: ['text'],
      provider: 'v8' as const,
      // Test helpers that other packages' suites exercise, not code under test.
      exclude: ['src/test-utils.ts'],
      thresholds: {
        autoUpdate: true,
        lines: 90.94,
        functions: 86,
        branches: 82,
        statements: 90.7,
      },
    },
  },
}));
