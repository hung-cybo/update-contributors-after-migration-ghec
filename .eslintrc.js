module.exports = {
  extends: [
    'eslint:recommended',
    'eslint-config-prettier'
  ],
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    // Allow console.log for CLI scripts
    'no-console': 'off',
    // Allow unused variables in function parameters
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Allow async functions without await
    'require-await': 'warn',
  },
};