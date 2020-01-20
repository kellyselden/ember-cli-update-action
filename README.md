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
  - uses: kellyselden/ember-cli-update-action@v1.0.36
```

```yml
  - uses: actions/checkout@v2
    with:
      ref: ${{ github.head_ref }}
      fetch-depth: 2
      token: ${{ secrets.GitHubToken }}
  - uses: actions/setup-node@v1.1.0
  - uses: kellyselden/ember-cli-update-action@v1.0.36
    with:
      amend: true
```
