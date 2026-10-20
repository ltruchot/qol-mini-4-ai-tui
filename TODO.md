# TODO

## Where we stopped

The kit serves two agents. Repo renamed `qol-mini-4-ai-tui`, `main` pushed,
0.3.0 in the package, not yet tagged. `vp run ready` green, 96/96. `TODO.md`
and `todo/` are repo state, committed.

- Installed on this machine into both targets, `~/.claude` and
  `~/.config/opencode`: the user's `cli.json` keys survive, backups written.
- Verified live in OpenCode: the plugin loads, `/kaizen` runs the skill, a
  manual compaction released through the plugin's entry consumed the token,
  the tab marker painted red on a paused session, and the dedup works on the
  fixed bytes — one reminder per compaction, one marker and one synthetic
  message, where the old bytes sent four.
- The 23:25 compaction went through the built-in entry: no `/kaizen`, no
  token — the soft edge, as documented.
- Still unseen on the fixed bytes, all observable in one sitting:
  - the refusal's feedback: this repo's token is spent, so a `/compact`
    through the `kaizen-gated` entry must raise the modal and the
    session-routed toast — "Compaction held back";
  - the marker green while a resumed run works;
  - the attention sounds.
- Then the release → todo/release-0.3.0.md: tag `v0.3.0`, approval in the
  GitHub environment `release`. The rename may break the npm trusted
  publishing: re-run `npm trust github qol-mini --file release.yml --repo
  ltruchot/qol-mini-4-ai-tui --env release --allow-publish` if the job
  refuses.
- Other machines: `git remote set-url origin
  https://github.com/ltruchot/qol-mini-4-ai-tui.git`, then from a clone
  `git pull && ./install.sh --replace`, or `pnpm dlx qol-mini@latest install
  --replace` once 0.3.0 is on npm.

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
