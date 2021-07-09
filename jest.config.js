module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 94.65,
      statements: 94.27,
      branches: 89.29,
      functions: 87.93,
    },
  },
};
