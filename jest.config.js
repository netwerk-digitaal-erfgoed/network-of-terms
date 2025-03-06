export default {
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
      lines: 91.74,
      statements: 91.74,
      branches: 1.74,
      functions: 91.08,
    },
  },
  transform: {
    '^.+\\.ts$': '@swc/jest',
  },
  moduleNameMapper: {
    '^@netwerk-digitaal-erfgoed/(.*)$': '<rootDir>/packages/$1/src/',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
