# TODO

## Where we stopped

The harmonizer ships as `v0.4.0`: `qol-mini harmonize
<project>|check|undo|scan`, both directions, AGENTS.md canonical, `vp run
ready` green, 119/119. No repo was written: the four real ones saw dry-runs
only. The tag is pushed; the run in the GitHub environment `release` waits
for its approval → todo/release-0.4.0.md

- The first live write closes the release checklist: `harmonize <repo>` on
  one repo, then a Claude Code session and an OpenCode session in it, both
  reading AGENTS.md. The dry-runs and the suite are the proof so far.
- Other machines: `pnpm dlx qol-mini@latest install --replace` — restart the
  TUIs after; each repo: `pnpm dlx qol-mini@latest harmonize <repo>`, then
  commit the lock and the generated files.

## Later

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
  traps): gods-monorepo and wordpress-theme-st-jo hold two forks with opposite merge policies,
  which stay local.
