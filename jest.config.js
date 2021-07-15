module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 95.36,
      statements: 94.97,
      branches: 98.33,
      functions: 88.71,
    },
  },
};
