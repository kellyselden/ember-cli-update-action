#!/usr/bin/env node
'use strict';

const emberCliUpdateAction = require('../src');
const yn = require('yn');

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
    },
    'ignore-to': {
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

    let { GITHUB_TOKEN } = process.env;

    let response = await request({
      url: pullRequestUrl,
      headers: {
        'User-Agent': require('../package').name,
        ...GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {}
      },
      json: true
    });

    console.log({ response });

    argv.body = response.body.body;
  }

  console.log('process.env.EMBER_CLI_UPDATE_ACTION_IGNORE_TO', process.env.EMBER_CLI_UPDATE_ACTION_IGNORE_TO);
  // eslint-disable-next-line quotes
  console.log(`'EMBER_CLI_UPDATE_ACTION_IGNORE_TO' in process.env`, process.env.EMBER_CLI_UPDATE_ACTION_IGNORE_TO);
  // eslint-disable-next-line quotes
  console.log(`argv.ignoreTo`, argv.ignoreTo);
  if ('EMBER_CLI_UPDATE_ACTION_IGNORE_TO' in process.env) {
    argv.ignoreTo = yn(process.env.EMBER_CLI_UPDATE_ACTION_IGNORE_TO);
  }
  // eslint-disable-next-line quotes
  console.log(`argv.ignoreTo`, argv.ignoreTo);

  await emberCliUpdateAction(argv);
})();

// https://medium.com/@dtinth/making-unhandled-promise-rejections-crash-the-node-js-process-ffc27cfcc9dd
process.on('unhandledRejection', up => {
  throw up;
});
