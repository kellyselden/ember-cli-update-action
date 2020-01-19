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
    let email = (await run('git', [
      'show',
      '-s',
      '--format=%ae'
    ])).stdout;

    let name = (await run('git', [
      'show',
      '-s',
      '--format=%ae'
    ])).stdout;

    let gitEmail = core.getInput('git_email');
    let gitName = core.getInput('git_name');

    // if (email === gitEmail) {
    //   console.log('This is the second commit.');
    //   return;
    // }

    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`);

    let ref = github.context.payload.pull_request.head.ref;
    console.log({ ref });

    // await run('git', [
    //   'remote',
    //   'remove',
    //   'origin'
    // ]);

    // let username = core.getInput('username');
    // process.env.GITHUB_TOKEN = core.getInput('token');

    // let remote = github.context.payload.repository.clone_url;
    // console.log({ remote });

    // remote = remote.replace('https://', `https://${username}:$GITHUB_TOKEN@`);

    // await run('git', [
    //   'remote',
    //   'add',
    //   'origin',
    //   remote
    // ]);

    // await run('git', [
    //   'fetch',
    //   'origin',
    //   ref
    // ]);

    // await run('git', [
    //   'checkout',
    //   '--track',
    //   `origin/${ref}`
    // ]);

    await run('npx', [
      'ember-cli-update',
      '-b=@kellyselden/node-template'
    ]);

    let status = await run('git', [
      'status',
      '--porcelain'
    ]);

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

    await run('git', [
      'add',
      '-A'
    ]);

    await run('git', [
      'config',
      '--global',
      'user.email',
      `"${email}"`
    ]);

    await run('git', [
      'config',
      '--global',
      'user.name',
      `"${name}"`
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
  } catch (error) {
    core.setFailed(error.message);
  }
})();
