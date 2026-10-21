# Harmonizer follow-ups

Design: `docs/adr/0003-agents-md-is-the-canonical-rules-file.md`,
`docs/adr/0004-opencode-output-is-checked-against-its-schema.md`, detail:
`docs/harmonize.md`.

## Open in the converters

- One direction per repo: in a repo holding both sides, what only the
  non-source side has stays there. A union per artifact (each file keeps
  its own source) would cover it; `.opencode/skills` -> `.claude/skills`
  first, Claude Code reads no `.opencode/` directory.
- `check` after `--only` without `rules` reports the rules row as drift:
  the lock does not record which slices ran. A `slices` field in the
  `harmonize` section would settle it.
- A shared JSON file edited since the last run needs `--replace`, even when
  the edit touches no owned key. Compare the owned keys, not the file hash.
- `undo` restores a shared JSON file from its first backup: a key the user
  added since is lost (the file is named first, `--replace` forces it).
  Removing the owned keys instead would keep it.
- The legacy OpenCode migration is copied, not imported
  (`src/core/harmonize/perm-read.ts`): re-check it against
  `config/normalize.ts` when OpenCode moves.

## P2 — hooks to plugin shims

- Generate `.opencode/plugins/harmonize-<project>.js` per repo: a plugin that
  runs the repo's Claude Code hook commands on the mapped events
  (`SessionStart -> session.created`, `PreToolUse -> hook tool/execute.before`,
  `PostToolUse -> hook tool/execute.after`, `PreCompact -> session.compaction.started`,
  `Notification -> tui.toast.show`), passing the event JSON on stdin and
  `CLAUDE_PROJECT_DIR` in the environment, the way the Claude Code runner does.
- Precedent in the kit: the OpenCode plugin already gates `/compact` with the
  same token the PreCompact hook consumes.
- Unmapped events (`statusLine`, `InstructionsLoaded`) stay reported.
- `undo` removes the generated plugin; `check` hashes it like any artifact.

## P2 — home audit

- `qol-mini harmonize --global`: audit `~/.claude` against
  `~/.config/opencode`. Rules: `~/.claude/CLAUDE.md` is read by OpenCode as a
  fallback — never create `~/.config/opencode/AGENTS.md`, it would shadow it.
- Convert `~/.claude/commands/*.md` and `~/.claude/agents/*.md` when present;
  report hooks with no OpenCode form (the kit's own are covered by its plugin).
- MCP: compare `~/.config/opencode/opencode.json` `mcp.servers` against the
  Claude Code global config, report differences, convert on request.

## P3 — CI and Orca

- CI: `qol-mini harmonize check` in a workflow, exit 1 on a source change,
  2 on drift.
- Orca (stablyai/orca) hosts the agents; nothing converts. Validate: the
  `qol-mini-off` walk under parallel worktrees, the plugin's tab marker in its
  terminal UI, one kaizen token per worktree.
