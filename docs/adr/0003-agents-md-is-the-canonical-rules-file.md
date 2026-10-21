# 0003 — AGENTS.md is the canonical rules file

## Context

- A repo's rules live in `CLAUDE.md` (Claude Code), `AGENTS.md` (the cross-tool
  standard OpenCode, Cursor, Codex and the other agents read), or both.
- Claude Code reads `AGENTS.md` natively since v2.1.277, as a fallback: a
  `CLAUDE.md` or a `CLAUDE.local.md` in the tree makes it ignore `AGENTS.md`.
- OpenCode reads `CLAUDE.md` as a fallback too: an `AGENTS.md` wins there.
- A repo holding both files diverges by default: each tool reads its own.
- Three layouts close that gap: pure (`AGENTS.md` alone), bridge (a
  `CLAUDE.md` holding only `@AGENTS.md`), symlink (`CLAUDE.md -> AGENTS.md`).
  A bridge survives a Windows checkout without `core.symlinks`, where a
  committed symlink checks out as a one-line text file; a symlink does not.

## Decision

- The harmonizer leaves every repo with `AGENTS.md` as the single canonical
  rules file. `pure` is the default; `--rules bridge` and `--rules symlink`
  are the fallbacks for a repo that needs Claude Code to keep reading its
  rules under old versions (pre-2.1.277), a disabled AGENTS.md plugin, or a
  `CLAUDE.local.md` the user keeps.
- Rules files are never artifacts of the lock: `AGENTS.md` stays the user's
  file, verified by layout state, not by hash.

## Consequences

- A pure repo works in Claude Code v2.1.277 and later, and in every
  AGENTS.md-reading agent. The run warns when a `CLAUDE.md` or a
  `CLAUDE.local.md` sits in or above the repo: those files make Claude Code
  skip `AGENTS.md`, and the bridge mode is the answer named in the warning.
- The first run of `qol-mini harmonize` decides the source of truth; a re-run
  keeps it, and `--from` overrides it. Auto-detection is not stable once both
  sides exist: a flip would convert the tool's own output back.
- The rename of `CLAUDE.md` is a plain rename: git records it as a rename at
  commit time, with no `git mv` step inside the user's repo.
- Not measured: how a repo behaves whose parent directories hold a
  `CLAUDE.md` while the repo itself is pure. The warning names the files;
  the behavior belongs to Claude Code.
