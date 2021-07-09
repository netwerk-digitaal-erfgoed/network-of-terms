module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 93.05,
      statements: 92.71,
      branches: 80.36,
      functions: 82.76,
    },
  },
};
