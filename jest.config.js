module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.81,
      statements: 96.91,
      branches: 99.14,
      functions: 93.75,
    },
  },
};
