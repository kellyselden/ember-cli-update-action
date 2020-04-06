'use strict';

const core = require('@actions/core');
const github = require('@actions/github');
const emberCliUpdateAction = require('.');
const yn = require('yn');

(async() => {
  try {
    let { name, version } = require('../package');
    console.log({ name, version });

    // Get the JSON webhook payload for the event that triggered the workflow
    // let payload = JSON.stringify(github.context.payload, undefined, 2);
    // console.log(`The event payload: ${payload}`);

    let { body } = github.context.payload.pull_request;

    let installCommand = core.getInput('install_command');

    let autofixCommand = core.getInput('autofix_command');

    let gitEmail = core.getInput('git_email');
    let gitName = core.getInput('git_name');

    let amend = yn(core.getInput('amend'));

    let ignoreTo;
    console.log('process.env.EMBER_CLI_UPDATE_ACTION_IGNORE_TO', process.env.EMBER_CLI_UPDATE_ACTION_IGNORE_TO);
    // eslint-disable-next-line quotes
    console.log(`'EMBER_CLI_UPDATE_ACTION_IGNORE_TO' in process.env`, process.env.EMBER_CLI_UPDATE_ACTION_IGNORE_TO);
    // eslint-disable-next-line quotes
    console.log(`core.getInput('ignore_to')`, core.getInput('ignore_to'));
    if ('EMBER_CLI_UPDATE_ACTION_IGNORE_TO' in process.env) {
      ignoreTo = process.env.EMBER_CLI_UPDATE_ACTION_IGNORE_TO;
    } else {
      ignoreTo = core.getInput('ignore_to');
    }
    console.log({ ignoreTo });
    // eslint-disable-next-line quotes
    console.log(`yn(ignoreTo)`, yn(ignoreTo));
    ignoreTo = yn(ignoreTo);

    await emberCliUpdateAction({
      body,
      installCommand,
      autofixCommand,
      gitEmail,
      gitName,
      amend,
      ignoreTo
    });
  } catch (err) {
    core.setFailed(err.message);
  }
})();
