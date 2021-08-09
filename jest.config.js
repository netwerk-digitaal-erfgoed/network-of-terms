module.exports = {
  roots: ['test/'],
  preset: 'ts-jest',
  testTimeout: 20000,
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.test.json',
    },
  },
};
