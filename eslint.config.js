'use strict';

const {
  defineConfig,
  globalIgnores,
} = require('eslint/config');

const config = require('@kellyselden/eslint-config');

module.exports = defineConfig([
  config,

  {
    rules: {
      'no-console': 'off',
    },
  },
  globalIgnores([
    'dist/',
  ]),
]);
