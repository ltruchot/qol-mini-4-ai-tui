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
| Vitals per repo | `commands/vitals-*.ts`, `vitals/`, `crates/` | `qol-mini vitals <project>` audits a repo for both agents, read-only: Rust probes on the rules file (`AM01`–`AM21`) and the skills (`SK01`–`SK20`), run as WebAssembly; the `agents-md-review` and `skills-review` bank skills judge what a probe cannot |
| OpenCode target | `packages/qol-mini/opencode/`, `src/opencode/` | the same features in the OpenCode TUI: tab marker, `/compact` gate, post-compaction reminder, `/kaizen` command |

| Command | Does |
|---|---|
| `qol-mini install` | global scope: copies the hook bundles, merges `settings.json`, delivers the OpenCode target (`kit/install.ts`, `opencode/`) |
| `qol-mini uninstall` | removes what `install` added, from both targets (`kit/uninstall.ts`) |
| `qol-mini vscode` | sets the editor (`kit/vscode.ts`) |
| `qol-mini skills install\|update\|list\|check\|remove` | project scope, or `--global` |
| `qol-mini harmonize <project>\|check\|undo\|scan` | repo scope, both agents: one command converts, `check` exits for CI, `undo` restores, `scan` lists repos under named roots |
| `qol-mini vitals [agents-md\|skills] [project] [--repo-only] [--json] [--fix [--dry-run]]` | repo scope, both agents: every gate or the named one; exit 0, 1 a probe failed, 2 unreadable; read-only, except `--fix`, which runs the commands the findings name |
| `qol-mini kaizen release` | writes the `/compact` release token for the current directory, as the hook's `--release` does (`commands/kaizen-cli.ts`) |

`install.sh`, `uninstall.sh`, `install-vscode.sh`, `install-skills.sh` and their
`.ps1` twins run the same commands from a clone, through `scripts/qol-mini.sh`.

## Constraints

### Where the subtree rules live

A nested `AGENTS.md` loads, in both agents, when a file below it is read. Read the one
for the code you change before you change it:

| Rules | File |
|---|---|
| hooks, tab marker, `/compact` gate, installer, status line | `packages/qol-mini/src/kit/AGENTS.md` |
| the OpenCode plugin and its delivery (`src/opencode/` too) | `packages/qol-mini/opencode/AGENTS.md` |
| writing a bank skill | `packages/qol-mini/skills/AGENTS.md` |
| `qol-mini harmonize` (`src/core/harmonize/`, `src/commands/harmonize-*.ts` too) | `packages/qol-mini/src/harmonize/AGENTS.md` |
| the `vitals` launcher and its WASI host (`src/commands/vitals-*.ts` too) | `packages/qol-mini/src/vitals/AGENTS.md` |
| the Rust gates | `crates/AGENTS.md` |

`src/opencode/`, `src/core/harmonize/`, `src/commands/` and `tests/` hold an `AGENTS.md` that
points to the file to read.

### Restarts and lessons

- Do not ask for a restart: hooks and `statusLine` reload alone. Only the `env` block and
  a skills directory created after startup need a new session; reloading the editor
  window restarts nothing.
- A lesson goes to the repo's rules file (`AGENTS.md`, else `CLAUDE.md`) or to a named
  skill. Never to `~/.claude/CLAUDE.md`.

### Skills

- One bank: `packages/qol-mini/skills/`, shipped in the package. `QOL_MINI_BANK`
  points the CLI at another directory; the tests use it.
- A skill declares its `{{NAME}}` placeholders in `qol-mini.yaml`. Only declared
  names are substituted.
- `RELEASE_COMMAND` and `QOL_MINI_VERSION` are computed, never asked
  (`commands/builtins.ts`). `skills check --frozen` reads the pin from the lock: a kit
  upgrade alone changes no installed copy.
- A skill copy in a project names no machine path: its `RELEASE_COMMAND` is
  `npx qol-mini@<pin> kaizen release`. Only the global copy names the hook by absolute
  path (ADR 0011).
- The lock, `.claude/qol-mini.lock.json`, is the managed set: a skill directory
  absent from it is never touched without `--replace`.
- `install` on a managed skill is an update: three-way merge of the installed
  template, the disk and the shipped template. `--replace` takes the shipped side.
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

## Method

- The shell is zsh: quote a word that starts with `=` and any glob passed as an
  argument, and wrap a command in a function, not in a variable: `$CMD args` is
  one word there. Never name a variable `path`: zsh ties it to `$PATH`.
- `node`, `python3` and `cargo` are mise shims: in a copy of the repo (a
  worktree, an export) they fail with `mise.toml are not trusted`. Set
  `MISE_TRUSTED_CONFIG_PATHS=<copy>` on the command; `mise trust` is for a clone.
- Verify a negative result before concluding.
- Check a doc claim with `curl -sL https://code.claude.com/docs/en/<page>.md` and
  `grep`, never a fetched summary: summaries truncate and report ABSENT.

## Verified, and not

The README's "Verified where" table states what ran where, and what never did. Claim no
more; a new verification adds its row there.

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
- A push is done when its `test` run is green (`gh run watch <id> --exit-status`).
  Reading a failed job, a cancelled one, `test-windows`: `docs/ci.md`. Keep the Windows
  job: it is the only place the native path runs.
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
