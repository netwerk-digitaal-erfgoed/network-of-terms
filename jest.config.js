export default {
  preset: 'ts-jest/presets/default-esm',
  testTimeout: 60000,
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  collectCoverageFrom: [
    '**/src/**/*.ts', // Include files that are not covered by tests.
    '!**/src/**/*.d.ts', // Don't show d.ts files on code coverage overview.
  ],
  coverageThreshold: {
    global: {
      lines: 88.44,
      statements: 88.32,
      branches: 92.41,
      functions: 85.98,
    },
  },
  transform: {},
  moduleNameMapper: {
    '^@netwerk-digitaal-erfgoed/(.*)$': '<rootDir>/packages/$1/src/',
  },
};
