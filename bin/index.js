#!/usr/bin/env node
'use strict';

const emberCliUpdateAction = require('../src');

const { argv } = require('yargs')
  .options({
    'body': {
      type: 'string'
    },
    'pull-request-url': {
      type: 'string'
    },
    'install-command': {
      type: 'string'
    },
    'autofix-command': {
      type: 'string'
    },
    'git-email': {
      type: 'string'
    },
    'git-name': {
      type: 'string'
    },
    'amend': {
      type: 'boolean'
    }
  });

(async() => {
  await emberCliUpdateAction(argv);
})();

// https://medium.com/@dtinth/making-unhandled-promise-rejections-crash-the-node-js-process-ffc27cfcc9dd
process.on('unhandledRejection', up => {
  throw up;
});
