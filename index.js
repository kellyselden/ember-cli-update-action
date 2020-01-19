'use strict';

const core = require('@actions/core');
const github = require('@actions/github');

(async() => {
  try {
    // `who-to-greet` input defined in action metadata file
    let nameToGreet = core.getInput('who-to-greet');
    let time = new Date().toTimeString();
    core.setOutput('time', time);
    // Get the JSON webhook payload for the event that triggered the workflow
    let payload = JSON.stringify(github.context.payload, undefined, 2);
  } catch (error) {
    core.setFailed(error.message);
  }
})();
