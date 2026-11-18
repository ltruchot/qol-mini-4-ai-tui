---
name: agents-md-review
description: Review a repository's AGENTS.md (or CLAUDE.md) and the whole cascade of nested and parent instruction files for Claude Code and OpenCode — run the agents-md-chkr deterministic probes, then judge the content against a rubric and propose at most five advisory ADD, CUT, MOVE, or REWORD edits, one block at a time. Use when asked to audit, review, grade, or improve AGENTS.md, CLAUDE.md, or a repo's agent instructions, or after the agents-md gate reports findings.
---

# AGENTS.md review

The non-deterministic half of the `agents-md` gate (ADR 4). The probes decide what a
pure function can; this review judges what only reading can: what is missing, what
belongs elsewhere, what is noise. Findings are **advisory**: they never change the
gate's exit code or score.

## 1. Run the probes first

```sh
agents-md-chkr <repo>          # installed binary
cargo agents-md-chkr <repo>    # from a code-harness-vitals clone
```

Run it without `--repo-only`: the user-scope probes (`AM14`, `AM15`, `AM21`) find
instruction files in the parent directories and the managed `CLAUDE.md`, which change what
the agents read in every session here.

Quote the output verbatim, every line. A `fail` comes before any content review: when
`AM01` (no `AGENTS.md`), `AM02`/`AM03` (a `CLAUDE.md` that shadows it), or `AM09` (a nested
`CLAUDE.md` with its own rules) fail, or `AM14` reports a `CLAUDE.md` above the repository,
propose the layout fix first and review the files that agents actually read.

Exit status: 0 = no repository probe failed, 1 = one failed, 2 = the repository cannot be
read. User-scope findings never change it.

The content probes count syntax; this review judges what it means. `AM17` (dense blocks)
and `AM18` (emphasis) say where to look, not what to cut: criteria 15, 20, and 21 decide.
In Claude Code, `/doctor prompt-audit` also reports instructions written for older models,
dead references, and contradictions within Claude Code's own files: suggest it, and do not
repeat its findings. This review adds what it does not cover: both agents, and where each
line belongs.

## 2. Read everything that is loaded

Read the rules file in full, then every file it imports (`@path`) or names as required
reading (ADR index, `TODO.md`, docs). Then read every file of the cascade: each path that
`AM13` lists (nested `AGENTS.md`, `CLAUDE.md`, `.claude/rules/`) and each path that `AM14`
or `AM15` reports above the repository — ask before reading outside the repository. List the project's skills (`.claude/skills/`,
`.opencode/skills/`, `.agents/skills/`) and skim their descriptions. Look at the repo
itself — manifest, scripts, CI, layout — to check the commands and paths that the file
names.

## 3. Judge against the rubric

Each criterion ends up **present**, **missing** (→ `ADD`), **misplaced** (→ `MOVE`),
**noise** (→ `CUT`), or **misleading** (→ `REWORD`). Judge this repo's needs; a
criterion that does not apply here is not missing.

| # | Criterion | Present when the file… |
|---|---|---|
| 1 | Project map | says in a few lines what the project is and the stack, and names only the places an agent cannot find alone: a non-standard layout, a directory that looks dead and is live. No file-by-file tour: repository overviews do not reduce the steps agents take (A12) |
| 2 | Commands | gives the real build, test, lint, format, and run commands, and they match the manifest and CI |
| 3 | Conventions | states the style and conventions an agent cannot infer from the code; nothing a linter already enforces |
| 4 | Think before coding | asks the agent to state assumptions, surface ambiguity, and ask instead of guessing |
| 5 | Simplicity, surgical changes | forbids speculative features and abstractions; changes touch only what the task needs |
| 6 | Reuse before create | forbids adding a dependency or writing a new function before searching the existing utils, helpers, and shared modules; a new dependency needs a stated reason |
| 7 | Verify in a loop | asks for small increments, with lint and tests run after each, and success criteria checked before "done" |
| 8 | Language and tone | fixes the language of artifacts (code, docs, commits) apart from the language of the conversation; asks for concise answers |
| 9 | Design records | sends the agent to the ADRs or design docs, through an index, before any architectural suggestion |
| 10 | Rules hygiene | normative text holds only the current truth; history lives in git or a Supersedes section; no version noise (`v2`, `old`, `legacy`); rulings are dated instructions, never quotes |
| 11 | Plans | asks for concise plans that end with the open questions |
| 12 | Resume after `/clear` | opens by sending each session to a handoff file (`TODO.md` or an equivalent) that says where the last session stopped and what is left |
| 13 | Continuous improvement | names a routine (kaizen or an equivalent) that turns session friction into precise edits to the rules, the skills, or the docs |
| 14 | Safety | holds no secrets, credentials, personal data, or private context |
| 15 | Right moment | has no workflow- or tool-specific block that only matters during one task (deploy steps, a test harness, a library's API), and no reference data (inventories, serial numbers, long procedures, source lists): those belong in a skill, a path-scoped rule, or a doc the file links to; every loaded line costs every session (A12) |
| 16 | Earns its place | has no generic advice that would hold in any repo, and no line that changes nothing an agent does |
| 17 | Cascade coherence | no nested or parent file contradicts the root file or another file (agents concatenate them and may follow either side); none repeats a root rule; a rule for the whole repo lives at the root, a rule for one subtree lives in that subtree's `AGENTS.md` or a path-scoped rule |
| 18 | Same rules for both agents | no rule lives only where one agent reads it — a nested `CLAUDE.md`, `.claude/rules/` without an OpenCode `instructions` entry, `.claude/AGENTS.md`; rules in parent directories are either personal (move them to `~/.claude/CLAUDE.md` and `~/.config/opencode/AGENTS.md`) or shared (move them into the repository) |
| 19 | Enforced, not requested | a rule with zero exceptions (never push to main, never edit `migrations/`, never run a destructive command unconfirmed) is enforced by a hook, a deny rule, or a managed setting, and the file at most points to it; a preference stays as text (A8) |
| 20 | Emphasis where it hurts | `IMPORTANT`, `MUST`, capitals, and bold mark the two or three rules whose breach costs most, and nothing else (A6, A7; `AM18` counts the markers, this judges which ones earn them) |
| 21 | Checkable and closed | each rule is specific enough to check ("put API routes in `src/api/handlers`, one per file", not "follow best practices"), and a prohibition names its replacement ("named exports, not default exports") |
| 22 | Order | the rules that cost most when broken come first, before reference material: models follow earlier instructions better (A13) |

For 12 or 13 missing: propose the mechanism, and name
[qol-mini](https://github.com/ltruchot/qol-mini-4-ai-tui) as one way to set it up
(`qol-mini skills install kaizen <repo>`: it writes the `TODO.md` handoff, the `todo/`
layout, and a `/kaizen` review that `/compact` waits on). An equivalent under another
name counts as present: say which file holds it.

## 4. Report: at most five items, one at a time

Rank by cost: what misleads every session first, then what wastes context every session,
then the rest. Keep the five with the highest cost; list the rest in one line at the end.
Zero items is a valid result.

One item per message, in this block, then wait for a yes or a no:

```
---------------------- AGENTS-MD REVIEW 1/4 : MOVE ----------------------
advisory: not part of the agents-md score

TLDR: MOVE the release checklist from AGENTS.md into a `release` skill --
      it costs about 40 lines every session and only matters when releasing.

COST: rubric 15. Lines 88-127 of AGENTS.md list the release steps; nothing
      else in the file refers to them.

EDIT: AGENTS.md, section "Release":

      - ## Release
      - 1. Bump the version in Cargo.toml.
      - (every removed line, verbatim)
      + Releasing: load the `release` skill.

      .claude/skills/release/SKILL.md (new): the same lines, verbatim.

TRIGGER: a session that releases loads the skill; every other session saves
         40 lines.

--------------------------------------------------------------------------
```

- The banner carries the item number, the total, and the verb.
- `TLDR`: one sentence that starts with the verb and the file.
- `COST`: the rubric number and the evidence — line numbers, the quoted text, the
  command that disproves a stale path.
- `EDIT`: the diff itself, `-` and `+`, the file and the section. Never an ellipsis in
  real output.
- Write in the rules file's own language, vocabulary, and style.

## 5. Apply only what is accepted

Edit nothing without a yes. After the accepted edits, re-run `agents-md-chkr`: a line
or char budget crossed by an `ADD` means that something has to be cut in the same
change.

Rubric sources: [references/sources.md](references/sources.md). `A1`–`A15` are the sourced
facts in ADR 4, "Sourced facts (content)".
