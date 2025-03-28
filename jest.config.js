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
      statements: 92.25,
      branches: 92.69,
      lines: 92.25,
      functions: 91.66,
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
