module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.4,
      statements: 96.08,
      branches: 98.85,
      functions: 91.57,
    },
  },
};
