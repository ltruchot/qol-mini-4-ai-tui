# TODO

## Where we stopped

A full review against OpenCode 2.1.2 (its code) and Claude Code 2.1.306
(its docs) rewrote the converters; the work is in the tree, not committed,
`vp run ready` green. `qol-mini@0.4.0` on npm writes OpenCode output that
OpenCode 2.1 drops (a `permission` array, commands with an alias model):
run no `harmonize` from 0.4.0 on a real repo.

- Commit, release 0.5.0 → todo/release-0.5.0.md
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
