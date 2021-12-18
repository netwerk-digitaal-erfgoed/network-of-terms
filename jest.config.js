module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.82,
      statements: 96.93,
      branches: 99.14,
      functions: 93.75,
    },
  },
};
