'use strict';

const core = require('@actions/core');
const github = require('@actions/github');
const execa = require('execa');

function run(bin, args, options) {
  console.log(...[[bin, ...args].join(' '), options].filter(Boolean));

  let ps = execa(bin, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options
  });

  ps.stdout.pipe(process.stdout);

  return ps;
}

(async() => {
  try {
    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`);

    await run('npx', [
      'ember-cli-update',
      '-b=@kellyselden/node-template'
    ]);

    let status = (await run('git', [
      'status',
      '--porcelain'
    ])).stdout;

    if (!status) {
      return;
    }

    await run('npm', [
      'install'
    ]);

    await run('npm', [
      'run',
      'lint',
      '--',
      '--fix'
    ]);

    let gitEmail = core.getInput('git_email');
    let gitName = core.getInput('git_name');

    if (!gitEmail) {
      gitEmail = (await run('git', [
        'show',
        '-s',
        '--format=%ae'
      ])).stdout;
    }

    if (!gitName) {
      gitName = (await run('git', [
        'show',
        '-s',
        '--format=%an'
      ])).stdout;
    }

    await run('git', [
      'config',
      '--global',
      'user.email',
      `"${gitEmail}"`
    ]);

    await run('git', [
      'config',
      '--global',
      'user.name',
      `"${gitName}"`
    ]);

    await run('git', [
      'add',
      '-A'
    ]);

    await run('git', [
      'commit',
      '--amend',
      '--no-edit'
    ]);

    await run('git', [
      'push',
      '-f'
    ]);
  } catch (err) {
    core.setFailed(err.message);
  }
})();
