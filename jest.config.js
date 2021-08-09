module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.27,
      statements: 95.95,
      branches: 98.77,
      functions: 91.25,
    },
  },
};
