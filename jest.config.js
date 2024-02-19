export default {
  preset: 'ts-jest/presets/default-esm',
  testTimeout: 60000,
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverage: true,
  coverageProvider: 'v8', // 'v8' instead of default 'babel' for better support of new Node features.
  coverageReporters: ['json-summary', 'text'],
  collectCoverageFrom: [
    '**/src/**/*.ts', // Include files that are not covered by tests.
    '!**/src/**/*.d.ts', // Don't show d.ts files on code coverage overview.
  ],
  coverageThreshold: {
    global: {
      lines: 91,
      statements: 91,
      branches: 95.93,
      functions: 91.52,
    },
  },
  transform: {
    '^.+\\.ts?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^@netwerk-digitaal-erfgoed/(.*)$': '<rootDir>/packages/$1/src/',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
