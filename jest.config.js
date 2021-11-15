module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.47,
      statements: 96.54,
      branches: 99.03,
      functions: 92.86,
    },
  },
};
