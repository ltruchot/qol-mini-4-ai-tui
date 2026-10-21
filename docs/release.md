# Release

For maintainers. A tag `v<version>` matching `packages/qol-mini/package.json`
publishes to npm.

## From CI

```bash
git tag v<version> && git push origin v<version>
```

| Step of `.github/workflows/release.yml` | Why |
|---|---|
| checkout with `persist-credentials: false` | no git token on disk for the steps that follow |
| the tagged commit is an ancestor of `origin/main` | a tag on a commit outside `main` publishes nothing; checked before anything installs |
| setup with `cache: false` | a restored cache can hold what an untrusted run wrote; this job holds the right to publish |
| tag must equal the version in `packages/qol-mini/package.json` | a tag cannot publish another version |
| the gates of `ready` | nothing unchecked reaches npm |
| `vp pm pack`, then `npm publish` of the tarball | pnpm resolves the `catalog:` versions when it packs; `npm publish` of the directory would ship them unresolved |
| trusted publishing | no npm token stored in the repository; configure it once: `npm trust github qol-mini --file release.yml --repo ltruchot/qol-mini-4-ai-tui --env release --allow-publish` |
| `environment: release` | the GitHub environment `release` has required reviewers: the job waits for an approval before it can publish |
| actions pinned by commit SHA, npm by version | the job holds the right to publish |

Approve a waiting run:

```bash
echo '{"environment_ids": [<id>], "state": "approved"}' |
  gh api -X POST repos/ltruchot/qol-mini-4-ai-tui/actions/runs/<run>/pending_deployments --input -
```

The id goes as a JSON integer array: form fields fail on it.

The proof of a publish is the `+ qol-mini@<version>` line in the job output. The
registry serves a new version minutes later.

## By hand

| Step | Command, from `packages/qol-mini` | Note |
|---|---|---|
| 1. Log in | `npm login` | once per machine |
| 2. Build and pack | `vp run build && vp pm pack` | writes `qol-mini-<version>.tgz`, `catalog:` versions resolved |
| 3. Publish | `npm publish qol-mini-<version>.tgz` | opens a browser page to authenticate |
| 3, under WSL | `BROWSER=wslview npm publish qol-mini-<version>.tgz` | WSL has no browser to open |
| 4. Check | `npm view qol-mini version` | prints the version just published |

| Error | Cause | Fix |
|---|---|---|
| `EBADDEVENGINES … "pnpm" does not match "npm"` | `npm` was run at the repository root, whose `package.json` pins pnpm | `cd packages/qol-mini` |
| `Set the BROWSER environment variable` | WSL: the authentication page cannot be opened | `BROWSER=wslview`, or `--auth-type=legacy` to type a one-time code in the terminal |
| `404` on step 4 | step 3 stopped before publishing | run step 3 again: the tarball is still there |
