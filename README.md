# ember-cli-update-action

![](https://github.com/kellyselden/ember-cli-update-action/workflows/CI/badge.svg)
![](https://github.com/kellyselden/ember-cli-update-action/workflows/Release/badge.svg)

Run [ember-cli-update](https://github.com/ember-cli/ember-cli-update) updates on CI

Supports [Renovate](https://renovatebot.com), [Dependabot](https://dependabot.com), and [Greenkeeper](https://greenkeeper.io)

```yml
  - uses: actions/checkout@v2
    with:
      ref: ${{ github.head_ref }}
      token: ${{ secrets.GitHubToken }}
  - uses: actions/setup-node@v1.1.0
  - uses: kellyselden/ember-cli-update-action@master
```

```yml
  - uses: actions/checkout@v2
    with:
      ref: ${{ github.head_ref }}
      fetch-depth: 2
      token: ${{ secrets.GitHubToken }}
  - uses: actions/setup-node@v1.1.0
  - uses: kellyselden/ember-cli-update-action@master
    with:
      amend: true
```

```yml
  - uses: actions/checkout@v2
    with:
      ref: ${{ github.head_ref }}
      token: ${{ secrets.GitHubToken }}

  # support `"location": "."` blueprints
  # https://github.com/actions/checkout#Fetch-all-tags
  - run: git fetch --depth=1 origin +refs/tags/*:refs/tags/*

  - uses: actions/setup-node@v1.1.0
  - uses: kellyselden/ember-cli-update-action@master
```

```yml
  - uses: actions/checkout@v2
    with:
      ref: ${{ github.head_ref }}
      token: ${{ secrets.GitHubToken }}
  - uses: actions/setup-node@v1.1.0
  - uses: kellyselden/ember-cli-update-action@master
    with:
      install_command: foo bar
      autofix_command: npm run lint -- --fix
      ignore_to: true
```

or without GitHub Actions (Travis CI)

```yml
  - git checkout $TRAVIS_PULL_REQUEST_SHA
  - git checkout -B $TRAVIS_PULL_REQUEST_BRANCH
  - git remote set-url origin https://$GITHUB_TOKEN@github.com/$TRAVIS_PULL_REQUEST_SLUG.git
  - npx https://github.com/kellyselden/ember-cli-update-action.git#semver:* --pull-request-url https://api.github.com/repos/$TRAVIS_REPO_SLUG/pulls/$TRAVIS_PULL_REQUEST
```

This parses pull request descriptions to find a blueprint match. A dependency update service may push the commit before making the pull request description. For that reason, you may want to put this action after your test job using `needs` to give the update service time to update the description.
