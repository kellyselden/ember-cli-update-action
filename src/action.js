'use strict';

const core = require('@actions/core');
const github = require('@actions/github');
const emberCliUpdateAction = require('.');
const yn = require('yn');

(async() => {
  try {
    // Get the JSON webhook payload for the event that triggered the workflow
    // let payload = JSON.stringify(github.context.payload, undefined, 2);
    // console.log(`The event payload: ${payload}`);

    let { body } = github.context.payload.pull_request;

    let installCommand = core.getInput('install_command');

    let autofixCommand = core.getInput('autofix_command');

    let gitEmail = core.getInput('git_email');
    let gitName = core.getInput('git_name');

    let amend = yn(core.getInput('amend'));

    let ignoreTo = yn(core.getInput('ignore_to'));

    let commitPrefix = core.getInput('commit_prefix');

    await emberCliUpdateAction({
      body,
      installCommand,
      autofixCommand,
      gitEmail,
      gitName,
      amend,
      ignoreTo,
      commitPrefix
    });
  } catch (err) {
    core.setFailed(err.message);
  }
})();
