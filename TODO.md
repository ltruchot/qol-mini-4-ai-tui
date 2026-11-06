# TODO

## Where we stopped

Nothing in progress. `qol-mini@0.6.2` is published and installed on this machine
(`./install.sh --replace`): the bank `vp` and `css-modern` carry no `paths`, kaizen reads
AGENTS.md. This repo runs Vite+ 1.5.0, Node 26.13.0, pnpm 12.16.1, `minimumReleaseAge` 4320;
`vp run ready` green, 156 tests.

The twelve repos of `.local/repos.json` carry the same setup and are harmonized: AGENTS.md is
the rules file (the harness keeps `CLAUDE.md` as a symlink to it), committed and pushed where
they have a remote. Their temporary release-age exclusions are dropped by a job scheduled for
2026-11-07 06:13 local time in the session that set them up; it does not outlive that session.

## Later

- From 2026-11-07 05:00 UTC: drop the Vite+ 1.5.0 release-age exclusions in every repo of
  `.local/repos.json` (done? check `minimumReleaseAgeExclude` in qol-mini) → todo/vite-plus-fleet.md
- `harmonize run` inside a repo misreads it: with no project it reports "no rules file" next to a
  CLAUDE.md and an AGENTS.md, and `harmonize run .` fails with `Unused args: .`;
  `qol-mini harmonize ./<repo>` and `harmonize check ./` work
- Rollout of the harmonizer on real repos and the first live sessions in both agents →
  todo/harmonize-rollout.md
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
