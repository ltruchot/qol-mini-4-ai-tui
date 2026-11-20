# 0010 — A finding names the command that fixes it

## Context

- `qol-mini vitals` audits and never writes (ADR 0005, ADR 0009). `qol-mini harmonize`
  and `qol-mini skills install` write, each with its own plan, backup and undo.
- A probe's `fix:` line is a sentence. For some findings a `qol-mini` command does
  exactly what the sentence says: a lone `CLAUDE.md` is what `harmonize --only rules`
  renames.
- The gates are Rust run as WebAssembly: they cannot launch a program. The CLI that
  launches them can.
- The review skills (ADR 0008) propose edits an agent applies by hand. A hand edit has no
  backup and no undo.

## Decision

- A finding carries an optional **command**: the `qol-mini` arguments that apply its
  fix, without the repository. The probe sets it, in Rust, next to the fix
  (`Finding::with_command`). The text report prints it as a `run:` line under `fix:`.
- A command is set only when it does what the fix says on every repository the
  finding can fire on, or refuses and writes nothing. A fix no command applies keeps
  its sentence.
- Each gate takes `--json` and prints its report as one object: gate, `passed`, and per
  finding the probe, verdict, scope, evidence, message, fix and command.
  `qol-mini vitals --json` prints the gates' objects as one array.
- `qol-mini vitals --fix` reads those reports, keeps each command that a
  repository-scope finding names, once, in probe order, runs it with the repository as
  last argument, then audits again in text. `--dry-run` names the commands and runs
  none. `--dry-run` without `--fix`, and `--json` with it, are refused.
- The CLI runs a command only when its first word is `harmonize` or `skills`. Any other
  is an error.
- TypeScript reads the report and launches. It decides no verdict and sets no command.
- A user-scope finding never triggers a command: it is about files outside the
  repository.
- Without `--fix`, `vitals` writes nothing.

## Consequences

- One path from audit to change: the finding, its `run:` line, `vitals --fix`.
- The exit status of `vitals --fix` is the second audit's, and at least 1 when a command
  failed or refused.
- A new command in a probe is a claim about another part of the kit: its test runs the
  gate, then the command, then the gate again (`tests/e2e/vitals-fix*.test.ts`).
- A command is judged on the layout it leaves: `AM01` names the bridge mode beside a
  `CLAUDE.local.md`, and no command beside a `.claude/CLAUDE.md` with its own rules,
  since either file makes Claude Code skip `AGENTS.md`.
- The WASI host gains no call: stdout goes to a sink the launcher passes.
- The JSON object is an interface. A field is added, never renamed.
- `serde_json` enters the gates' modules, already admitted in the workspace (ADR 0007).
