# TODO

## Where we stopped

The kit serves both agents, released: `v0.3.0` on npm with the ST fix, the
silence confirmed live. The wording sweep (Claude Code named in full, the
agent in behavior texts) ships as `v0.3.1`.

- The "attention sounds" were the BEL terminator of every title write
  ringing, not a feature: no sound code in the plugin, none in OpenCode —
  the parenthetical is gone from the README. The release checklist closed:
  todo/release-0.3.0.md.
- Other machines: `git remote set-url origin
  https://github.com/ltruchot/qol-mini-4-ai-tui.git`, then from a clone
  `git pull && ./install.sh --replace`, or
  `pnpm dlx qol-mini@latest install --replace` — restart the TUIs after.

## Later

- `qol-mini install` asks, among its setup prompts, whether the kaizen `TODO.md`
  and `todo/` stay in git tracking: default yes — they are committed. A machine
  that wants them out names the repos, and only those repos' `.gitignore`
  gains the entries. The kaizen skill neither knows nor decides this.
- Commit the 0.2.0 skills in the nine rollout repos, each in that repo's own
  flow → todo/skills-rollout.md
- A shared core for `qodo-pr-review` (finding anatomy, the GraphQL thread queries, the shell
  traps): gods-monorepo and wordpress-theme-st-jo hold two forks with opposite merge policies,
  which stay local.
