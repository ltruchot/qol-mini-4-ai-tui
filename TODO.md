# TODO

## Where we stopped

The kit serves both agents. Repo renamed `qol-mini-4-ai-tui`, `v0.3.0`
tagged on the BEL fix (`6a80bcd`) and published to npm. One live check open:
the silence.

- Verified live in OpenCode, on the fixed bytes: the plugin loads, `/kaizen`
  runs the skill, the release path (token honored, then consumed), one
  reminder per compaction — one marker, one synthetic message — the tab
  marker red on a paused session and green through the resumed run, the
  refusal's modal and toast on a tokenless gated `/compact`.
- The "attention sounds" were a bug: every title write ended in BEL, and the
  raw `/dev/tty` write racing the TUI's redraw rang — bursts of clipped beeps
  on red sessions. Fixed with an ST terminator; the retest is the last thing
  before the approval: restart the TUIs, work normally — the marker paints,
  nothing rings. If it stays silent, the README "Not ported" parenthetical
  about OpenCode's own sounds goes.
- Next: the silence check, then the other machines: `git remote set-url
  origin https://github.com/ltruchot/qol-mini-4-ai-tui.git`, then from a
  clone `git pull && ./install.sh --replace`, or
  `pnpm dlx qol-mini@latest install --replace`.

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
