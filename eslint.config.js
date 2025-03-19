module.exports = [
    {
      files: ['**/*.js'],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'commonjs',
      },
      rules: {
        'semi': ['error', 'always'],
        'quotes': ['error', 'single'],
        'no-unused-vars': 'warn',
        'no-console': 'off',
      },
    },
  ];