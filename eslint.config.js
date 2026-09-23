const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  // App config runs in Node, where environment values are read at execution time.
  { files: ['app.config.ts'], rules: { 'expo/no-dynamic-env-var': 'off' } },
  { ignores: ['coverage/*', 'dist/*', '.expo/*'] },
]);
