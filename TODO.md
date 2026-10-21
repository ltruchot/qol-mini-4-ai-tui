# TODO

## Where we stopped

**Top priority on restart**: the Claude Code tab marker regressed. A turn
ending on a question stays green instead of red; colors seen out of place
earlier too. Lead: since 0.5.0, `SubagentStop` paints green, and Claude
Code's internal agents (prompt suggestions, recap) fire it after the turn's
`Stop`. Confirm with `claude --debug`, then fix → todo/tab-marker-regression.md

`qol-mini@0.5.2` is released, `main` level with `origin`, `vp run ready`
green, 153 tests. Rollout on real repos and the first live sessions in both
agents → todo/harmonize-rollout.md

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
- Commit the 0.2.0 skills in the nine rollout repos, each in that repo's own
  flow → todo/skills-rollout.md
- A shared core for `qodo-pr-review` (finding anatomy, the GraphQL thread queries, the shell
  traps): a monorepo and a WordPress theme hold two forks with opposite merge policies,
  which stay local.
