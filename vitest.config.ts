import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*/vite.config.ts'],
    coverage: {
      enabled: true,
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        autoUpdate: true,
        lines: 73.08,
        functions: 72.59,
        branches: 59.12,
        statements: 73.48,
      },
    },
  },
});