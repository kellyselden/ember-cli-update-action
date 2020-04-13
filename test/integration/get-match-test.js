'use strict';

const { describe } = require('../helpers/mocha');
const { expect } = require('../helpers/chai');
const index = require('../../src');
const sinon = require('sinon');

const {
  getMatch
} = index;

describe(getMatch, function() {
  beforeEach(function() {
    sinon.stub(console, 'log');
  });

  afterEach(function() {
    sinon.restore();
  });

  it('default blueprint', async function() {
    sinon.stub(index, 'getStats').withArgs().resolves(`package name: ember-cli
blueprint name: app
current version: 1.2.3
latest version: 4.5.6
`);

    let {
      isMatch,
      blueprintName
    } = await getMatch({
      packageName: 'ember-cli',
      from: '1.2.3',
      to: '4.5.6'
    });

    expect(isMatch).to.be.true;
    expect(blueprintName).to.equal('app');
  });

  it('custom blueprint', async function() {
    sinon.stub(index, 'getStats').withArgs('my-test-package').resolves(`package name: my-test-package
blueprint name: my-test-blueprint
current version: 1.2.3
latest version: 4.5.6
`);

    let {
      isMatch,
      blueprintName
    } = await getMatch({
      packageName: 'my-test-package',
      from: '1.2.3',
      to: '4.5.6'
    });

    expect(isMatch).to.be.true;
    expect(blueprintName).to.equal('my-test-blueprint');
  });

  it('not a blueprint', async function() {
    sinon.stub(index, 'getStats').withArgs('my-test-package').resolves('');

    let {
      isMatch
    } = await getMatch({
      packageName: 'my-test-package',
      from: '1.2.3',
      to: '4.5.6'
    });

    expect(isMatch).to.be.false;
  });

  it('ignore to', async function() {
    sinon.stub(index, 'getStats').withArgs('my-test-package').resolves(`package name: my-test-package
blueprint name: my-test-blueprint
current version: 1.2.3
latest version: 7.8.9
`);

    let {
      isMatch,
      blueprintName
    } = await getMatch({
      packageName: 'my-test-package',
      from: '1.2.3',
      to: '4.5.6',
      ignoreTo: true
    });

    expect(isMatch).to.be.true;
    expect(blueprintName).to.equal('my-test-blueprint');
  });

  it('local blueprint', async function() {
    sinon.stub(index, 'getStats').withArgs('my-test-package').resolves(`package name: my-test-package
package location: .
blueprint name: my-test-blueprint
current version: 1.2.3
latest version: 4.5.6
`);

    let {
      isMatch,
      blueprintName
    } = await getMatch({
      packageName: 'my-test-package',
      from: '1.2.3',
      to: '4.5.6'
    });

    expect(isMatch).to.be.true;
    expect(blueprintName).to.equal('my-test-blueprint');
  });
});
