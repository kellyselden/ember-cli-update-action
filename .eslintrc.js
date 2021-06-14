'use strict';

module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020
  },
  env: {
    es6: true
  },
  extends: [
    'sane-node'
  ],
  rules: {
    'no-console': 'off'
  },
  overrides: [
    {
      files: [
        'test/**/*-test.js'
      ],
      env: {
        mocha: true
      },
      plugins: [
        'mocha'
      ],
      extends: [
        'plugin:mocha/recommended'
      ],
      rules: {
        'mocha/no-exclusive-tests': 'error'
      }
    }
  ]
};
