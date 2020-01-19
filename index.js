'use strict';

const core = require('@actions/core');
const github = require('@actions/github');
const execa = require('execa');

function run(bin, args, options) {
  let ps = execa(bin, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options
  });

  ps.stdout.pipe(process.stdout);

  return ps;
}

(async() => {
  try {
    let email = (await run('git', [
      'show',
      '-s',
      '--format=\'%ae\''
    ])).stdout;

    if (email === '\'you@example.com\'') {
      console.log('This is the second commit.');
      return;
    }

    await run('npx', [
      'ember-cli-update',
      '-b=@kellyselden/node-template'
    ]);

    await run('npm', [
      'install'
    ]);

    await run('npm', [
      'run',
      'lint',
      '--',
      '--fix'
    ]);

    await run('git', [
      'add',
      '-A'
    ]);

    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`);

    await run('git', [
      'config',
      '--global',
      'user.email',
      '"you@example.com"'
    ]);

    await run('git', [
      'config',
      '--global',
      'user.name',
      '"Your Name"'
    ]);

    await run('git', [
      'commit',
      '-m',
      '"@kellyselden/node-template"'
    ]);

    await run('git', [
      'push'
    ]);
  } catch (error) {
    core.setFailed(error.message);
  }
})();
