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
      lines: 89.15,
      statements: 89.09,
      branches: 91.35,
      functions: 87.28,
    },
  },
  transform: {},
  moduleNameMapper: {
    '^@netwerk-digitaal-erfgoed/(.*)$': '<rootDir>/packages/$1/src/',
  },
};
