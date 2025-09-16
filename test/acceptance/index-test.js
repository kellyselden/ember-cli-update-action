'use strict';

const { describe, setUpTmpDir } = require('../helpers/mocha');
const { expect } = require('../helpers/chai');
const emberCliUpdateAction = require('../../src');
const sinon = require('sinon');
const { gitInit, cloneRemote } = require('git-fixtures');
const fs = require('fs');
const path = require('path');

describe(emberCliUpdateAction, function() {
  this.timeout(30e3);

  // eslint-disable-next-line mocha/no-setup-in-describe
  setUpTmpDir();

  let cwd;

  beforeEach(async function() {
    sinon.stub(console, 'log');

    cwd = await gitInit();

    await cloneRemote({
      localPath: cwd,
      remotePath: this.tmpPath,
    });
  });

  afterEach(function() {
    sinon.restore();
  });

  it('works', async function() {
    let packageName = 'test-package';
    let blueprintName = packageName;
    let from = '1.2.3';
    let to = '4.5.6';
    let body = `| [${packageName}][\`${from}\` -> \`${to}\`]`;

    sinon.stub(emberCliUpdateAction, 'getStats').withArgs({
      cwd,
      packageName,
    }).resolves(`package name: ${packageName}
blueprint name: ${blueprintName}
current version: ${from}
latest version: ${to}
`);

    sinon.stub(emberCliUpdateAction, 'emberCliUpdate').withArgs({
      cwd,
      updateArgs: [
        'ember-cli-update',
        '-p',
        packageName,
        '-b',
        blueprintName,
        '--to',
        to,
      ],
    }).callsFake(async function() {
      await fs.promises.writeFile(path.join(cwd, 'test-file'), '');
    });

    await emberCliUpdateAction({
      cwd,
      body,
    });

    let { execa } = await import('execa');

    let remote = (await execa('git', ['ls-tree', '-r', '--name-only', 'HEAD'], {
      cwd: this.tmpPath,
    })).stdout;

    expect(remote).to.equal('test-file');
  });
});
