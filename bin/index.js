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

const { promisify } = require('util');
const request = promisify(require('request'));

(async() => {
  let {
    body,
    pullRequestUrl
  } = argv;

  if (!body) {
    console.log({ pullRequestUrl });

    let response = await request({
      url: pullRequestUrl,
      headers: {
        'User-Agent': require('../package').name
      },
      json: true
    });

    console.log({ response });

    argv.body = response.body.body;
  }

  await emberCliUpdateAction(argv);
})();

// https://medium.com/@dtinth/making-unhandled-promise-rejections-crash-the-node-js-process-ffc27cfcc9dd
process.on('unhandledRejection', up => {
  throw up;
});
