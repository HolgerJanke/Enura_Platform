module.exports = {
  root: true,
  extends: [require.resolve('@enura/config/eslint-base')],
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: '18' },
  },
}
