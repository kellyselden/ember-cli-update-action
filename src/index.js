'use strict';

const fs = require('fs-extra');
const path = require('path');

async function spawn(bin, args = [], options) {
  let { execa } = await import('execa');

  let ps = execa(bin, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    verbose: 'full',
    ...options,
  });

  ps.stdout.pipe(process.stdout);

  return ps;
}

async function exec(command, options) {
  let { execaCommand } = await import('execa');

  let ps = execaCommand(command, {
    stdio: ['ignore', 'pipe', 'inherit'],
    verbose: 'full',
    ...options,
  });

  ps.stdout.pipe(process.stdout);

  return ps;
}

const renovateRegex = /^\| \[([^ ]+)\][^ ]*.*\[`[~^]*(.+)` -> `[~^]*(.+)`\]/m;
const dependabotRegex = /^Bumps \[(.+)\].* from (.+) to (.+)\.$/m;
const greenkeeperRegex = /^## The .+ \[(.+)\].* was updated from `(.+)` to `(.+)`\.$/m;

async function getStats({
  cwd,
  packageName,
}) {
  return (await spawn('npx', [
    'ember-cli-update',
    'stats',
    ...packageName ? [
      '-b',
      packageName,
    ] : [],
  ], { cwd })).stdout;
}

async function getMatch({
  cwd,
  packageName,
  from,
  to,
  ignoreTo,
}) {
  let escapeSemVer = str => str.replace(/\./g, '\\.');

  console.log({ ignoreTo });

  let fromRegex = escapeSemVer(from);
  let toRegex = ignoreTo ? '.+' : escapeSemVer(to);

  console.log({ fromRegex, toRegex });

  let stats;
  let regex;

  if (packageName === 'ember-cli') {
    stats = await module.exports.getStats({
      cwd,
    });

    regex = new RegExp(`^package name: ember-cli\nblueprint name: (.+)\ncurrent version: ${fromRegex}\nlatest version: ${toRegex}`);
  } else {
    stats = await module.exports.getStats({
      cwd,
      packageName,
    });

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
    blueprintName,
  };
}

async function emberCliUpdate({
  cwd,
  updateArgs,
}) {
  await spawn('npx', updateArgs, { cwd });
}

async function emberCliUpdateAction({
  cwd = process.cwd(),
  body,
  installCommand,
  autofixCommand,
  gitEmail,
  gitName,
  amend,
  ignoreTo,
  commitPrefix = '',
}) {
  let { name, version } = require('../package');
  console.log({ name, version });

  await spawn('npx', [
    'ember-cli-update',
    '--version',
  ], { cwd });

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
    blueprintName,
  } = await getMatch({
    cwd,
    packageName,
    from,
    to,
    ignoreTo,
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
    to,
  ];

  await module.exports.emberCliUpdate({
    cwd,
    updateArgs,
  });

  let status = (await spawn('git', [
    'status',
    '--porcelain',
  ], { cwd })).stdout;

  if (!status) {
    return;
  }

  console.log({ installCommand });

  if (installCommand) {
    await exec(installCommand, { cwd });
  } else {
    let hasPackageLock = await fs.pathExists(path.join(cwd, 'package-lock.json'));

    console.log({ hasPackageLock });

    if (hasPackageLock) {
      await spawn('npm', [
        'install',

        // https://github.com/npm/cli/issues/5222
        '--force',
      ], { cwd });
    } else {
      let hasYarnLock = await fs.pathExists(path.join(cwd, 'yarn.lock'));

      console.log({ hasYarnLock });

      if (hasYarnLock) {
        await spawn('yarn', { cwd });
      } else {
        let hasPnpmLock = await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'));

        console.log({ hasPnpmLock });

        if (hasPnpmLock) {
          await spawn('pnpm', [
            'install',
            '--frozen-lockfile=false',
          ], { cwd });
        }
      }
    }
  }

  console.log({ autofixCommand });

  if (autofixCommand) {
    try {
      await exec(autofixCommand, { cwd });
    } catch {}
  }

  if (!gitEmail) {
    gitEmail = (await spawn('git', [
      'show',
      '-s',
      '--format=%ae',
    ], { cwd })).stdout;
  }

  if (!gitName) {
    gitName = (await spawn('git', [
      'show',
      '-s',
      '--format=%an',
    ], { cwd })).stdout;
  }

  await spawn('git', [
    'config',
    'user.email',
    `"${gitEmail}"`,
  ], { cwd });

  await spawn('git', [
    'config',
    'user.name',
    `"${gitName}"`,
  ], { cwd });

  await spawn('git', [
    'add',
    '-A',
  ], { cwd });

  console.log({ amend });

  if (amend) {
    await spawn('git', [
      'commit',
      '--amend',
      '--no-edit',
    ], { cwd });
  } else {
    await spawn('git', [
      'commit',
      '-m',
      `${commitPrefix}${name}

${updateArgs.join(' ')}`,
    ], { cwd });
  }

  let branch = (await spawn('git', [
    'rev-parse',
    '--abbrev-ref',
    'HEAD',
  ], { cwd })).stdout;

  console.log({ branch });

  await spawn('git', [
    'push',
    'origin',
    branch,
    ...[amend ? '-f' : ''].filter(Boolean),
  ], { cwd });
}

module.exports = emberCliUpdateAction;
module.exports.renovateRegex = renovateRegex;
module.exports.dependabotRegex = dependabotRegex;
module.exports.greenkeeperRegex = greenkeeperRegex;
module.exports.getStats = getStats;
module.exports.getMatch = getMatch;
module.exports.emberCliUpdate = emberCliUpdate;
