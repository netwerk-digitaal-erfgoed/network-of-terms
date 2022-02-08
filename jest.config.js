export default {
  roots: ['test/'],
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.72,
      statements: 96.83,
      branches: 100,
      functions: 94.39,
    },
  },
  transform: {},
};
