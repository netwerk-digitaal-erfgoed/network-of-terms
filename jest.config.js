module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.28,
      statements: 95.97,
      branches: 98.77,
      functions: 91.25,
    },
  },
};
