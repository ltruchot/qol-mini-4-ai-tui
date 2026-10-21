# Harmonize

`qol-mini harmonize` makes one repo work under both agents: whatever the repo
holds for Claude Code gains an OpenCode side, and whatever it holds for
OpenCode gains a Claude Code side. One command, per repo, both directions.

| Command | Does |
|---|---|
| `qol-mini harmonize <project>` | plan the repo, show every move, write it |
| `qol-mini harmonize <project> --dry-run` | show the plan, write nothing |
| `qol-mini harmonize check <project>` | exit 0 in sync, 1 a source changed, 2 a generated file moved, for CI |
| `qol-mini harmonize undo <project>` | put the repo back, from the lock and the backups |
| `qol-mini harmonize scan <roots...>` | list repos to harmonize under each root, write nothing |

Common options: `--from claude\|opencode` (the source of truth, auto-detected on
the first run, kept on the next), `--rules pure\|bridge\|symlink`, `--replace`,
`--json`, `-y`. A project argument works like the skills commands: absent, the
git root above the current directory.

## What converts

| Slice | Claude Code | OpenCode | Notes |
|---|---|---|---|
| Rules | `CLAUDE.md` | `AGENTS.md` | AGENTS.md becomes the canonical file, the only one after a `pure` run |
| Permissions | `permissions.allow/deny/ask` in settings.json | `permission` array in opencode.json | `Bash(x:*)` -> `x *`, `WebFetch(domain:d)` -> `https://d/*`; a rule with no counterpart is named, never dropped silently |
| Commands | `.claude/commands/*.md` | `.opencode/commands/*.md` (the dir the repo already uses) | `allowed-tools` <-> `tools`, `argument-hint` kept, body untouched |
| Agents | `.claude/agents/*.md` | `.opencode/agents/*.md` | `tools` list <-> `permission` map, `mode: subagent`, model aliases gain their `provider/` prefix |
| MCP | `.mcp.json` `mcpServers` | `opencode.json` `mcp` | stdio <-> `local` command array, url <-> `remote`; literal secrets are named |
| Skills | `.claude/skills/` | the same files | nothing to convert: OpenCode discovers the directory |
| Hooks | `hooks` in settings.json | plugin events | reported, mapped (SessionStart -> session.created, PreToolUse -> tool.execute.before, ...); conversion to plugin code is not done |

Settings stay one file per side: the run merges into what is there and backs
up what it replaces, first in `~/.cache/qol-mini/harmony/<repo>/`, outside the
repo. `settings.local.json` is machine-local and is never converted. A merged
JSON file keeps the keys the user wrote.

## Rules modes

| Mode | Result | For |
|---|---|---|
| `pure` (default) | `AGENTS.md` alone | Claude Code v2.1.277 and later reads it natively |
| `bridge` | + `CLAUDE.md` holding `@AGENTS.md` | sessions that cannot read AGENTS.md: pre-2.1.277 versions, a disabled plugin, a `CLAUDE.local.md` in the tree |
| `symlink` | + `CLAUDE.md -> AGENTS.md` | the layout a repo held before, on platforms that allow symlinks |

A run warns when a `CLAUDE.md`, a `.claude/CLAUDE.md` or a `CLAUDE.local.md`
sits in or above the repo: those files make Claude Code skip `AGENTS.md`, and
the bridge mode is the answer. A repo holding two different rules files is a
conflict: nothing is written until `--replace` says which side wins, `--from
claude` keeps `CLAUDE.md`, `--from opencode` keeps `AGENTS.md`.

## The lock

`.claude/qol-mini.lock.json` gains a `harmonize` section: the direction, the
rules mode, every generated file with the hash of its bytes and of its
sources. `check` reports `ok`, `update` (a source changed, exit 1), `drift`
(a generated file edited or missing, exit 2) per file, rules by layout state.
`undo` replays the recorded moves backwards, restores replaced files from
their slots, removes created files, and drops the section, keeping `skills`.
Commit the lock: `check` and `undo` read it on every machine.

A repo that runs its own installer-managed trees (`.opencode/` fully managed
by another tool) still harmonizes: generated files the run does not own are
never overwritten without `--replace`, and a name it would overwrite is named
as a warning.
