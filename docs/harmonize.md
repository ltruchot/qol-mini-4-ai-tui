# Harmonize

`qol-mini harmonize` makes one repo work under both agents. The first run
picks the source of truth, the side the repo already holds most of; every
run converts that side to the other one. A repo that already holds both keeps
what the other side has on its own: it is never converted back. Targets:
Claude Code 2.1.277 and later, OpenCode 2.1 and later.

| Command | Does |
|---|---|
| `qol-mini harmonize <project>` | plan the repo, show every move, write it |
| `qol-mini harmonize <project> --dry-run` | show the plan, write nothing |
| `qol-mini harmonize <project> --only <slices>` | `rules`, `perm`, `mcp`, `commands`, `agents`, comma-separated |
| `qol-mini harmonize check <project>` | exit 0 in sync, 1 a source changed, 2 a generated file edited or missing, for CI |
| `qol-mini harmonize undo <project>` | put the repo back, from the lock and the backups; `--dry-run` lists the steps |
| `qol-mini harmonize scan <roots...>` | list repos to harmonize under each root, write nothing |

Common options: `--from claude\|opencode\|auto` (detected on the first run,
kept on the next, `auto` detects again), `--rules pure\|bridge\|symlink`
(kept on the next run), `--replace`, `--json`, `-y`. An unknown value is an
error. A project argument works like the skills commands: absent, the git
root above the current directory.

## What converts

What OpenCode reads is checked against `@opencode/schema` 2.1, the schemas
OpenCode loads its config with: the test suite decodes every generated file.

| Slice | Claude Code | OpenCode 2.1 | Notes |
|---|---|---|---|
| Rules | `CLAUDE.md` | `AGENTS.md` | AGENTS.md becomes the canonical file, the only one after a `pure` run |
| Permissions | `permissions.allow/ask/deny` in settings.json | native `permissions` array in opencode.json | see below |
| Commands | `.claude/commands/*.md` | `.opencode/commands/*.md` (the dir the repo already uses) | `description`, `model`, `context: fork` + `agent` <-> `subagent` + `agent`; body untouched |
| Agents | `.claude/agents/*.md` | `.opencode/agents/*.md` | native keys only: `description`, `mode: subagent`, `model`, `steps` <-> `maxTurns`, `color` as hex, `permissions` |
| MCP | `.mcp.json` `mcpServers` | `mcp.servers` in opencode.json | stdio <-> `local` command array, `http`/`sse` <-> `remote`; `${VAR}` <-> `{env:VAR}` |
| Models | `opus`, `sonnet`, `haiku`, `fable`, `claude-*` | `anthropic/claude-*` | the alias follows its family's latest model; `inherit` is omitted |
| Skills | `.claude/skills/` | the same files | OpenCode reads `.claude/skills` natively |
| Hooks | `hooks` in settings.json | plugin events and hooks | reported with the event or hook a plugin listens to; not converted |

A key, rule or server with no counterpart is named in the output, never
dropped silently: `allowed-tools` (a per-turn grant OpenCode has no form
for), `argument-hint`, `permissionMode`, an unmapped model, `${VAR:-default}`
(OpenCode has no default), a disabled OpenCode server (not converted).

### Permissions

| Claude Code | OpenCode | |
|---|---|---|
| `Bash(git:*)`, `Bash(git *)` | `shell` `git *` | |
| `Read(./p)`, `Edit(/p)`, `Write(//abs)` | `read`/`edit` `p`, `p`, `/abs` | OpenCode matches paths from the project root |
| `WebFetch(domain:d)` | `webfetch` `https://d/*` and `http://d/*` | a `*` in the domain matches more URLs in OpenCode: named |
| `Agent(x)`, `Skill(x)` | `subagent` `x`, `skill` `x` | |
| `mcp__server__tool` | `server_tool` | |

- Precedence. Claude Code applies deny, then ask, then allow. OpenCode
  applies the last matching rule. Converted rules are written allow, then
  ask, then deny, ahead of the user's own `permissions` entries, which keep
  the last word.
- OpenCode evaluates a legacy `permission` map before the `permissions`
  array. A converted rule that would override a stricter legacy rule is a
  conflict: nothing is written until `--replace`.
- An agent's `tools` list is an allowlist: it becomes `deny *`, one allow per
  tool, then the project's ask and deny rules again. OpenCode evaluates an
  agent's rules after the project's; Claude Code applies the project's denies
  to subagents too.
- OpenCode -> Claude Code: an exception, a looser rule after a stricter one
  it overlaps, has no Claude Code form: it is named, and Claude Code keeps
  the stricter rule.

### Files the user wrote

`opencode.json`, `opencode.jsonc`, `settings.json` and `.mcp.json` are
patched in place: only the keys the kit owns move, comments, key order and
indent stay. The run backs up what it changes in
`~/.cache/qol-mini/harmony/<repo>/`, outside the repo. A file changed since
the last run needs `--replace`. `settings.local.json` is machine-local and is
never converted.

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
`undo` replays the moves of every run backwards, restores replaced files
from their first backup, removes created files, and drops the section,
keeping `skills`. A generated file edited since the run is left in place and
named, with the section and its backups, until `undo --replace`.
Commit the lock: `check` and `undo` read it on every machine.

A repo that runs its own installer-managed trees (`.opencode/` fully managed
by another tool) still harmonizes: generated files the run does not own are
never overwritten without `--replace`, and a name it would overwrite is named
as a warning.
