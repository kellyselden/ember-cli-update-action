'use strict';

const core = require('@actions/core');
const github = require('@actions/github');
const execa = require('execa');
const yn = require('yn');

function spawn(bin, args, options) {
  console.log(...[[bin, ...args].join(' '), options].filter(Boolean));

  let ps = execa(bin, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options
  });

  ps.stdout.pipe(process.stdout);

  return ps;
}

async function exec(command, options) {
  console.log(...[command, options].filter(Boolean));

  let ps = execa.command(command, {
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options
  });

  ps.stdout.pipe(process.stdout);

  return ps;
}

(async() => {
  try {
    // Get the JSON webhook payload for the event that triggered the workflow
    // const payload = JSON.stringify(github.context.payload, undefined, 2)
    // console.log(`The event payload: ${payload}`);

    let { body } = github.context.payload.pull_request;

    console.log({ body });

    // renovate style
    let matches = body.match(/^\| \[([^ ]+)\][^ ]*.*\[`(.+)` -> `(.+)`\]/m);

    if (!matches) {
      // dependabot style
      matches = body.match(/^Bumps \[(.+)\].* from (.+) to (.+)\.$/m);
    }

    if (!matches) {
      // greenkeeper style
      matches = body.match(/^## The .+ \[(.+)\].* was updated from `(.+)` to `(.+)`\.$/m);
    }

    if (!matches) {
      console.log('not a blueprint');
      return;
    }

    let [, packageName, from, to] = matches;

    console.log({ packageName, from, to });

    let stats = (await spawn('npx', [
      'ember-cli-update',
      'stats',
      '-b',
      packageName
    ])).stdout;

    if (stats !== `${packageName}, current: ${from}, latest: ${to}`) {
      console.log('not a blueprint match');
      return;
    }

    await spawn('npx', [
      'ember-cli-update',
      '-b',
      packageName,
      '--to',
      to
    ]);

    let status = (await spawn('git', [
      'status',
      '--porcelain'
    ])).stdout;

    if (!status) {
      return;
    }

    await spawn('npm', [
      'install'
    ]);

    let autoFixCommand = core.getInput('autofix_command');
    if (autoFixCommand) {
      await exec(autoFixCommand);
    }

    let gitEmail = core.getInput('git_email');
    let gitName = core.getInput('git_name');

    if (!gitEmail) {
      gitEmail = (await spawn('git', [
        'show',
        '-s',
        '--format=%ae'
      ])).stdout;
    }

    if (!gitName) {
      gitName = (await spawn('git', [
        'show',
        '-s',
        '--format=%an'
      ])).stdout;
    }

    await spawn('git', [
      'config',
      'user.email',
      `"${gitEmail}"`
    ]);

    await spawn('git', [
      'config',
      'user.name',
      `"${gitName}"`
    ]);

    await spawn('git', [
      'add',
      '-A'
    ]);

    let amend = core.getInput('amend');

    console.log({ amend });

    if (yn(amend)) {
      await spawn('git', [
        'commit',
        '--amend',
        '--no-edit'
      ]);
    } else {
      await spawn('git', [
        'commit',
        '-m',
        `ember-cli-update -b ${packageName} --to ${to}`
      ]);
    }

    await spawn('git', [
      'push',
      '-f'
    ]);
  } catch (err) {
    core.setFailed(err.message);
  }
})();
