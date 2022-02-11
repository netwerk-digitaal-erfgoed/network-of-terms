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
      lines: 97,
      statements: 97.09,
      branches: 100,
      functions: 94.73,
    },
  },
  transform: {},
};
