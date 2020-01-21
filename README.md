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
  - uses: kellyselden/ember-cli-update-action@v1.0.42
```

```yml
  - uses: actions/checkout@v2
    with:
      ref: ${{ github.head_ref }}
      fetch-depth: 2
      token: ${{ secrets.GitHubToken }}
  - uses: actions/setup-node@v1.1.0
  - uses: kellyselden/ember-cli-update-action@v1.0.42
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
  - uses: kellyselden/ember-cli-update-action@v1.0.42
```

This parses pull request descriptions to find a blueprint match. A dependency update service may push the commit before making the pull request description. For that reason, you may want to put this action after your test job using `needs` to give the update service time to update the description.
