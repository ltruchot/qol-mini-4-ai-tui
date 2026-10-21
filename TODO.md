# TODO

## Where we stopped

`qol-mini@0.5.0` is on npm (`+ qol-mini@0.5.0` in the run log): its
converters write OpenCode 2.1's native shapes, checked by
`@opencode/schema`. `qol-mini@0.4.0` writes output OpenCode 2.1 drops:
run no `harmonize` from 0.4.0 on a real repo. → todo/release-0.5.0.md
- Then, per repo: `harmonize <repo> --dry-run`, read the named losses, then
  `--only rules` first, then a full run; a Claude Code session and an
  OpenCode session in it, both reading AGENTS.md. Commit the lock.
- Other machines: `pnpm dlx qol-mini@latest install --replace`, restart the
  TUIs after.

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
  traps): a monorepo and a WordPress theme hold two forks with opposite merge policies,
  which stay local.
