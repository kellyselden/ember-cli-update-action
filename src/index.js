'use strict';

const execa = require('execa');
const fs = require('fs-extra');

function spawn(bin, args = [], options) {
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
  installCommand,
  autofixCommand,
  gitEmail,
  gitName,
  amend,
  ignoreTo
}) {
  console.log({ body });

  let matches;

  if (body) {
    // renovate style
    matches = body.match(/^\| \[([^ ]+)\][^ ]*.*\[`[~^]*(.+)` -> `[~^]*(.+)`\]/m);

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

  let escapeSemVer = str => str.replace(/\./, '\\.');

  let fromRegex = escapeSemVer(from);
  let toRegex = ignoreTo ? '.+' : escapeSemVer(to);

  console.log({ fromRegex, toRegex });

  let isMatch;
  let blueprintName;

  if (packageName === 'ember-cli') {
    let stats = (await spawn('npx', [
      'ember-cli-update',
      'stats'
    ])).stdout;

    let regex = new RegExp(`^package name: ember-cli\nblueprint name: (.+)\ncurrent version: ${fromRegex}\nlatest version: ${toRegex}`);

    let matches = stats.match(regex);
    if (matches) {
      isMatch = !!matches;
      blueprintName = matches[1];
    }
  } else {
    let stats = (await spawn('npx', [
      'ember-cli-update',
      'stats',
      '-b',
      packageName
    ])).stdout;

    let regex = new RegExp(`, current: ${fromRegex}, latest: ${toRegex}$`);

    if (stats.startsWith(`${packageName}, `) && regex.test(stats)) {
      isMatch = true;
      blueprintName = packageName;
    }
  }

  if (!isMatch) {
    console.log('not a blueprint match');
    return;
  }

  let updateArgs = [
    'ember-cli-update',
    '-p',
    packageName,
    '-b',
    blueprintName,
    '--to',
    to
  ];

  await spawn('npx', updateArgs);

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

  console.log({ autofixCommand });

  if (autofixCommand) {
    try {
      await exec(autofixCommand);
    } catch (err) {}
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

  if (amend) {
    await spawn('git', [
      'commit',
      '--amend',
      '--no-edit'
    ]);
  } else {
    await spawn('git', [
      'commit',
      '-m',
      updateArgs.join(' ')
    ]);
  }

  let branch = (await spawn('git', [
    'rev-parse',
    '--abbrev-ref',
    'HEAD'
  ])).stdout;

  console.log({ branch });

  await spawn('git', [
    'push',
    'origin',
    branch,
    ...[amend ? '-f' : ''].filter(Boolean)
  ]);
}

module.exports = emberCliUpdateAction;
