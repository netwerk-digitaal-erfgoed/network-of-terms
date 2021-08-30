module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
  coverageThreshold: {
    global: {
      lines: 96.37,
      statements: 96.05,
      branches: 98.85,
      functions: 91.46,
    },
  },
};
