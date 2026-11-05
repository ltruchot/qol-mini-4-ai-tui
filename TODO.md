# TODO

## Where we stopped

The bank `vp` skill is written against Vite+ 1.5 and has Vite+ own Node and pnpm; this repo
runs Vite+ 1.5.0, Node 26.13.0, pnpm 12.16.1, `minimumReleaseAge` 4320. `qol-mini@0.6.0`
is the published version; `vp run ready` green, 156 tests. Twelve repos carry the same setup;
the exclusions to drop on 2026-11-07 → todo/vite-plus-fleet.md

Rollout of the harmonizer on real repos and the
first live sessions in both agents → todo/harmonize-rollout.md

## Later

- Port the test suite's POSIX paths and file modes to Windows, then drop
  `continue-on-error` from the `test-windows` job in `.github/workflows/test.yml`
- Harmonizer follow-ups: hooks compiled to OpenCode plugin shims, the home
  directory audit (`harmonize --global`), a CI job calling `harmonize check`,
  a validation pass under Orca (parallel worktrees vs `qol-mini-off`) →
  todo/harmonize.md
- `qol-mini install` asks, among its setup prompts, whether the kaizen `TODO.md`
  and `todo/` stay in git tracking: default yes — they are committed. A machine
  that wants them out names the repos, and only those repos' `.gitignore`
  gains the entries. The kaizen skill neither knows nor decides this.
- Commit the 0.2.0 skills in the rollout repos left, each in that repo's own flow →
  todo/skills-rollout.md
- A shared core for `qodo-pr-review` (finding anatomy, the GraphQL thread queries, the shell
  traps): a monorepo and a WordPress theme hold two forks with opposite merge policies,
  which stay local.
