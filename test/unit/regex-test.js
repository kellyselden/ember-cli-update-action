'use strict';

const { describe } = require('../helpers/mocha');
const { expect } = require('../helpers/chai');
const fs = require('fs');
const path = require('path');
const {
  renovateRegex,
  dependabotRegex,
  greenkeeperRegex
} = require('../../src');

const fixturesDir = path.resolve(__dirname, 'fixtures');

function match(fixture, regex) {
  let md = fs.readFileSync(path.join(fixturesDir, fixture), 'utf8');

  return md.match(regex);
}

describe(function() {
  it('renovate', function() {
    let matches = match('renovate.md', renovateRegex);

    expect(matches.slice(1)).to.deep.equal([
      'npm-package-arg',
      '7.0.0',
      '8.0.0'
    ]);
  });

  it('dependabot', function() {
    let matches = match('dependabot.md', dependabotRegex);

    expect(matches.slice(1)).to.deep.equal([
      'sinon',
      '7.5.0',
      '9.0.2'
    ]);
  });

  it('greenkeeper', function() {
    let matches = match('greenkeeper.md', greenkeeperRegex);

    expect(matches.slice(1)).to.deep.equal([
      'semver',
      '6.3.0',
      '7.0.0'
    ]);
  });
});
