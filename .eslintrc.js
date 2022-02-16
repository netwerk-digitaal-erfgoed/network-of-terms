module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    env: {
        'jest': true,
        'es6': true,
        'node': true
    },
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        '@typescript-eslint/semi': ['error', 'never'],
        '@typescript-eslint/quotes': ['error', 'single'],
    },
};
