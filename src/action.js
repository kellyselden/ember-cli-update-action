'use strict';

const core = require('@actions/core');
const github = require('@actions/github');
const emberCliUpdateAction = require('.');

(async() => {
  try {
    // Get the JSON webhook payload for the event that triggered the workflow
    // const payload = JSON.stringify(github.context.payload, undefined, 2)
    // console.log(`The event payload: ${payload}`);

    let { body } = github.context.payload.pull_request;

    let installCommand = core.getInput('install_command');

    let autofixCommand = core.getInput('autofix_command');

    let gitEmail = core.getInput('git_email');
    let gitName = core.getInput('git_name');

    let amend = core.getInput('amend');

    await emberCliUpdateAction({
      body,
      installCommand,
      autofixCommand,
      gitEmail,
      gitName,
      amend
    });
  } catch (err) {
    core.setFailed(err.message);
  }
})();
