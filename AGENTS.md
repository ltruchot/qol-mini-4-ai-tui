# Instructions — `qol-mini-4-ai-tui`

> Session handoff: read `TODO.md` first — where the last session stopped, and what is left.
> Open a `todo/` file only for the item you work on. An item done → delete its line and its `todo/` file.

A minimal kit for Claude Code and OpenCode, in one npm package, `qol-mini`,
developed at `ltruchot/qol-mini-4-ai-tui`, for Linux, macOS, WSL and Windows, in VS Code
and Cursor. Two scopes:

- global: hooks, status line, sounds, the kaizen review, in the Claude Code config dir;
  the OpenCode plugin, command and `cli.json` merge, in the OpenCode config dir.
- project: skills, in `<project>/.claude`, read by both agents; `harmonize` and
  `vitals`, on one repo.

**Purpose, which settles the trade-offs**: a model that is not working is a model you
could hand something to. Every signal answers *is it running* first: green is
activity, not rest. Show which session wants you; keep the others busy.

**Vocabulary**: *kit*, *setup*, *hooks*. Never *harness*: in this ecosystem it means
the agent runtime itself.

**Language**: US English in everything committed — README, code, comments, this
file, commit messages. The repo is public. The conversation is in the user's language.

**Commits**: a message states the change and its technical reason. It never names a
person, never narrates a session, a conversation or a review exchange, never speaks
in the first person. The only trailer is `Co-Authored-By`; no `Claude-Session`. A
decision worth keeping is an ADR in `docs/adr/`, named `NNNN-title.md`, anonymous:
context, decision, consequences.

**Style**:

- Terse. No metaphors, no wind-up. Name the trigger, then the action.
- Say what is measured and what is assumed.
- The README is tables and commands only: no reasoning, no adjectives.

**Mandatory**: this file, code comments and the README state what is and what must
be, never what was. No "an earlier version", "used to", "changed from X to Y", no
incident dates or counts. History and proof belong to commit messages.

## What the kit does

Sources are under `packages/qol-mini/src/`.

| Feature | Source | What you see |
|---|---|---|
| Context status line | `kit/hooks/statusline*.ts` | `Opus 5 (1M context) high ▓▓▓▓░░░░░░ 88/200k · my-project` |
| Notification sounds | `kit/hooks/play.ts`, `kit/sounds.ts` | two rising notes when the agent wants you, one low note when a turn or a manual `/compact` ends |
| Tab marker | `kit/hooks/tab-state.ts` | 🟢 working (subagents, background tasks, compaction) · 🔴 blocked on you · 🟡 idle |
| Kaizen review | `kit/hooks/precompact-kaizen.ts`, `skills/kaizen/SKILL.md` | `/compact` stops until `/kaizen` has run; `/kaizen` first updates `TODO.md` (index) and `todo/` (one file per item needing context), then proposes at most three `ADD`/`CUT`/`MOVE`/`REWORD` items, one ASCII block each; after a compaction the agent is told to read `TODO.md` |
| Skills per project | `commands/`, `core/`, `io/`, `packages/qol-mini/skills/` | `qol-mini skills install qa-pr ./my-project` renders a shipped skill into `.claude/skills/`, records it in `.claude/qol-mini.lock.json`, and merges local edits on update |
| Harmonize per repo | `commands/harmonize-*.ts`, `harmonize/`, `core/harmonize/` | `qol-mini harmonize <project>` makes a repo run under both agents: AGENTS.md canonical, permissions, commands, agents and MCP converted each way, hooks and skills reported; `check` and `undo` run off the lock's `harmonize` section |
| Vitals per repo | `commands/vitals-*.ts`, `vitals/`, `crates/` | `qol-mini vitals <project>` audits a repo for both agents, read-only: Rust probes on the rules file (`AM01`–`AM21`) and the skills (`SK01`–`SK15`), run as WebAssembly; the `agents-md-review` and `skills-review` bank skills judge what a probe cannot |
| OpenCode target | `packages/qol-mini/opencode/`, `src/opencode/` | the same features in the OpenCode TUI: tab marker, `/compact` gate, post-compaction reminder, `/kaizen` command |

| Command | Does |
|---|---|
| `qol-mini install` | global scope: copies the hook bundles, merges `settings.json`, delivers the OpenCode target (`kit/install.ts`, `opencode/`) |
| `qol-mini uninstall` | removes what `install` added, from both targets (`kit/uninstall.ts`) |
| `qol-mini vscode` | sets the editor (`kit/vscode.ts`) |
| `qol-mini skills install\|update\|list\|check\|remove` | project scope, or `--global` |
| `qol-mini harmonize <project>\|check\|undo\|scan` | repo scope, both agents: one command converts, `check` exits for CI, `undo` restores, `scan` lists repos under named roots |
| `qol-mini vitals [agents-md\|skills] [project] [--repo-only] [--json] [--fix [--dry-run]]` | repo scope, both agents: every gate or the named one; exit 0, 1 a probe failed, 2 unreadable; read-only, except `--fix`, which runs the commands the findings name |

`install.sh`, `uninstall.sh`, `install-vscode.sh`, `install-skills.sh` and their
`.ps1` twins run the same commands from a clone, through `scripts/qol-mini.sh`.

With no option and a real console, `qol-mini install` asks. With any option, or a
stdin that is not a console, it asks nothing, and `skills` commands confirm nothing.
A prompt that blocks a script or CI is a bug.

## Constraints

### Where the subtree rules live

A nested `AGENTS.md` loads, in both agents, when a file below it is read. Read the one
for the code you change before you change it:

| Rules | File |
|---|---|
| hooks, tab marker, `/compact` gate, installer, status line | `packages/qol-mini/src/kit/AGENTS.md` |
| the OpenCode plugin and its delivery | `packages/qol-mini/opencode/AGENTS.md` |
| writing a bank skill | `packages/qol-mini/skills/AGENTS.md` |
| `qol-mini harmonize` | `packages/qol-mini/src/harmonize/AGENTS.md` |
| the `vitals` launcher and its WASI host | `packages/qol-mini/src/vitals/AGENTS.md` |
| the Rust gates | `crates/AGENTS.md` |

### Reload

- Hooks and `statusLine` in `settings.json` reload without a restart.
- The `env` block and a skills directory created after startup need a new session.
- Reloading the editor window restarts nothing: it reconnects to the same processes.
- Do not ask for a restart beyond those two cases.

### Lessons

- A lesson goes to the repo's rules file (`AGENTS.md`, else `CLAUDE.md`) or to a named
  skill. Never to `~/.claude/CLAUDE.md`.

### Skills

- One bank: `packages/qol-mini/skills/`, shipped in the package. `QOL_MINI_BANK`
  points the CLI at another directory; the tests use it.
- A skill declares its `{{NAME}}` placeholders in `qol-mini.yaml`. Only declared
  names are substituted. `RELEASE_COMMAND` is computed, never asked.
- The lock, `.claude/qol-mini.lock.json`, is the managed set: a skill directory
  absent from it is never touched without `--replace`.
- `install` on a managed skill is an update: three-way merge of the installed
  template, the disk and the shipped template. `--replace` takes the shipped side.
- The global `install` renders `kaizen` with the same code and delivers it under
  the installer's file rule, with no lock entry.
- An argument holding a path separator, or `.`, is the project; every other
  argument must be a kebab-case skill name.
- Writes go to `<project>/.claude` and `~/.cache/qol-mini`, nowhere else.
- A managed skill is a vendor file for the project's formatters and linters: one that
  rewrites it turns it into `drift` and makes its update conflict.
- `install` names the paths to ignore after it adds a skill, `check` when it finds
  `drift`; both list the tools configured at the project root (`io/lint-configs.ts`).
  The kit reads those configs and never writes one: the README holds the prompt that does.

### Vitals

- Every check is a gate: deterministic Rust probes set the exit status, an advisory
  review skill in the bank judges content. Read `docs/adr/0008-a-gate-is-probes-plus-a-review-skill.md`
  before adding a probe or a gate, `docs/adr/0005-vitals-audits-a-repository-for-coding-agents.md`
  before proposing a feature. `docs/vitals.md` holds the probe tables.
- Rust judges, TypeScript launches. No probe, parser or verdict is written in
  TypeScript. Why: `docs/adr/0009-the-gates-ship-as-webassembly.md`.
- The `--json` report is an interface: add a field, never rename one.

### Windows

- Hook paths are written with backslashes: `isOurs()` normalizes separators before
  matching.
- Keep the Windows job in `.github/workflows/test.yml`: it is the only place the
  native path runs.
- The `.ps1` wrappers set errors to `Continue` around native commands: under
  PowerShell 5.1 a native command writing to stderr is terminating under `Stop`.

## Method

- The shell is zsh: quote a word that starts with `=` and any glob passed as an
  argument, and wrap a command in a function, not in a variable: `$CMD args` is
  one word there. Never name a variable `path`: zsh ties it to `$PATH`.
- `node`, `python3` and `cargo` are mise shims: in a copy of the repo (a
  worktree, an export) they fail with `mise.toml are not trusted`. Set
  `MISE_TRUSTED_CONFIG_PATHS=<copy>` on the command; `mise trust` is for a clone.
- To interrupt a running tool, accept its permission prompt first: Esc on the dialog
  is a rejection and the tool never runs.
- Verify a negative result before concluding.
- Check a doc claim with `curl -sL https://code.claude.com/docs/en/<page>.md` and
  `grep`, never a fetched summary: summaries truncate and report ABSENT.

## Verified, and not

| Where | What |
|---|---|
| This machine: WSL2, Node 24 | the test suite; install, update, uninstall and skills install against throwaway directories, from a clone and from npm through `pnpm dlx`; the update of a real config that held `.py` handlers |
| CI: Linux, macOS | the test suite |
| CI: Linux, macOS, Windows | install, update, a delivered hook run alone, a skill installed and checked, `vitals skills` on that project with and without `--repo-only`, uninstall |
| CI: Linux | `cargo xtask check`: the Rust tests, the container tests, branch coverage |
| This machine: WSL2 | `qol-mini vitals` against the native binaries: same stdout and exit status on six trees, both gates, both scopes |
| This machine: WSL2, VS Code, a live session | the tab marker on screen, the sounds heard, `/compact` held back then released by `/kaizen`; the marker back in a project whose opt-out file names `kaizen` |
| This machine: OpenCode 2.1.2, isolated `HOME` and `XDG_*` | a harmonized Claude Code repo loads: `opencode debug config` shows the `permissions` and `mcp.servers`, `debug agents` the agent with its allowlist, `GET /api/command` the command |
| CI: Windows, `test-windows` | the `vitals` tests: the `agents-md` output equal to the native one byte for byte, both gates, the exit statuses, the user scope |
| This machine: WSL2, `claude -p` and `opencode run --standalone` (OpenCode 2.3.0) in a scratch project | each review skill from an installed copy: it loads, runs `npx qol-mini vitals <gate>` and returns its first block |
| Never | a repository and a home directory on two Windows drives; `afplay`, PowerShell `SoundPlayer`; the editor paths outside WSL; a harmonized repo in a live session of either agent |

The README states this. Do not claim more.

## Open threads

- Marker format: settable through `CC_TAB_WORKING`, `CC_TAB_BLOCKED`, `CC_TAB_IDLE`;
  what reads best is untested. Colors are settled: green running, red blocking only,
  yellow idle. Orange reads as red across a tab strip.
- A warning triangle shows on every tab in the terminal list. Cause unknown.
- Unchecked on a `/compact` with markers: the dim post-compaction line and the
  compaction instructions, for our JSON. If dirty, remove the `PreCompact` marker only.

## Testing

```bash
mise install && cargo xtask setup   # once: Rust, its targets, the coverage nightly
vp install                 # once
cargo xtask check          # the Rust chain: fmt, clippy, test, doc, deny, e2e, 90% branch coverage
vp run wasm                # the gates for WASI, into packages/qol-mini/wasm/
vp check --fix             # format, lint, types
vp run lines               # 50 lines per source and test file
vp run -r test             # builds the bundles first
vp run -r build && vp run packcheck
./install.sh --replace     # reinstalls the current options from this clone
./uninstall.sh             # removes what was installed, nothing else
```

- `vp run ready` chains the gates, `cargo xtask check` and `vp run wasm` first. All of
  them pass before a change is done. `cargo xtask check` needs a running docker daemon;
  `cargo xtask e2e` and `cargo xtask cov` run its two slow parts alone.
- `cargo agents-md-chkr [--repo-only] [PATH]` and `cargo skills-chkr` run a gate
  natively, without the CLI.
- A push is done when its `test` run is green (`gh run watch <id> --exit-status`).
  A job cancelled with `not acquired by Runner` is GitHub runner capacity, not
  the change: `gh run rerun <id> --failed`.
- A job that failed while the run still goes: `gh run view --log-failed` prints
  nothing until the run ends. Read it with `gh api
  repos/ltruchot/qol-mini-4-ai-tui/actions/jobs/<job>/logs --allow-escape-sequences`;
  the job id comes from `gh run view <id> --json jobs`.
- `ready` calls `vp run check` and `vp run rust`, tasks with `cache: false`: under the
  task cache `tsgolint` and `cargo-deny` fail to spawn with `EBUSY`. Keep them uncached.
- TypeScript sources and tests hold 50 lines per file. Skills, docs and this file do
  not. Rust holds 40 lines per function (`clippy.toml`).
- Lint runs every oxlint category as an error. An exception is one line in
  `lint/off-*.ts`, with its reason.
- The pre-commit hook rejects email-like text on an added line, a test string with
  `\n` then `@a.md` included: put a space or `- ` before the `@`, or split the literal.
- The root `package.json` names pnpm twice: `packageManager` is what Vite+ reads
  to pick the version, `devEngines` is what makes `npm` refuse the root. Without
  `packageManager`, `vp install` runs an older pnpm that rejects the lockfile.
- No dependency at runtime: everything is bundled, and the gates ship as two `.wasm`
  files that packcheck requires in the tarball. A new dev dependency gets an
  exact pin in the `pnpm-workspace.yaml` catalog.
- Hooks are tested as real processes with the event JSON on stdin; the installer
  and the skills commands run in-process against `CLAUDE_CONFIG_DIR` and
  temporary projects. No test touches `~/.claude` or `~/.config/opencode`.

A change is delivered when it is installed: `~/.claude` and
`~/.config/opencode` hold a copy, and editing the repo changes nothing on
screen. `CLAUDE_CONFIG_DIR` and `XDG_CONFIG_HOME` point any command at
throwaway directories.

## Release

A tag `v<version>` matching `packages/qol-mini/package.json` publishes to npm from
`.github/workflows/release.yml`. `docs/release.md` holds the steps, the approval of a
waiting run, and the manual path. Keep `environment: release`, the SHA pins,
`cache: false` and `persist-credentials: false` in that workflow: the job holds the right
to publish.
