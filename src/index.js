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

const renovateRegex = /^\| \[([^ ]+)\][^ ]*.*\[`[~^]*(.+)` -> `[~^]*(.+)`\]/m;
const dependabotRegex = /^Bumps \[(.+)\].* from (.+) to (.+)\.$/m;
const greenkeeperRegex = /^## The .+ \[(.+)\].* was updated from `(.+)` to `(.+)`\.$/m;

async function getStats(packageName) {
  return (await spawn('npx', [
    'ember-cli-update',
    'stats',
    ...packageName ? [
      '-b',
      packageName
    ] : []
  ])).stdout;
}

async function getMatch({
  packageName,
  from,
  to,
  ignoreTo
}) {
  let escapeSemVer = str => str.replace(/\./g, '\\.');

  console.log({ ignoreTo });

  let fromRegex = escapeSemVer(from);
  let toRegex = ignoreTo ? '.+' : escapeSemVer(to);

  console.log({ fromRegex, toRegex });

  let stats;
  let regex;

  if (packageName === 'ember-cli') {
    stats = await module.exports.getStats();

    regex = new RegExp(`^package name: ember-cli\nblueprint name: (.+)\ncurrent version: ${fromRegex}\nlatest version: ${toRegex}`);
  } else {
    stats = await module.exports.getStats(packageName);

    regex = new RegExp(`^package name: .+\n(?:package location: .+\n)?blueprint name: (.+)\ncurrent version: ${fromRegex}\nlatest version: ${toRegex}`);
  }

  console.log({ regex });

  let blueprintName;

  let matches = stats.match(regex);
  if (matches) {
    blueprintName = matches[1];
  }

  return {
    isMatch: !!matches,
    blueprintName
  };
}

async function emberCliUpdateAction({
  body,
  installCommand,
  autofixCommand,
  gitEmail,
  gitName,
  amend,
  ignoreTo,
  commitPrefix = ''
}) {
  let { name, version } = require('../package');
  console.log({ name, version });

  console.log({ body });

  let matches;

  if (body) {
    // renovate style
    matches = body.match(renovateRegex);

    if (!matches) {
      // dependabot style
      matches = body.match(dependabotRegex);
    }

    if (!matches) {
      // greenkeeper style
      matches = body.match(greenkeeperRegex);
    }
  }

  if (!matches) {
    console.log('not a blueprint');
    return;
  }

  let [, packageName, from, to] = matches;

  console.log({ packageName, from, to });

  let {
    isMatch,
    blueprintName
  } = await getMatch({
    packageName,
    from,
    to,
    ignoreTo
  });

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
      } else {
        let hasPnpmLock = await fs.pathExists('pnpm-lock.yaml');

        console.log({ hasPnpmLock });

        if (hasPnpmLock) {
          await spawn('pnpm', [
            'install',
            '--frozen-lockfile=false'
          ]);
        }
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
      `${commitPrefix}${name}

${updateArgs.join(' ')}`
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
module.exports.renovateRegex = renovateRegex;
module.exports.dependabotRegex = dependabotRegex;
module.exports.greenkeeperRegex = greenkeeperRegex;
module.exports.getStats = getStats;
module.exports.getMatch = getMatch;
