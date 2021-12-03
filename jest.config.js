module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.73,
      statements: 96.85,
      branches: 99.1,
      functions: 93.68,
    },
  },
};
