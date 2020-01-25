'use strict';

const execa = require('execa');
const yn = require('yn');
const fs = require('fs-extra');
const { promisify } = require('util');
const request = promisify(require('request'));

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

async function emberCliUpdateAction({
  body,
  pullRequestUrl,
  installCommand,
  autoFixCommand,
  gitEmail,
  gitName,
  amend
}) {
  if (!body) {
    console.log({ pullRequestUrl });

    let response = await request({
      url: pullRequestUrl,
      json: true
    });

    console.log({ response });

    body = response.body.body;
  }

  console.log({ body });

  let matches;

  if (body) {
    // renovate style
    matches = body.match(/^\| \[([^ ]+)\][^ ]*.*\[`(.+)` -> `(.+)`\]/m);

    if (!matches) {
      // dependabot style
      matches = body.match(/^Bumps \[(.+)\].* from (.+) to (.+)\.$/m);
    }

    if (!matches) {
      // greenkeeper style
      matches = body.match(/^## The .+ \[(.+)\].* was updated from `(.+)` to `(.+)`\.$/m);
    }
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

  console.log({ installCommand });

  if (installCommand) {
    await exec(installCommand);
  } else {
    let hasPackageLock = await fs.pathExists('package-lock.json');

    console.log({ hasPackageLock });

    if (hasPackageLock) {
      await spawn('npm', [
        'install'
      ]);
    } else {
      let hasYarnLock = await fs.pathExists('yarn.lock');

      console.log({ hasYarnLock });

      if (hasYarnLock) {
        await spawn('yarn');
      }
    }
  }

  console.log({ autoFixCommand });

  if (autoFixCommand) {
    await exec(autoFixCommand);
  }

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
}

module.exports = emberCliUpdateAction;
