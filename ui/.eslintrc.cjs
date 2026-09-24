/**
 * ESLint config for the Electron UI
 * 规则取向：真正的错误（未定义变量、Hook 违规）拦截；
 * 风格类问题（未用变量等）告警，不阻塞构建。
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    '*.config.ts',
    '*.config.js',
    'postcss.config.js',
  ],
};
