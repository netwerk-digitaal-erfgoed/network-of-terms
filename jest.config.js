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
      lines: 96.73,
      statements: 96.84,
      branches: 100,
      functions: 94.39,
    },
  },
  transform: {},
};
