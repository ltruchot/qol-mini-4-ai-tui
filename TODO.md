# TODO

## Where we stopped

The harmonizer is on npm: `qol-mini@0.4.0`, the run log shows
`+ qol-mini@0.4.0`, provenance signed, the registry serves the version.
The checklist → todo/release-0.4.0.md

- No repo was written: the four real ones saw dry-runs only. The first
  live write closes the checklist: `harmonize <repo>` on one repo, then
  a Claude Code session and an OpenCode session in it, both reading
  AGENTS.md.
- Other machines: `pnpm dlx qol-mini@latest install --replace` — restart
  the TUIs after; each repo: `pnpm dlx qol-mini@latest harmonize <repo>`,
  then commit the lock and the generated files.

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
