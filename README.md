# qol-mini-4-ai-tui

[![test](https://github.com/ltruchot/qol-mini-4-ai-tui/actions/workflows/test.yml/badge.svg)](https://github.com/ltruchot/qol-mini-4-ai-tui/actions/workflows/test.yml)

Kit for [Claude Code](https://code.claude.com) and
[OpenCode](https://opencode.ai): hooks and a status line for every project,
skills per project, one repo harmonized for both agents. One install wires both
agents. One package, `qol-mini`.

For several sessions at once: each one shows whether it is running, waiting on
you, or idle.

| | |
|---|---|
| **Context gauge** | `Opus 5 (1M context) ▓▓▓▓░░░░░░ 88/200k · my-project` — green, orange at 100k, red at 200k |
| **Sounds** | two rising notes: the agent waits on you · one low note: turn over |
| **Tab marker** (VS Code, Cursor, opt-in) | `🟢 my-project` working · `🔴 my-project` blocked on you · `🟡 my-project` idle |
| **Kaizen** | `/compact` refuses until you run `/kaizen`, a review of what this session got wrong |
| **Skills, per project** | `qol-mini skills install qa-pr ./my-project` — placeholders filled, local edits merged on update |
| **Harmonize, per repo** | `qol-mini harmonize /path/to/repo` — one repo, both agents: rules, permissions, commands, agents, MCP |
| **Opt out, per project** | `touch <project>/.claude/qol-mini-off` — [what it silences](#leave-one-project-alone) |

| Supported | |
|---|---|
| Node.js | `>=22.18` |
| Claude Code | `>=2.1.277`, which reads `AGENTS.md` |
| OpenCode | `>=2.1`, published as `@opencode/*` on npm; the `opencode-ai` package is 1.x |
| OS | Linux, macOS, WSL, Windows |
| Editor (tab marker) | VS Code, Cursor |
| License | MIT |

## Quick start

Nothing to clone.

```bash
pnpm dlx qol-mini install                                   # 1. global: asks four yes/no questions, plus two thresholds when the gauge is on
pnpm dlx qol-mini skills install /path/to/my-project        # 2. skills: pick from a list
pnpm dlx qol-mini skills install qa-pr /path/to/my-project  #    or name them
```

`npx qol-mini <command>` and `npm install -g qol-mini` run the same package.

| Step | Writes into | Then |
|---|---|---|
| 1 | `~/.claude` (or `$CLAUDE_CONFIG_DIR`), `~/.config/opencode` (or `$XDG_CONFIG_HOME/opencode`) | start a new Claude Code session; `opencode service restart` |
| 2 | `/path/to/my-project/.claude/skills/` and `.claude/qol-mini.lock.json` | commit both; start a new session in that project |

A skill asks for its values once (`qa-pr`: the GitHub repo, the production URL).
Shipped skills: `css-modern`, `datastar`, `npm-vulnerability-check`, `qa-pr`, `vp`, `kaizen`.

## Install

| Command | From a clone, with [Vite+](https://viteplus.dev) (`.sh`, `.ps1`) |
|---|---|
| `qol-mini install` | `./install.sh` |
| `qol-mini uninstall` | `./uninstall.sh` |
| `qol-mini vscode` | `./install-vscode.sh` |
| `qol-mini skills install` | `./install-skills.sh` |
| `qol-mini skills <other>` | `./scripts/qol-mini.sh skills <other>` |
| `qol-mini --version`, `-v` | |

| `qol-mini install` asks | When |
|---|---|
| four yes/no questions: gauge, sounds, kaizen, tab marker | no option and a real console |
| two numbers: the orange and the red threshold | the gauge answered yes |
| nothing | any option, or a stdin that is not a console |

Then start a new Claude Code session. Reloading the editor window is not enough.

Writes into `~/.claude` (or `$CLAUDE_CONFIG_DIR`) and `~/.config/opencode` (or
`$XDG_CONFIG_HOME/opencode`). `settings.json` and `cli.json` are merged, not
replaced, and backed up first. Your own hooks, permissions and plugins survive.

### Options

Each option changes one thing and keeps the rest as installed.

| | |
|---|---|
| `--statusline` / `--no-statusline` | gauge (default on) |
| `--sounds` / `--no-sounds` | sounds (default on) |
| `--kaizen` / `--no-kaizen` | compaction review (default on) |
| `--tab-state` / `--no-tab-state` | tab marker (default off, see [its cost](#tab-marker)) |
| `--warn N` / `--alert N` | gauge thresholds (100000 / 200000) |
| `--defaults` | every default, no questions |
| `--replace` | overwrite a delivered file you edited |

### Editor

`qol-mini vscode` sets `terminal.integrated.tabs.title` in every user
`settings.json` found for VS Code, VS Code Insiders, VSCodium and Cursor, for the
tab marker only.

| | |
|---|---|
| `--dry-run` | print what would change, write nothing |
| `--force` | write the setting again where it is already set |
| `--revert` | remove the setting |

### Update

```bash
pnpm dlx qol-mini@latest install --replace
```

Keeps your options. Without `--replace`, an edited file makes the installer stop
and write nothing. Your own sound files are never overwritten.

A project that runs its own setup is left alone with
[`.claude/qol-mini-off`](#leave-one-project-alone).

### Uninstall

```bash
pnpm dlx qol-mini uninstall
```

Removes what was installed, nothing else.

### Clone or npm

| | From a clone | From npm |
|---|---|---|
| Needs | Node.js, git, Vite+ to build | Node.js |
| Install | `git clone`, then `./install.sh` | `pnpm dlx qol-mini install` |
| Skills in a project | `./install-skills.sh qa-pr <project>` | `pnpm dlx qol-mini skills install qa-pr <project>` |
| Update | `git pull && ./install.sh --replace` | `pnpm dlx qol-mini@latest install --replace` |
| Left on the machine | the clone | nothing: `dlx` runs from a temporary cache, the hooks are copied into `~/.claude` |

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| status line blank, no hook runs | the hooks name the absolute path of the Node that ran the installer; a version manager removed or replaced it | `pnpm dlx qol-mini@latest install --replace` |
| `install` stops and names files | a delivered file was edited | `--replace` overwrites it |
| no tab marker | one of its [three requirements](#tab-marker) is missing | `qol-mini vscode`, `install --tab-state`, a new session |
| no sound | no player on `PATH` | see [Sounds](#sounds) |

## OpenCode

One install wires both agents with one feature set: each option below applies
to both, and the kaizen tokens, the sounds and the opt-out file are shared.

| Feature | In Claude Code | In OpenCode |
|---|---|---|
| Skills | `.claude/skills/`, a skill is a slash command | the same files, discovered from `.claude/skills`; loaded by the agent or `@name` |
| `/kaizen` | the skill's command | `commands/kaizen.md`, delivered into the OpenCode config dir |
| `/compact` gate | a `PreCompact` hook | the plugin's `/compact` entry, held back until `/kaizen` ran; the built-in entry is beyond a plugin and compacts ungated |
| Sounds | a hook plays `~/.claude/sounds` | `attention` in `cli.json`, playing the same files |
| Tab marker | a hook emits the title sequence | the plugin emits it on `/dev/tty`; `terminal.title` is set to `false` |
| Context gauge | the status line | not ported: the TUI footer shows context already |

Delivered into `~/.config/opencode/`: `plugins/qol-mini/` (two faces, loaded
by the service and the TUI), `commands/kaizen.md`, and the `cli.json` merge.
Several plugin copies can be live at once and see one compaction event: the
first to claim the event through a marker in the state dir sends the one
reminder. Features are read from the Claude Code `settings.json`: the two agents
always show the same set. The service watches the plugin dir: changed
files reload hot, no restart.

Not ported: the context gauge, the sounds, and the tab marker on Windows
(no `/dev/tty`).

## Harmonize

One repo, both agents. The first run picks the source of truth, the side
the repo already uses; every run converts that side to the other one.
Targets Claude Code 2.1.277+ and OpenCode 2.1+.

```bash
qol-mini harmonize /path/to/my-project        # plan, show, write
qol-mini harmonize /path/to/my-project --dry-run
qol-mini harmonize /path/to/my-project --only rules   # one slice first
qol-mini harmonize check /path/to/my-project  # exit 0 in sync, 1 update, 2 drift
qol-mini harmonize undo /path/to/my-project --dry-run
qol-mini harmonize scan ~/workspace          # list repos, write nothing
```

| Converts | Claude Code | OpenCode 2.1 |
|---|---|---|
| Rules | `CLAUDE.md` | `AGENTS.md`, the canonical file; a file importing the other is merged; `--rules bridge\|symlink` for the exceptions |
| Permissions | `permissions` in settings.json | `permissions` array in opencode.json; a legacy `permission` map is read |
| Commands | `.claude/commands/*.md` | `.opencode/commands/*.md`; `context: fork` <-> `subagent` |
| Agents | `.claude/agents/*.md` | `.opencode/agents/*.md`; a `tools` list stays an allowlist |
| MCP | `.mcp.json`, `${VAR}` | `mcp.servers` in opencode.json, `{env:VAR}`; legacy flat entries are read |
| Models | `opus`, `sonnet`, `haiku`, `fable` | `anthropic/claude-*`; an unmapped model is omitted and named |
| Skills | `.claude/skills/` | the same files, discovered natively |
| Hooks | settings.json | reported with their plugin event or hook |

| | |
|---|---|
| `--from claude\|opencode\|auto` | the source of truth: detected on the first run, kept after; `auto` detects again |
| `--rules pure\|bridge\|symlink` | what CLAUDE.md becomes: gone (default), `@AGENTS.md`, or a symlink; kept on a re-run |
| `--only rules,perm,mcp,commands,agents` | convert these slices only; a later run completes the rest |
| `--replace` | settle a CLAUDE.md/AGENTS.md conflict, overwrite a generated file edited by hand, override a stricter legacy permission |
| Existing config | `opencode.json(c)`, `settings.json`, `.mcp.json` are patched in place: comments, key order and indent kept |
| Lossy | every key, rule or server with no counterpart is named in the output, never dropped silently |
| Re-run | idempotent: a repo in sync writes nothing |
| The lock | a `harmonize` section in `.claude/qol-mini.lock.json`, commit it |
| `undo` | replays every run backwards; a file edited since is left in place unless `--replace`; `--dry-run` lists the steps |
| Backups | `~/.cache/qol-mini/harmony/<repo>/` |
| Output | `--json`, `--dry-run`, `-y`, `--cwd` |

Details: [docs/harmonize.md](docs/harmonize.md).

## Context gauge

Fills toward the **alert threshold**, not the window: on a 1M model, 200k is 20%
of the window and a window-relative bar would look empty when you should worry.
Past the threshold it reads `! 250/200k`.

Thresholds: `--warn`, `--alert`, or `CC_CONTEXT_WARN` / `CC_CONTEXT_ALERT` in the
`env` block of `settings.json`.

## Sounds

| File | Fires on |
|---|---|
| `needs-you.wav` | permission prompt, question, choice, usage-limit wait that needs your Enter |
| `done.wav` | end of a turn, end of a manual `/compact`. Silent while a subagent or background task keeps the session busy |

A turn that ends on a question plays `needs-you`, not `done`.

**Own sounds**: drop a `.wav` (or ogg, flac, mp3, m4a, aiff) named `needs-you` or
`done` into `~/.claude/sounds/`. Back to the defaults:
delete the file, then `qol-mini install`: a missing sound is created, an existing
one is never rewritten.

**Nothing plays?** Linux and WSL need one of `paplay`, `pw-play`, `aplay`,
`ffplay`, `mpv`, `play`. Test with `paplay ~/.claude/sounds/done.wav`. On WSL,
check the Windows volume mixer. macOS uses `afplay`, Windows PowerShell's `Media.SoundPlayer`.

Why a hook: the VS Code and Cursor terminals get no built-in Claude Code
notification, and the built-in bell cannot tell "waiting on you" from "done".

## Tab marker

```
🟢 api-server    🔴 web-client    🟡 docs
```

| Marker | Meaning |
|---|---|
| 🟢 | working — includes subagents, background tasks, a running `/compact` |
| 🔴 | blocked on you — permission, question, choice, API error, usage-limit wait |
| 🟡 | idle |

Red fires the moment a permission dialog appears, not six seconds later.
Markers: `CC_TAB_WORKING`, `CC_TAB_BLOCKED`, `CC_TAB_IDLE` in the `env` block.

**Cost**: the editor setting `terminal.integrated.tabs.title: ${sequence}` applies
to every terminal. A zsh tab shows `you@host:~/long/path` instead of `zsh`. Fix in
`.zshrc`, after `source $ZSH/oh-my-zsh.sh`:

```zsh
ZSH_THEME_TERM_TITLE_IDLE="%1~"
```

Or undo the setting: `qol-mini vscode --revert`.

**Known gap**: Esc, or refusing a permission, fires no hook. The tab keeps its last
marker until your next message.

**Needs all three**, none reports its absence: the editor setting above
(`qol-mini vscode`), `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` in the `env` block
(`install --tab-state`), and a new session. Claude Code's own animated title wins
otherwise.

Not possible: coloring the tab icon. VS Code exposes no sequence for it
([anthropics/claude-code#56925](https://github.com/anthropics/claude-code/issues/56925)).

## Kaizen

`/compact` stops:

```
Compaction held back: this session's friction has not been reviewed.
Run /kaizen to review it, then /compact again.
```

| Step | `/kaizen` does |
|---|---|
| 1 | updates `TODO.md`, an index under 100 lines: where the session stopped, one line per item left; an item that needs context gets `todo/<slug>.md`; done items and their files are removed, links checked |
| 2 | proposes at most three items, one message each, in an ASCII block with a one-sentence TLDR: `ADD` a line it had to work around the lack of, `CUT` one that earns nothing, `MOVE` one loaded at the wrong moment, `REWORD` one it misread; you answer yes or no; none is normal |
| 3 | proposes the handoff lines at the top of `CLAUDE.md`, the split of an oversized `TODO.md`, and a merge of `SESSION_STATE`-style files |
| 4 | releases the block: `/compact` goes through, once |

After any compaction, the agent is told to read `TODO.md` when it exists: a
`SessionStart` hook in Claude Code, a reminder from the plugin in OpenCode.

Automatic compaction is never blocked. Skip a review:
`node ~/.claude/hooks/precompact-kaizen.mjs --release`. In OpenCode the
built-in `/compact` entry is beyond a plugin: it compacts ungated, and the
plugin's own entry is the one that holds back.

## Skills

Shipped in the package: `css-modern`, `datastar`, `npm-vulnerability-check`, `qa-pr`, `vp`, `kaizen`.
`qol-mini` below is `pnpm dlx qol-mini`, or `./scripts/qol-mini.sh` from a clone.

```bash
qol-mini skills install qa-pr ./my-project    # into ./my-project/.claude/skills/qa-pr
qol-mini skills install ./my-project          # pick from a list; without a console, the installed ones
qol-mini skills update ./my-project           # merge the kit's changes, keep local edits
qol-mini skills install --replace ./my-project   # take the kit's version of every edited file
qol-mini skills list ./my-project             # alias: ls
qol-mini skills check ./my-project            # exit 0 ok, 1 update, 2 modified, 3 tampered
qol-mini skills check --frozen ./my-project   # also re-render the template, compare it to the lock
qol-mini skills remove qa-pr ./my-project     # alias: rm
```

| | |
|---|---|
| Project argument | any argument holding `/` or `\`, or `.`; none: the git root above the current directory |
| `--cwd <dir>` | the directory a relative project, or the git root lookup, starts from |
| `--global` | the Claude Code config dir instead of a project |
| `{{NAME}}` in a skill | asked once, then read from the lock; `QOL_MINI_ANSWER_<NAME>` answers without a prompt |
| A file you edited | three-way merge; conflict markers when both sides changed a line; `--conflict rej\|ours\|theirs` |
| `-y`, `--dry-run`, `--json` | no prompt · preview only · machine output for `list` |
| Commit | `.claude/skills/` and `.claude/qol-mini.lock.json` |
| Never commit | `.claude/qol-mini.local.json`: secret answers, gitignored by the installer |

Details: [docs/skills.md](docs/skills.md).

## Linters and managed skills

A formatter or linter that rewrites a managed skill makes `skills check` exit 2 and the next
`skills update` conflict. `skills install` and `skills check` print the paths to ignore and
the tools configured at the project root. The kit writes no linter config.

| Tool | Ignore the path in |
|---|---|
| Prettier | `.prettierignore` |
| ESLint | a config object holding only `ignores`, in `eslint.config.*` |
| Biome 2 | `files.includes`, negated: `"!.claude/skills/<name>"` |
| Biome 1 | `files.ignore` |
| Oxlint | `ignorePatterns` in `.oxlintrc.json` |
| Oxfmt | `ignorePatterns` in `.oxfmtrc.json` |
| Vite+ | `fmt.ignorePatterns` and `lint.ignorePatterns` in the root `vite.config.ts` |
| Stylelint | `.stylelintignore` |
| markdownlint | `.markdownlintignore`, or `ignores` in `.markdownlint-cli2.jsonc` |
| dprint | `excludes` in `dprint.json` |
| lint-staged, lefthook, husky | the glob of each command that formats or fixes |

Prompt for an agent, to paste in the project:

```text
This project installs skills with qol-mini. The managed ones are the keys of "skills" in
.claude/qol-mini.lock.json; each lives in .claude/skills/<name>/. They are vendor files: no
formatter and no linter of this project may rewrite or report them.

1. List the managed skills: read .claude/qol-mini.lock.json.
2. Find every tool that formats or lints files here. Look at the root and at each workspace
   package for: .prettierrc*, prettier.config.*, .prettierignore, eslint.config.*,
   biome.json(c), .oxlintrc.json, .oxfmtrc.json, vite.config.* with a fmt or lint block,
   .stylelintrc*, stylelint.config.*, .markdownlint*, dprint.json, .editorconfig-driven
   formatters, and the commands in package.json scripts, Makefile, lint-staged, lefthook.yml,
   .husky/ and the CI workflows.
3. For each tool found, add one ignore entry per managed skill, .claude/skills/<name>/, in
   that tool's own ignore mechanism. Never ignore .claude/skills/ as a whole: the skills
   written by hand in this project stay linted and formatted. Keep the existing entries and
   comments. Add a one-line comment saying the path is managed by qol-mini.
4. If a command passes .claude/skills explicitly (a script, a hook glob), check that the
   tool's ignore file still applies to it; if it does not, narrow the command.
5. Verify: run each formatter in check mode and each linter over .claude/skills, and show
   that no managed file is reported or changed. Then run
   `pnpm dlx qol-mini skills check .` and report its output.
6. If `skills check` says a managed skill is "modified on disk", do not reformat it back by
   hand. Show the diff against the kit's version with
   `pnpm dlx qol-mini skills install <name> . --dry-run` and ask whether the local changes
   are wanted, or whether `--replace` should restore the kit's files.
7. Change nothing else. Do not commit.
```

## Leave one project alone

```bash
mkdir -p <project>/.claude && touch <project>/.claude/qol-mini-off
```

| In that project | |
|---|---|
| `/compact` | never held back |
| after a compaction | nothing is injected |
| tab marker, sounds | silent |
| `/kaizen` | still runs if you type it |
| status line | still this one, unless the project sets its own `statusLine` |

Sessions started below the file are covered too. Remove the file to undo.

An empty file switches all of it off. A file that names features switches off those only:

```bash
echo kaizen > <project>/.claude/qol-mini-off         # marker and sounds stay
echo "tab sounds" > <project>/.claude/qol-mini-off   # the kaizen review stays
```

| Word | Switches off |
|---|---|
| `kaizen` | the `/compact` block, the `TODO.md` reminder after a compaction |
| `tab` | the tab marker |
| `sounds` | the sounds |

Skills are never concerned: they are files in the project. The OpenCode plugin
asks the same file the same questions: one opt-out covers both agents.

## Files

```
~/.claude/
├── statusline-context.mjs
├── hooks/tab-state.mjs
├── hooks/precompact-kaizen.mjs
├── skills/kaizen/SKILL.md
├── sounds/{play.mjs,needs-you.wav,done.wav,silent.wav}
├── state/                      kaizen tokens, one per project directory
└── settings.json               statusLine + hooks, merged

~/.config/opencode/
├── plugins/qol-mini/           index.js (service), tui.js (TUI), shared.js
├── commands/kaizen.md          the /kaizen command
└── cli.json                    attention sounds + terminal.title, merged

<project>/.claude/
├── skills/<name>/              rendered skills
├── qol-mini.lock.json          what was installed, with hashes and answers
└── qol-mini.local.json         secret answers, mode 0600

~/.cache/qol-mini/              templates for merges, one backup per skill
~/.cache/qol-mini/harmony/      harmonize backups, one slot per replaced file
```

## Develop

```bash
vp install
vp run ready      # format, lint, types, 50-line gate, tests, build, pack check
```

| CI job (`.github/workflows/test.yml`) | Runs on | Checks |
|---|---|---|
| `ready` | Linux, macOS; Linux under Node 22.18.0 | the same gates as `vp run ready` |
| `test-windows` | Windows | `vp run -r test`; reported, not gating |
| `install-cycle` | Linux, macOS, Windows | the built CLI on a real runner: install, update with `--replace`, a delivered hook run alone, a skill installed and checked, uninstall leaving `settings.json` empty |

Release: [docs/release.md](docs/release.md).

## Verified where

| Where | What |
|---|---|
| WSL2 (terminal and Claude Code), Node 24 | the test suite; install, update, uninstall and skills install against throwaway directories, from a clone and from npm through `pnpm dlx` |
| CI: Linux, macOS | the test suite |
| CI: Linux, macOS, Windows | install, update, a delivered hook run alone, a skill installed and checked, uninstall |
| WSL2, VS Code, a live session | the tab marker, the sounds, `/compact` held back then released by `/kaizen` |
| WSL2, the OpenCode service and TUI, live sessions | the install into `~/.config/opencode` with the user's `cli.json` intact, the plugin loaded by the service, `/kaizen` in the command list, the kaizen skill discovered from `~/.claude/skills`, a manual compaction released through the plugin's entry with the token honored, a tokenless `/compact` held back by the plugin's entry, one reminder per compaction after the fix, the tab marker painted red on a paused session and green through the resumed run, the refusal's modal and toast on a tokenless gated `/compact` |
| WSL2, Node 24 | `harmonize --dry-run` on four real repos (this kit and three legacy-layout repos, one of them a monorepo) and `harmonize scan` over a 24-repo workspace |
| WSL2, OpenCode 2.1.2, isolated `HOME` and `XDG_*` | a harmonized Claude Code repo loads in OpenCode: the `permissions` and `mcp.servers` in `debug config`, the agent and its allowlist in `debug agents`, the command in `GET /api/command` |
| Nowhere yet | sounds on macOS and native Windows; editor settings on native Linux, macOS, Windows; a `harmonize` write followed by live sessions in both agents — the dry-runs and the suite are the proof so far |

## Related

- [franzvill/claude-code-tab-title](https://github.com/franzvill/claude-code-tab-title) — two-state tab title, plugin, writes to `/dev/tty`
- [LiveNL/tmux-claude-status-tabs](https://github.com/LiveNL/tmux-claude-status-tabs) — four states on tmux, catches Esc via the transcript
- [dimokol/claude-notifications](https://github.com/dimokol/claude-notifications) — VS Code extension, focus button on the notification
- `claude agents` — built-in view of which session needs input, in its own screen
- [Hooks reference](https://code.claude.com/docs/en/hooks) · [Status line](https://code.claude.com/docs/en/statusline)
