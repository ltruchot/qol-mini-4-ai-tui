# The OpenCode target

Sources: `packages/qol-mini/opencode/` (the plugin, shipped as-is) and
`packages/qol-mini/src/opencode/` (its delivery). Read this file before changing either.

- `packages/qol-mini/opencode/` is plugin code shipped as-is for the OpenCode
  runtime: OpenCode resolves `@opencode/plugin` at load, so nothing is built
  and the package gains no dependency. `fmt`, `lint` and the line law skip it;
  a test runs `node --check` on every face.
- One feature set for both agents: the plugin reads the Claude Code `settings.json`
  (`configured()` in `opencode/shared.js`), never its own state. Turning a
  feature off unwires both. `installedState()` stays the only source.
- The config dir resolves as OpenCode resolves it: `$XDG_CONFIG_HOME/opencode`
  else `~/.config/opencode`. The tests isolate it through `XDG_CONFIG_HOME`.
- `cli.json` accepts documented keys only: `attention.sound`,
  `attention.sounds`, `terminal.title`. Never write another one.
- A delivered slash command stays active on disk, unlike an unwired hook:
  turning kaizen off removes `commands/kaizen.md` (`stale` in the OpenCode
  plan).
- The tab marker writes the title sequence to `/dev/tty`: the TUI owns the
  screen, that is the only way out, and `terminal.title: false` keeps OpenCode
  from rewriting the title. Windows has no `/dev/tty`: no marker there, and no
  `terminal.title` in `cli.json`, so OpenCode keeps its own.
- `/compact` has no PreCompact hook in OpenCode: the TUI plugin registers the
  command and checks the same token the Claude Code hook consumes.
- Verified live: the plugin's entry holds back and honors the token; the built-in
  entry keeps its own palette slot and compacts ungated — no plugin removes it.
- A refusal raises a modal with the same words as its toast: the toast alone is easy
  to miss.
- Events, not hooks: `session.execution.*` for working and idle,
  `permission.asked`, `form.created`, `session.status` (a retry with an action
  is blocked on you, one without resumes alone), `session.compaction.*` for the
  reminder.
- A pause does not end the execution: `permission.replied`, `form.replied` and
  `form.cancelled` repaint working — without them the marker holds its red through
  the resumed run.
- `session.execution.interrupted` is not wired: the marker holds on Esc, the same
  known gap as Claude Code.
- The service watches the plugin dir: changed files reload hot — retest
  server-face fixes in place; a live TUI may hold the old command bytes,
  so restart it before retesting the gate. `install` names `opencode service
  restart` when they moved. `cli.json` and `commands/` reload hot.
- OpenCode behavior: the opencode.ai/docs pages describe V1. Read the V2 source
  (`anomalyco/opencode/packages/core/src`) and cite the commit.

## Method

- Check what OpenCode loads in a repo: `HOME` and `XDG_*` on a scratch dir,
  `opencode service set port <free>` first, or it takes the real service's
  port; then `opencode api GET /api/agent` or `/api/command` with
  `-H "x-opencode-directory:<repo>"`, repeated until more than the built-ins
  show; `opencode service stop` after, same env.
