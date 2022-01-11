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
      lines: 96.26,
      statements: 96.4,
      branches: 100,
      functions: 93.87,
    },
  },
  transform: {},
};
