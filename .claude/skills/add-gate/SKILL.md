---
name: add-gate
description: Add a gate to qol-mini vitals end to end, on its own branch and pull request — source both agents' real behavior, specify the gate in ADR 0008, build the deterministic Rust probes app (crates/GATE-chkr) with unit, real-tree, and container tests, wire it into the qol-mini vitals command, write its advisory review skill in the bank, update the docs, and open a draft PR for code review. Use whenever the task is to implement, start, or extend a gate or a pillar check (skills, codebase-memory, context-limiting, commit-gates, agent-config, or a new one), or to add probes to an existing gate.
---

# Add a gate

The `agents-md` gate is the **live template**: `crates/agents-md-chkr/` and the ADR 0008
section "The agents-md gate". Copy its shape from there; this skill holds no copy of it.

**One layer, one commit**, on branch `gate/<id>`. A fix that a later layer forces on an
earlier one (the ADR, `vitals-utils`) goes in the commit that found it, and its message
says so. `cargo xtask check` takes minutes: build each layer completely with the fast
loop in [TESTS.md](TESTS.md), run it, then commit once.

## 1. Frame

Read `TODO.md`, the pillar in ADR 0005, and the ADR 0008 sections "Gate anatomy", "What goes
where", "Review contract", and "Gate catalog". Pick the gate id and a probe prefix.

The base must be the published `main`, holding the live template: after `git fetch`,
`git rev-list --left-right --count origin/main...main` prints `0 0`. When it does not,
ask the user to push or pull `main` first. Then `git switch -c gate/<id> main`.

This PR ships the gate's own probes. Integrating an external scanner is a later PR with
its own ADR amendment.

**Done when:** the branch exists on that base, and `git grep -n '"<PREFIX>01"'` finds
nothing.

## 2. Source the behavior

Every probe encodes a claim about how Claude Code or OpenCode behaves, and its tests
encode the same claim. Map the **cascade** of every file the gate judges, for both agents:
where it loads from (root, subdirectories, parent directories, home, global config), what
shadows what, name variants, and size limits. How to reach each source:
[RESEARCH.md](RESEARCH.md).

A fact that contradicts an existing gate is a bug there: fix it on `main` first, in its
own commit with its tests (`Fix <probe>: <the claim>`), then rebase the branch onto it.

**Done when:** a table lists every fact with its agent, its source (docs URL, OpenCode
commit and file, or an empirical run with its version), and confirmed yes or no. An
unconfirmed fact feeds the review or "Not probed yet", never a probe.

## 3. Specify in ADR 0008 — commit

Design the probes per "What goes where". Give each probe an id, a scope (repository, or
user: warn at most, skipped by `--repo-only`), its verdicts, its evidence path, and a fix
for every warn and fail. List the review rubric, each criterion with its source. Add a
`### The <id> gate` section to ADR 0008 shaped like the `agents-md` one, holding the whole
step 2 table, the probe table, and what is not probed yet; add its References. The
catalog row stays ⏳ until step 7. A decision ADR 0008 does not cover (a new crate, an
output format) amends the ADR that owns it.

**Done when:** every probe row has an id, scope, verdicts, evidence, and fix, and every
fact row has a source. Commit `Specify the <id> gate in ADR 0008`.

## 4. Share before you write — commit if anything moved

Read `crates/vitals-utils/src/` and the `agents-md-chkr` modules before writing any
function. Product code is never duplicated:

- A helper the gate needs that lives in `agents-md-chkr` moves to `vitals-utils` with its
  tests, and `agents-md-chkr` imports it from there.
- Every filesystem primitive goes to `vitals_utils::fs`, even one that a single gate
  uses.
- A helper found during step 5 moves in the step 5 commit.

**Done when:** `git grep -n 'fn <name>'` finds one definition of each moved helper.
Commit `Share <helpers> through vitals-utils`.

## 5. Build the probes — commit

The files, as in `agents-md-chkr`: `lib.rs` with `audit(root, Reach)`; `main.rs` with
`[PATH]` and `--repo-only`; all I/O in `snapshot.rs` through `vitals_utils::fs`; one pure
function per probe. Add the `<id>-chkr` alias to `.cargo/config.toml`. Tests at all three
levels, per [TESTS.md](TESTS.md).

Wire the gate into the CLI: its name and module in `packages/qol-mini/src/vitals/gates.ts`,
the module in `scripts/wasm.ts` and `scripts/packcheck.ts`, the crate in `CONTAINER_GATES`
(`crates/xtask/src/plan.rs`). `vp run wasm`, then compare `qol-mini vitals <id>` with
`cargo <id>-chkr` on the same trees: same stdout, same exit status. A call the module
imports that `src/vitals/wasi/` lacks fails at instantiation: add it there.

**Done when:** `cargo xtask check` and `vp run ready` pass, and
`qol-mini vitals <id> --repo-only .` prints what `cargo <id>-chkr --repo-only .` prints. Commit `Add the <id> gate probes`, with the `Cargo.lock` change.

## 6. Write the review skill — commit

Create `packages/qol-mini/skills/<id>-review/` (`SKILL.md`, `references/sources.md`,
`qol-mini.yaml`), in the shape of `agents-md-review`, under the bank rules of AGENTS.md
("Skills": public, generic, through `skill-creator`): run the probes and quote them, read what they point to,
judge with a numbered rubric (present, `ADD`, `MOVE`, `CUT`, `REWORD`), report at most
five items in the block format of `agents-md-review` step 4, labeled advisory, and apply
only what the user accepts.

**Done when:** run by hand, it quotes the probes and returns at most five blocks: on this
repository, or on a scratch repository built from the gate's test fixtures when this one
has nothing for the gate to judge. Commit `Add the <id>-review skill`.

## 7. Document — commit

Set the ADR 0008 catalog row and the Implementation Status rows to ✅. Update
`docs/vitals.md` (the Gates row, a `### <id>` section with the command and the probe
table), the README (the Vitals gate table, the shipped skills), the Implementation Status
row in ADR 0005, the alias list and commands table in ADR 0007, the feature row of
AGENTS.md, and `TODO.md` ("Where we stopped", and the
not-probed-yet items under "Later").

**Done when:** every line of `git grep -n '<PREFIX>[0-9]'` and `git grep -n '<id>-chkr'`
matches the final probe range and paths. Commit
`Document the <id> gate`.

## 8. Open the pull request

Follow [PR.md](PR.md).

**Done when:** `git log --oneline main..` shows one commit per layer, the draft PR is
open, `code-review` leaves no confirmed finding unfixed, and CI is green. Then
`gh pr ready`, and call the Skill tool with `kaizen`.
