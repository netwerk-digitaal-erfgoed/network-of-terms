module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  testTimeout: 30000,
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
};
