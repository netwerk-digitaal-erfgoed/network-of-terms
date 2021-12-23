module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.85,
      statements: 96.95,
      branches: 99.14,
      functions: 93.88,
    },
  },
};
