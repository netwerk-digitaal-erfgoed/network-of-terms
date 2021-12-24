module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.84,
      statements: 96.94,
      branches: 99.14,
      functions: 93.88,
    },
  },
};
