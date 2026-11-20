# 0011 — A project skill names no machine path

## Context

- The kaizen skill ends by releasing `/compact`: it writes a token, keyed on the working
  directory, under `<config dir>/state/`, which the `PreCompact` hook consumes.
- The global copy, in `~/.claude/skills/kaizen/`, runs the delivered hook by absolute path:
  the interpreter (`process.execPath`, ADR 0002) and the hook script.
- A copy installed in a project, `.claude/skills/kaizen/`, is committed with the lock
  (`docs/skills.md`, "Files"). With the same command, the rendered `SKILL.md` and the lock's
  answers held the user's home directory and a Node path that exists on one machine.

## Decision

- `qol-mini kaizen release` writes the same token as the hook's `--release`, from the same
  module (`kit/hooks/kaizen-token.ts`), for the current directory.
- A project copy's `RELEASE_COMMAND` is `npx qol-mini@<QOL_MINI_VERSION> kaizen release`,
  computed from the pin: the kit version at install or update, read from the lock under
  `skills check --frozen`.
- The global copy keeps the absolute hook path: it never leaves the machine and runs with no
  package fetch.

## Consequences

- A committed kaizen copy works on any machine where the kit is installed, and names no user.
- The project release fetches the pinned package once, then runs from the npm cache.
- A project copy installed before this change updates cleanly: the lock's old answer
  renders the merge base, the new command is the shipped side.
- Every committed render of a bank skill is checked by the same rule: a computed value
  holds no absolute path.
