import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/graphql',
  plugins: [nxReadySignal()],
  test: {
    watch: false,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Well above the 6 s that the tests of the timeout source wait, on a busy CI runner too.
    testTimeout: 20_000,
    // Load the shipped catalog, not one from CATALOG_PATH in the developer’s shell.
    env: { CATALOG_PATH: '' },
    coverage: {
      enabled: true,
      reporter: ['text'],
      provider: 'v8' as const,
      thresholds: {
        // Not auto-updated: see the note on `branches`.
        autoUpdate: false,
        lines: 100,
        functions: 100,
        // Below what a run reaches, not at it: the `genres` resolver’s fallback branch is taken only
        // when the genre lookup over the network fails, so the measured figure moves between 95.8
        // and 97.2 from one run to the next, which is why autoUpdate is off for this package.
        branches: 95.5,
        statements: 100,
      },
    },
  },
}));
