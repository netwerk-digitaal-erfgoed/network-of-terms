export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [2, 'always', 150],
    'subject-case': [2, 'always', ['sentence-case', 'lower-case']],
  },
  ignores: [
    (message: string) =>
      message.includes('Signed-off-by: dependabot[bot] <support@github.com>'),
  ],
};
