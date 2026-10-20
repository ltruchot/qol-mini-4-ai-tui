# TODO

## Where we stopped

The kit serves two agents. GitHub repo renamed to `qol-mini-4-ai-tui` (old URL
redirects), `main` pushed: the OpenCode target is in — plugin (service + TUI
faces), `commands/kaizen.md`, the `cli.json` merge, tests, docs. `vp run
ready` green, 95/95. `TODO.md` and `todo/` are repo state, committed.

- Installed on this machine into both targets, `~/.claude` and
  `~/.config/opencode`: the user's `cli.json` keys survive, backups written.
- Verified live: the service loads the plugin, `/kaizen` is in the command
  list, the skill is discovered from `~/.claude/skills`.
- Unverified, needs a live terminal: the tab marker in the editor, the
  `/compact` gate (the plugin's command may lose to the built-in), the
  attention sounds.
- Then the release: tag `v0.3.0`, approval in the GitHub environment
  `release`. The rename may break the npm trusted publishing: re-run
  `npm trust github qol-mini --file release.yml --repo ltruchot/qol-mini-4-ai-tui
  --env release --allow-publish` if the job refuses.
- Other machines: `git remote set-url origin
  https://github.com/ltruchot/qol-mini-4-ai-tui.git`, then from a clone
  `git pull && ./install.sh --replace`, or `pnpm dlx qol-mini@latest install
  --replace` once 0.3.0 is on npm.

## Later

- The installer asks, once, whether to keep the kaizen `TODO.md` and `todo/`
  out of commits on that machine: default no — they are committed; a yes adds
  them to the global git excludes (`core.excludesFile`). Not the default
  answer, and never written into a repo's own `.gitignore`.
- Commit the 0.2.0 skills in the nine rollout repos, each in that repo's own
  flow → todo/skills-rollout.md
- A shared core for `qodo-pr-review` (finding anatomy, the GraphQL thread queries, the shell
  traps): gods-monorepo and wordpress-theme-st-jo hold two forks with opposite merge policies,
  which stay local.
