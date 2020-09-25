module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  testTimeout: 10000,
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.test.json',
    },
  },
};
