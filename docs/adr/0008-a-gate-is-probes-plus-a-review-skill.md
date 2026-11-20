# 0008 — A gate is probes plus a review skill

**Date**: 2026-11-14
**Status**: Accepted
**Context**: Turns ADR 0005's six pillars into runnable gates. Each gate is a Rust binary on
the ADR 0007 stack. The first gate, `agents-md`, proves the model.

## Implementation Status

| Component                                   | Status     | Location                                   |
| ------------------------------------------- | ---------- | ------------------------------------------ |
| Gate model (this ADR)                       | ✅ Done    | `docs/adr/`      |
| Shared findings, budgets, markers, file I/O | ✅ Done    | `crates/vitals-utils/`                        |
| `agents-md` gate: probes                    | ✅ Done    | `crates/agents-md-chkr/`                     |
| `agents-md` gate: review skill              | ✅ Done    | `packages/qol-mini/skills/agents-md-review/` |
| `agents-md` gate: cascade probes            | ✅ Done    | `crates/agents-md-chkr/src/{cascade,nested,ancestors}.rs` |
| `agents-md` gate: content probes (`AM16`–`AM21`) | ✅ Done    | `crates/agents-md-chkr/src/{imports,content,rules}.rs` |
| Container end-to-end tests                  | ✅ Done    | `crates/*-chkr/tests/container.rs`         |
| `skills` gate: probes (`SK01`–`SK20`)       | ✅ Done    | `crates/skills-chkr/`                        |
| `skills` gate: review skill                 | ✅ Done    | `packages/qol-mini/skills/skills-review/`   |
| Other gates (catalog below)                 | ⏳ Planned | -                                          |

## Problem

A repository is ready when Claude Code or OpenCode can work in it with nothing missing.
Part of that can be decided by a pure function of the files on disk: a file exists, a
layout is unambiguous, a budget holds, a marker is present. Part of it cannot: whether
an `AGENTS.md` names the right commands, holds a block that belongs in a skill, or lacks
a rule that every session needs. ADR 0005 kept the score deterministic. Without a defined
place for the judgment half, the most useful findings on instruction files cannot be
reported at all.

## Decision

**Every check is a gate with a deterministic part, run in Rust, and, where content must
be judged, an agent part, run as a skill in the user's own Claude Code or OpenCode
session. Only the deterministic part sets the exit code and the score.**

### Gate anatomy

- **Id and pillar**: a kebab-case id (`agents-md`) and the ADR 0005 pillar it serves.
- **Probes**: the deterministic part. Each probe has a stable id (`AM01`) and returns a
  verdict — `pass`, `warn`, `fail`, or `n/a` — with the evidence path (relative to the
  repository root), what it observed, and a concrete fix for a `warn` or a `fail`.
  Probes are pure functions of a snapshot read once at the boundary.
- **Exit status**: 0 when no probe fails (warnings included), 1 when one does, 2 when
  the gate cannot run (bad usage, unreadable repository).
- **Review skill**: the agent part, optional per gate. It is a `SKILL.md` with a rubric,
  shipped next to the binary.

### What goes where

A probe decides anything that a pure function of the files can decide: presence, layout,
sizes, explicit markers, paths that resolve. The review gets only what needs reading for
meaning: what is missing, what is misplaced (it belongs in a skill, a path-scoped rule,
the docs, or a code comment), what contradicts something else, and what is noise. When a
review criterion becomes decidable by a marker, it moves into a probe.

### Review contract

A review skill:

1. runs the gate binary first and quotes its findings;
2. reads the judged file in full, and everything it imports or requires;
3. returns at most five items, each an `ADD`, `CUT`, `MOVE`, or `REWORD` block with
   evidence, in the format of the qol-mini kaizen skill, one item per message;
4. edits nothing without the user's yes;
5. labels every item **advisory**: a review never changes the exit code or the score.

It runs inside the user's agent session, so it needs no API key, and it behaves the same
in Claude Code and OpenCode, which read the same `SKILL.md`.

### Layout

- `crates/<gate>-chkr/`: one binary per gate, with its review skill in
  `skills/<gate>-review/`.
- `crates/vitals-utils/`: only code that two or more gates need — `Finding`, `Verdict`,
  `Report`, `Outcome` (exit contract), `Reach` (`--repo-only`), `or_pass`, `TextSize` and
  `Budget`, the marker paths agents read (`AGENTS.md`, skill roots), and the filesystem
  boundary (`require_dir`, `read_optional`, `exists`, `link_target`, `project_files`,
  `parent_dirs`). A helper that a second gate needs moves here; one
  needed by a single gate stays in its app.

### Gate catalog

| Gate | Pillar | Probes (deterministic) | Review (agent, advisory) | Status |
| --- | --- | --- | --- | --- |
| `agents-md` | 1. Instruction files | `AM01`–`AM21`, below | `agents-md-review`: 22-criterion rubric | ✅ |
| `skills` | 2. Skills | `SK01`–`SK20`, below | `skills-review`: 15-criterion rubric | ✅ |
| `codebase-memory` | 3. Codebase memory | a code-intelligence MCP server or plugin is wired in for both agents | - | ⏳ |
| `context-limiting` | 4. Context limiting | an output-capping tool or hook is wired in for both agents | - | ⏳ |
| `commit-gates` | 5. Deterministic gates | an active hook runner whose hooks call lint, format, type check, tests, vulnerability and secret scans; CI runs the same list | whether the gate list fits the stack | ⏳ |
| `agent-config` | 6. Agent-config security | permission lists, pinned MCP servers, auto-approving hooks | - | ⏳ |

### The `agents-md` gate

Instruction files cascade, and the cascade changes what each agent reads. Both agents
concatenate every file they load; neither has override semantics, so when two files
disagree the model may follow either one.

| Where | Claude Code | OpenCode 2 |
| --- | --- | --- |
| Working directory and every parent, up to `/` | `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` load at launch; `AGENTS.md` and `.claude/AGENTS.md` too, but **only when none of the three `CLAUDE.md` files exists at that level or above** | every `AGENTS.md` from the working directory up to `$HOME` (when the repository is under it) or the project root, nearest first; no `CLAUDE.md` |
| Subdirectories | `CLAUDE.md` and `CLAUDE.local.md` load on demand when a file there is touched; a subdirectory `AGENTS.md` loads on Read only if that subdirectory has none of the three `CLAUDE.md` files | a subdirectory `AGENTS.md` loads when the read tool opens a file below it |
| `.claude/rules/**/*.md` | loaded, at launch or (`paths`) on demand | not read, unless listed in `opencode.json` `instructions` |
| Exempt | `~/.claude/CLAUDE.md` and the managed file load alongside `AGENTS.md` | `~/.config/opencode/AGENTS.md` is the global file |
| Never read | `AGENTS.local.md`, `AGENTS.override.md`, `.agents/` | anything but `AGENTS.md` and configured `instructions` |
| Size | launch files over 4 MiB are skipped; on-demand files over 40,000 chars (200K context) are truncated | no limit found |

A single canonical `AGENTS.md` per directory is therefore the only layout that both agents
read the same way. A `CLAUDE.md` that only imports it (`@AGENTS.md`) or is a symbolic link
to it is an accepted bridge. A `CLAUDE.md` in a parent directory outside the repository —
`~/CLAUDE.md`, `~/workspace/CLAUDE.md`, `/CLAUDE.md` — silently turns off every
`AGENTS.md` in Claude Code while OpenCode keeps reading them: the two agents then follow
different rules with nothing in the repository to show it.

Every probe names its source: a fact below (`L` for the cascade, `A` for content, `G` for
the open AGENTS.md format), or **convention** when the check enforces this project's own
practice with no agent behavior behind it.

| Id | Probe | Verdict | Source |
| --- | --- | --- | --- |
| `AM01` | `AGENTS.md` at the root | fail when missing; the fix names `CLAUDE.md` to rename when one exists | G1, L1, L7 |
| `AM02` | root `CLAUDE.md` does not shadow `AGENTS.md` | pass when absent, a bridge, or a link to `AGENTS.md`; fail when it has its own content | L2, L4 |
| `AM03` | `.claude/CLAUDE.md` does not shadow `AGENTS.md` | same as `AM02`, with `@../AGENTS.md` as the bridge | L2, L4 |
| `AM04` | no `CLAUDE.local.md` that makes Claude Code skip `AGENTS.md` | warn when present without a bridge | L3 |
| `AM05` | line budget | warn above 200 lines, never fail (no source gives a length at which a file stops working); measured on what loads (below) | A1 |
| `AM06` | launch size | fail above 4 MiB: Claude Code skips the file and loads none of it | L8 |
| `AM07` | resume after `/clear` or a compaction | warn unless the first 10 lines name `TODO.md` and `TODO.md` exists | **convention** ([qol-mini](https://github.com/ltruchot/qol-mini-4-ai-tui) handoff) |
| `AM08` | continuous improvement | warn unless a `kaizen` skill exists in `.claude/skills/`, the only skill root both agents read; the fix suggests qol-mini, or a symbolic link into `.claude/skills/` | **convention** (qol-mini kaizen); C2 for the root |
| `AM09` | nested `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` | fail for each one with its own rules (OpenCode never reads it; Claude Code skips the sibling `AGENTS.md`); warn for a nested `CLAUDE.local.md`; bridges and links pass | L5, L7 |
| `AM10` | nested budgets | warn above 200 lines (as loaded); fail above 40,000 chars for a file Claude Code loads on demand (a subdirectory `CLAUDE.md` or `CLAUDE.local.md` and each file it imports, a subdirectory's rules, a rule whose `paths` parse); warn above 70,000 chars for a subdirectory `AGENTS.md`, which a hook attaches; fail above 4 MiB for a root rule loaded at launch | A1, L8, L9, L13 |
| `AM11` | `.claude/rules` parity | warn when rules files exist and `opencode.json[c]` does not list `.claude/rules` | L6, L10 |
| `AM12` | names an agent skips | warn for `.claude/AGENTS.md` (Claude Code only), `AGENTS.local.md`, `AGENTS.override.md`, and case variants such as `agents.md` | L1, L7, L11 |
| `AM13` | cascade inventory | lists every nested instruction file, for the review to read | - |
| `AM14` | user scope: `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` in a parent directory (except `~/.claude/CLAUDE.md`) | warn: Claude Code loads it and, without a bridge in the repository, skips every `AGENTS.md` | L1, L2, L12 |
| `AM15` | user scope: `AGENTS.md`, `.claude/AGENTS.md` in a parent directory | warn: rules that teammates and CI do not have | L1, L7 |
| `AM16` | `@path` imports | warn per import: no file at the target; beyond four hops (Claude Code stops there); in an `AGENTS.md`, a target that no `instructions` entry of `opencode.json[c]` matches (OpenCode 2 reads the line as text and never loads the file) | A2, A4, A16 |
| `AM17` | structure | warn per file: a block (paragraph, list item with its continuation lines, table row) over 400 chars; no heading in a file over 30 lines | A5 for the direction; 400 and 30 are **this project's thresholds** |
| `AM18` | emphasis budget | warn per file: more than 3 emphasis markers | A6, A7 |
| `AM19` | references resolve | warn per file: a backticked repository path or a relative Markdown link that resolves to nothing | A9 |
| `AM20` | `.claude/rules` `paths` | warn per rule: unclosed frontmatter, YAML that does not parse (Claude Code then loads the rule in every session), a `paths` value that is neither a string nor a list, brace groups past the 1,000-pattern budget, or a pattern that matches no file in the repository (the rule never loads) | A10, A15, A17 |
| `AM21` | user scope: managed `CLAUDE.md` | warn when `/etc/claude-code/CLAUDE.md` or `/Library/Application Support/ClaudeCode/CLAUDE.md` exists: Claude Code loads it in every session and it cannot be excluded; OpenCode never reads it | A11 |

#### Sourced facts (cascade)

Read on 2026-11-15: the [memory docs](https://code.claude.com/docs/en/memory), the
[AGENTS.md format](https://agents.md/), and OpenCode V2 at `d759c548aa`. **Run** marks a fact
checked with Claude Code 2.1.325 (see "Empirical checks").

| # | Fact | Agent | Source | Confirmed |
| --- | --- | --- | --- | --- |
| L1 | `AGENTS.md` and `.claude/AGENTS.md` in the working directory and every directory above it load at session start, when no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists there or above (default **Project instructions**, v2.1.277 and later) | Claude Code | memory docs, "When Claude Code reads AGENTS.md" | yes, run |
| L2 | a `CLAUDE.md` or `.claude/CLAUDE.md` at that level or above makes Claude read "your `CLAUDE.md` files only" | Claude Code | memory docs, "AGENTS.md" table | yes, run |
| L3 | `CLAUDE.local.md` counts too: adding one "stops Claude from reading `AGENTS.md`" | Claude Code | memory docs, "When Claude Code reads AGENTS.md" | yes, run |
| L4 | a `CLAUDE.md` that imports `@AGENTS.md`, or a symbolic link to it, loads `AGENTS.md` once | Claude Code | memory docs, "Remove an earlier AGENTS.md workaround" | yes, run |
| L5 | a subdirectory `AGENTS.md` loads when Claude reads a file there and the subdirectory has none of the three `CLAUDE.md` files; subdirectory `CLAUDE.md` files load on demand | Claude Code | memory docs, "When Claude Code reads AGENTS.md", "How CLAUDE.md files load" | yes |
| L6 | `.claude/rules/` files load in Claude Code, and do not count against `AGENTS.md` | Claude Code | memory docs, "When Claude Code reads AGENTS.md" | yes |
| L7 | OpenCode reads every `AGENTS.md` from the working directory up to `$HOME` or the project root, a subdirectory's on read, plus configured `instructions`; never `CLAUDE.md` or `.claude/rules` | OpenCode 2 | `config/plugin/instruction.ts`, `tool/plugin/read.ts` | yes |
| L8 | "Claude gets the whole of each CLAUDE.md file that loads at launch, as long as the file is 4 MiB or smaller. Claude Code skips a file over 4 MiB" | Claude Code | memory docs, "Auto memory", "How it works" | yes, run (a 63,748-char root file loads whole) |
| L9 | a subdirectory `CLAUDE.md` or `CLAUDE.local.md` and its imports, a subdirectory's rules file, and a path-scoped rule load on demand under a per-file limit: 40,000 chars with a 200K context window, 150,000–200,000 with 1M; past it Claude receives only the start | Claude Code | memory docs, "Claude ignores the end of my subdirectory CLAUDE.md" | yes, run (in a 1M session: 106,866 chars whole, 159,992 cut) |
| L13 | a subdirectory `AGENTS.md` reaches the model as an attachment to the Read result, through a hook; past some size only a preview of it arrives | Claude Code | not documented | run only: 69,996 chars whole, 99,948 and 106,866 as a preview; the exact threshold is not known, so `AM10` warns |
| L10 | an `instructions` entry is a path or a glob, relative patterns searched from the working directory up to the project root | OpenCode 2 | `config/plugin/instruction.ts` | yes |
| L11 | `AGENTS.local.md` and `AGENTS.override.md` are in neither agent's list of loaded names | both | memory docs; `config/plugin/instruction.ts` | yes (by absence) |
| L12 | `~/.claude/CLAUDE.md`, the managed `CLAUDE.md`, and `.claude/rules/` do not count, and keep loading alongside `AGENTS.md` | Claude Code | memory docs, "When Claude Code reads AGENTS.md" | yes |
| G1 | `AGENTS.md` is "a simple, open format": standard Markdown, no required fields, at the root of the repository; read by over 20 agents (Codex, Jules, Cursor, Gemini CLI, OpenCode, GitHub Copilot, and others) | open format | [agents.md](https://agents.md/), stewarded by the Agentic AI Foundation (Linux Foundation) | yes |
| G2 | suggested sections: project overview, build and test commands, code style, testing instructions, security considerations; commit and pull request rules | open format | agents.md, "How to use AGENTS.md?" | yes |
| G3 | nested `AGENTS.md` files for subprojects: "the closest AGENTS.md to the edited file wins; explicit user chat prompts override everything" | open format | agents.md, FAQ | yes; Claude Code and OpenCode load the nested file in addition to the root one, so the model, not the agent, settles a conflict |
| G4 | migrate an old name by renaming it to `AGENTS.md` and keeping a symbolic link under the old name | open format | agents.md, FAQ | yes |

#### Empirical checks

Claude Code 2.1.325, 2026-11-15: one throwaway Git repository per case, each instruction
file holding a distinct `codeword:`; `claude -p "<list every codeword in your context>"
--model haiku --tools ""` (no tools, so only what loads at launch is seen). Cases 12 and 13 allow the Read tool and ask
for one file in `sub/`, so that the subdirectory files load on demand.

| Case | Files | Codewords seen | Fact |
| --- | --- | --- | --- |
| 1 | `AGENTS.md` | its own | L1 |
| 2 | `AGENTS.md`, `CLAUDE.md` | `CLAUDE.md`'s only | L2 |
| 3 | `AGENTS.md`, `CLAUDE.md` = `@AGENTS.md` | `AGENTS.md`'s | L4 |
| 4 | `AGENTS.md`, `.claude/CLAUDE.md` | `.claude/CLAUDE.md`'s only | L2 |
| 5 | `AGENTS.md`, `CLAUDE.local.md` | `CLAUDE.local.md`'s only | L3 |
| 6 | `AGENTS.md` with one codeword in an HTML comment | the other one only | A3 |
| 7 | `AGENTS.md` with `See @README`, a `README` | `README`'s | A2 |
| 8 | `AGENTS.md`, `CLAUDE.md` as a symbolic link to it | `AGENTS.md`'s | L4 |
| 9 | `AGENTS.md` importing a chain of five files | the first four | A2 |
| 10 | `.claude/AGENTS.md` only | its own | L1 |
| 11 | a 63,748-char `AGENTS.md`, codeword on the last line | its own | L8 |
| 12 | `sub/CLAUDE.md` of 106,866 and 159,992 chars, codewords first and last; `--tools Read`, read `sub/notes.txt` | both at 106,866; the first only at 159,992 | L9 (the 1M limit) |
| 13 | `sub/AGENTS.md` of 59,992 to 106,866 chars, codeword last; same read | the codeword up to 69,996; a hook preview at 99,948 and 106,866 | L13 |

`AM05`–`AM07` judge `AGENTS.md` or, when there is none, the root `CLAUDE.md` (else
`.claude/CLAUDE.md`) that Claude Code loads in its place.

The nested walk is the tree an agent sees: hidden files included, `.gitignore` honored,
`.git/` and `.claude/worktrees/` skipped. User-scope probes (`AM14`, `AM15`) read every
parent directory up to `/` and the home directory, and `AM21` the managed `CLAUDE.md`
paths; they are labeled `(user scope)`, never fail, and never change the exit status. `--repo-only` skips them for reproducible CI runs.

`AM07` and `AM08` detect one convention by its explicit markers. The review recognizes
equivalents under other names (rubric criteria 12 and 13) and suggests
[qol-mini](https://github.com/ltruchot/qol-mini-4-ai-tui) when there is none.

**What loads.** The two agents do not load the same text from one file. Claude Code removes
block-level HTML comments and expands `@path` imports in place (four hops at most); OpenCode
2 injects the file verbatim, comments and `@path` lines included. The line budgets of `AM05`
and `AM10` measure both views and judge the larger; their message gives the Claude Code view
when imports or comments make it differ. The size limits (`AM06`, and `AM10` in chars) apply
to each file as written, the way the docs measure it (`wc -m`). Imports are followed inside the repository only: a
target in the home directory or elsewhere depends on each machine and is not measured.

**Content probes.** `AM16`–`AM19` judge every root rules file with its own content
(`AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`), every nested instruction file that an
agent reads, and the Markdown files that Claude Code loads through their imports, within
four hops. An imported file that is not Markdown (`@package.json`) counts in the budgets
but is not judged as prose, and a file that two sources import is reported once. They
count syntax whose effect a source documents; they never judge meaning, which stays with
the review.

- An **import** is an `@` token at the start of a line or after whitespace (A14) that holds
  a `/` or a `.`, or starts with `~`. A bare word (`@README`, the memory docs' own
  example) is an import when a file of that name exists, sentence punctuation removed; a
  bare word that names no file is read as a mention (`@team`) and not reported. An import
  in an `AGENTS.md` loads in OpenCode only when an `instructions` entry of
  `opencode.json[c]` matches it: a path or a glob, relative to the project
  (`config/plugin/instruction.ts` at `d759c548aa`).
- A **fence** closes only on the character that opened it, repeated at least as many times,
  with nothing after it (CommonMark), so a ```` block can show a ``` example.

- A **block** is a paragraph, a list item with its continuation lines, or a table row,
  outside fenced code and HTML comments. 400 chars is about 100 tokens, four lines of 100
  columns. Anthropic gives the direction ("organized sections are easier for Claude to
  follow than dense paragraphs") but no number: 400 and the 30-line heading floor are this
  project's thresholds.
- An **emphasis marker** is, outside code: one of `IMPORTANT`, `MUST`, `NEVER`, `ALWAYS`,
  `CRITICAL`, `MANDATORY`, `REQUIRED`, `JAMAIS`, `TOUJOURS`, `OBLIGATOIRE`, `IMPÉRATIF`,
  `INTERDIT` written in capitals, or a bold span inside a sentence. A bold span that opens
  its paragraph, list item, or table cell is a label, not emphasis. The budget of 3 is
  the "two or three rules that hurt when broken" of Anthropic's Claude Code course.
- A **repository path** is a code span without spaces that holds a `/`, whose first
  segment exists in the repository, and that holds none of `<>*{}$:=`. A path whose first
  segment does not exist (`/etc/fstab`, `rtl_nic/fw.bin`, a directory still to create) is
  not judged.
- `AM20` matches `paths` patterns with `globset` (`*` stops at `/`, `**` crosses it, braces
  expand) against the repository files, relative to the directory that holds `.claude/`.
  A leading `./` is dropped, and a comma inside `{...}` or quotes does not split a
  pattern. A pattern whose literal directory (`dist` in `dist/**/*.js`) exists on disk but
  is ignored by the walk is not reported: Claude Code still loads the rule when it works
  there.

#### Sourced facts (content)

Read on 2026-11-15. A fact marked **no** feeds the review or "Not probed yet", never a
probe.

| # | Fact | Agent | Source | Confirmed |
| --- | --- | --- | --- | --- |
| A1 | "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence" | Claude Code | memory docs, "Write effective instructions" | yes |
| A2 | imports load at launch with the file that imports them and "don't reduce its context cost"; four hops at most; relative to the importing file; skipped in code spans and fenced code blocks; a quoted path is not imported; `\ ` escapes a space | Claude Code | memory docs, "Import additional files" | yes |
| A3 | block-level HTML comments are stripped before injection; comments inside code blocks are kept | Claude Code | memory docs, "How CLAUDE.md files load" | yes |
| A4 | an `AGENTS.md` is injected as `Instructions from: <path>` followed by its content, unchanged: no import expansion, no comment stripping | OpenCode 2 | `instruction-discovery.ts` (`render`), `config/plugin/instruction.ts` (`read`) at `d759c548aa` | yes |
| A5 | "group related instructions under markdown headers and bullets. Organized sections are easier for Claude to follow than dense paragraphs" | Claude Code | memory docs, "Write effective instructions" | yes |
| A6 | emphasis (`IMPORTANT`, `YOU MUST`) raises a rule's priority only relative to the quieter text around it: spend it on the two or three rules that hurt when broken | Claude Code | Claude Code in Action course, "Configure Claude" | yes |
| A7 | "If Claude keeps ignoring a line that is in CLAUDE.md, adding IMPORTANT probably won't fix it": the file is too long, or the rule belongs in a hook | Claude Code | best-practices docs, "Keep CLAUDE.md short" | yes |
| A8 | a rule with zero exceptions belongs in a hook, a deny rule, or a managed setting; `CLAUDE.md` holds guidelines | Claude Code | best-practices docs; memory docs, "CLAUDE.md vs auto memory" | yes |
| A9 | `/doctor prompt-audit` reports instructions written for older models, references to files or commands that do not exist, and contradictions | Claude Code | memory docs, "Audit your instruction files" | yes |
| A10 | `paths` frontmatter scopes a rule to matching files and accepts a YAML list or a comma-separated string; a rule with `paths` loads only when Claude works with a matching file | Claude Code | memory docs, "Path-specific rules" | yes |
| A11 | the managed `CLAUDE.md` lives at `/etc/claude-code/CLAUDE.md` (Linux, WSL) or `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS), cannot be excluded, and loads alongside `AGENTS.md` | Claude Code | memory docs, "Deploy organization-wide CLAUDE.md" | yes |
| A12 | context files raise inference cost by over 20% and do not generally improve task success; agents follow their instructions; repository overviews do not help | Claude Code, Codex, Qwen Code | Gloaguen et al., arXiv 2602.11988 (ICLR 2026) | yes |
| A13 | instruction following degrades as the number of instructions grows (the best model: 68% at 500); models favor earlier instructions | 20 models | Jaroslawicz et al., IFScale, arXiv 2507.11538 (NeurIPS 2025) | yes, no onset density |
| A14 | an import is `@` at the start of a line or after whitespace; a bare word followed by punctuation (`@README,`) imports the word | Claude Code | the docs show examples only | no: the probe assumes it |
| A15 | `paths` patterns are relative to the directory that holds the rule's `.claude`; `**/*.ts` and `*.md` match at any depth, `/*.md` directly in the base directory, `src/components/*.tsx` directly in that directory; braces expand; a `[` that opens no bracket expression makes the pattern match nothing | Claude Code | memory docs, "Path-specific rules" | yes |
| A16 | an `@path` import is expanded inside an `AGENTS.md` too; `@README` outside backticks imports the file | Claude Code | memory docs, "When Claude Code reads AGENTS.md", "Import additional files" | yes, run |
| A17 | a rule's whole `paths` list shares a budget of 1,000 expanded patterns; past it the braced patterns are used unexpanded and match nothing. Frontmatter whose YAML does not parse is ignored, and the rule loads as if it had no `paths` | Claude Code | memory docs, "Path-specific rules", "Rule frontmatter reference" | yes |

Not probed yet: commands that do not exist (`/doctor prompt-audit` reports them in Claude
Code), the number of instructions (A13 gives no onset density), the order of rules in the
file (A13; review criterion 22), zero-exception rules left as text (A8; review criterion
19, and the `agent-config` gate), imports outside the repository, the `claudeMd` key of
managed settings, Markdown lint and readability scores (no source shows an effect on agent
behavior), instruction files inside ignored dependency directories
(`node_modules/*/AGENTS.md` loads when an agent reads a file there), sessions started in a
subdirectory instead of the root, the Claude Code **Project instructions** setting
(`claude-md-and-agents-md` loads both families) and `claudeMdExcludes`, which live in user
settings, and JSON/SARIF output.

### The `skills` gate

A skill is a directory holding a `SKILL.md`: YAML frontmatter, then Markdown. Both agents
list each skill's description to the model and load the body when a task matches it. They
look in different places, read different fields, and react differently to the same
mistake, so a skill can work in one agent and be invisible or silent in the other.

| Where | Claude Code | OpenCode 2 |
| --- | --- | --- |
| Project roots | `.claude/skills/<name>/SKILL.md` only; never `.agents/` or `.opencode/` | `.claude/skills/`, `.agents/skills/`, `.opencode/skills/`, `.opencode/skill/` |
| Parent directories | the start directory and every parent **up to the repository root** | every directory from the working directory **up to `/`** |
| Subdirectories | `<subdir>/.claude/skills/` loads the first time Claude reads or edits a file there | never: the walk only goes up, and the read tool discovers only `AGENTS.md` |
| Personal | `~/.claude/skills/` | `~/.claude/skills/`, `~/.agents/skills/`, the global config directory's `skill(s)/` |
| Layout | `<name>/SKILL.md`; the folder may be a symbolic link | a directory holding `SKILL.md` (exact name), up to six levels deep, and any `*.md` file directly in a skill root |
| Identity | frontmatter `name`, else the directory name; the directory name also invokes it | the directory name; `name` is only displayed |
| Same name | enterprise over personal over project: `~/.claude/skills/x` beats `.claude/skills/x` | the later source wins: project `.claude/skills/x` beats `~/.claude/skills/x`, and `.agents/skills/x` beats `.claude/skills/x` |
| Frontmatter | read only when `---` is the first line; YAML that does not parse loads the skill with **no fields** | gray-matter; a failed parse is retried with plain values containing `:` rewritten as block scalars, then the skill is skipped |
| Fields | `name`, `description`, `when_to_use`, and a dozen Claude Code extensions; unknown fields are ignored | `name`, `description`, `metadata`, `disable-model-invocation`; a non-string `name` or `description` skips the skill |
| No description | falls back to the first non-empty body line | the skill is never listed to the model |
| Size | `description` + `when_to_use` truncated at 1,536 chars in the listing; "keep `SKILL.md` under 500 lines"; compaction keeps the first 5,000 tokens | no limit found |

#### Sourced facts

Read on 2026-11-14: `https://code.claude.com/docs/en/skills.md`, the
[Agent Skills spec](https://agentskills.io/specification), and OpenCode V2 at
`d759c548aa`, files under `packages/core/src`. A fact marked **no** feeds the review or
"Not probed yet", never a probe.

Claude Code:

| # | Fact | Source | Confirmed |
|---|---|---|---|
| C1 | Project skills load from `.claude/skills/<skill-name>/SKILL.md`; the other locations are enterprise (managed settings dir), personal `~/.claude/skills/`, nested `<subdir>/.claude/skills/`, `--add-dir`, plugins, claude.ai | skills.md, "Choose where skills load" (table) | yes |
| C2 | Claude Code never reads `.agents/skills/` or `.opencode/`: no page of the docs names them | skills.md table; `grep '.agents/skills'` over llms-full.txt (10 MB): 0 hits; Claude Code 2.1.325 `claude -p` init event, on a repository with a skill in each of `.claude/skills/` and `.agents/skills/`, lists only the first | yes (documented and run) |
| C3 | Project skills load from `.claude/skills/` in the start directory and every parent **up to the repository root**, not above it | skills.md, "Load skills in monorepos and subdirectories" | yes |
| C4 | `.claude/skills/` below the start directory load the first time Claude reads or edits a file there | same section | yes |
| C5 | Same name: enterprise over personal over project ("`/deploy` runs the personal one") | skills.md, "Resolve skills that share a name" | yes |
| C6 | A `<skill-name>` entry can be a symlink to a directory; `SKILL.md` is read from the target | skills.md, "Symlinked folders" | yes |
| C7 | A folder named `synced` (any case) or `anthropic-skills` / `anthropic-skills:*` does not load outside a plugin | skills.md, "Reserved name" bullets | yes |
| C8 | Frontmatter is read only when the opening `---` is the first line; otherwise the whole file is content | skills.md, "Frontmatter reference" | yes |
| C9 | YAML that does not parse: the skill loads with no fields set, so Claude cannot match its `description` | "Frontmatter reference"; "Skill not triggering" | yes |
| C10 | `description` is optional; without it Claude Code uses the first non-empty body line | "Frontmatter reference", `description` row | yes |
| C11 | `description` + `when_to_use` are truncated at 1,536 chars in the skill listing (configurable: `skillListingMaxDescChars`) | `description` row; "Skill descriptions are cut short" | yes |
| C12 | `name` defaults to the directory name and sets the `/` command; the directory name also invokes the skill | "How a skill gets its command name" | yes |
| C13 | "Keep `SKILL.md` under 500 lines"; after compaction the first 5,000 tokens of each invoked skill are re-attached (25,000 total) | "Add supporting files" tip; "Skill content lifecycle" | yes |
| C14 | `disable-model-invocation: true`: the description is not in context; only the user invokes the skill | "Control who invokes a skill" | yes |
| C15 | Field names must match exactly; an unknown field is ignored silently | "Frontmatter reference" | yes |
| C16 | `.claude/skills/<name>.md` (a file directly in the skills directory) does not load as a skill | only `<skill-name>/SKILL.md` is documented; `.claude/commands/*.md` is the file form | yes (documented layout) |
| C17 | Deeper layouts (`.claude/skills/<group>/<name>/SKILL.md`) | not documented | **no** |
| C18 | Unclosed frontmatter (opening `---`, no closing one) | not documented | **no** (probe treats it as "no frontmatter", same fix) |
| C19 | The frontmatter reference holds twenty fields: `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`; "Claude Code ignores a field it doesn't recognize without reporting an error" | skills.md, "Frontmatter reference", read on 2026-11-20 | yes |
| C20 | `` !`command` `` is recognized "when `!` appears at the start of a line or immediately after whitespace", and a fence opened with three backticks and `!` holds a multi-line command; both run before the skill content reaches Claude | skills.md, "Inject dynamic context" | yes |
| C21 | An injected command never prompts. Outside auto mode, "when a command's permission check returns anything other than allow, Claude Code aborts the invocation"; `allowed-tools` pre-approves it | skills.md, "Permission checks on injected commands" | yes |
| C22 | `compatibility` "accepts a string of up to 500 characters"; Claude Code does not act on it. `allowed-tools` accepts a space- or comma-separated string, or a YAML list | skills.md, "Frontmatter reference" | yes |
| C23 | Whether an injection mark inside a fenced code block runs | not documented | **no** (probed as an injection: the documented rule names no exemption) |

Agent Skills spec:

| # | Fact | Source | Confirmed |
|---|---|---|---|
| S1 | `name`: 1–64 chars, `a-z`, `0-9`, `-`; no leading, trailing, or doubled hyphen; must match the parent directory name | specification.md, "name field" | yes |
| S2 | `description`: 1–1,024 chars, non-empty | "description field" | yes |
| S3 | Keep `SKILL.md` under 500 lines; body under 5,000 tokens recommended; file references relative to the skill root, one level deep | "Progressive disclosure", "File references" | yes |
| S4 | YAML: a plain (unquoted) scalar cannot contain `: `; `[x] text` opens a flow sequence and fails | YAML 1.2, 7.3.3 plain scalars (the reason OpenCode's `sanitize` exists, see O7) | yes |
| S5 | `compatibility`: "Must be 1-500 characters if provided"; `metadata`: "a map from string keys to string values"; `allowed-tools`: "a space-separated string", experimental | specification.md, read on 2026-11-20 | yes |
| S6 | "List available scripts in your `SKILL.md` so the agent knows they exist"; paths relative to the skill root | agentskills.io, skill-creation/using-scripts.md | yes |
| S7 | "Pin versions (e.g., `npx eslint@9.0.0`) so the command behaves the same over time" | using-scripts.md | yes |
| S8 | A script takes no interactive prompt ("a hard requirement of the agent execution environment"), documents itself through `--help`, sends structured data to stdout and diagnostics to stderr | using-scripts.md | yes (review, criteria 13–15) |
| S9 | How many chars a token holds | Claude glossary: "depends on the model and the language" | **no** (the 5,000-token body target is not probed) |

OpenCode 2:

| # | Fact | Source | Confirmed |
|---|---|---|---|
| O1 | In every directory from the working directory **up to `/`** (`fs.up` with no `stop`), OpenCode reads `.claude/skills/` and `.agents/skills/` | `config/discovery.ts` (`candidates`, `fs.up`), `config/plugin/compatibility.ts` (`path.join(root, "skills")`), `util/src/fs-util.ts` (`up`) | yes |
| O2 | Each `.opencode/` directory on that walk adds `skill/` and `skills/` | `config/discovery.ts` (`project`), `config.ts` (`loadDirectory`), `config/plugin/skill.ts` (`sources`) | yes |
| O3 | Global: `~/.claude/skills/`, `~/.agents/skills/`, the global config directory's `skill(s)/`, and the system directory (`/etc/opencode`) | `config/discovery.ts` (`globalClaudeDirectory`, `globalAgentsDirectory`, `systemDirectory`) | yes |
| O4 | Directories below the working directory are never searched for skills; the read tool discovers only `AGENTS.md` | `config/discovery.ts` (walk is upward only), `tool/plugin/read.ts` (`FILENAME = "AGENTS.md"`) | yes |
| O5 | Scan: a directory holding `SKILL.md` (exact name) is a skill; depth up to 6; `*.md` files directly in a skill root are skills named after the file; entries starting with `.` and `node_modules`, `.git`, `.venv`, `venv`, `__pycache__` are skipped | `config/plugin/skill-scan.ts` | yes |
| O6 | Skill id = directory name; frontmatter `name` is only the display name | `config/plugin/skill-file.ts` (`id`, `Skill.Name.make(frontmatter.name ?? id)`) | yes |
| O7 | Frontmatter schema: `name`, `description` (strings), `metadata`, `disable-model-invocation`; any other key, `when_to_use` included, is not read; a non-string `name` or `description` skips the skill | `config/plugin/skill-file.ts` (`Frontmatter`, `decodeFrontmatter`) | yes |
| O8 | YAML is parsed by gray-matter; on failure `sanitize` rewrites plain values that contain `:` or start with `[x] text` as block scalars and retries; a second failure skips the skill | `config/markdown.ts` | yes |
| O9 | Only skills with a `description` and `autoinvoke` not false are listed to the model; `disable-model-invocation: true` sets `autoinvoke` false | `skill/instructions.ts` (`load`), `config/plugin/skill-file.ts` | yes |
| O10 | Same id inside the compatibility plugin: later wins; order `~/.claude`, project `.claude` farthest to nearest, `~/.agents`, project `.agents` farthest to nearest. So a project `.claude/skills/x` beats `~/.claude/skills/x` | `config/plugin/compatibility.ts` (`loaded.set`), `config/discovery.ts` (`claude`, `agents`, `toReversed`) | yes |
| O11 | Which wins between the compatibility plugin (`.claude`, `.agents`) and the config skill plugin (`.opencode`, configured `skills`) for the same id | plugin activation order not found | **no** |
| O12 | No size limit on `SKILL.md`; loading returns the body and up to 10 sampled files | `skill.ts` (`prepare`) | yes (no limit found) |
| O13 | Global config directory honors `XDG_CONFIG_HOME` | `@opencode/util/global` not read | **no** |
| O14 | `opencode.json` `skills` entries (paths, `~/` paths, or URLs) add skill sources | `config/plugin/skill.ts` (`sources`) | yes (not probed: configuration, see ADR 0008) |

`.claude/skills/<name>/SKILL.md` is therefore the only layout both agents read the same way.
The [Agent Skills spec](https://agentskills.io/specification) adds the portable rules:
`name` is 1–64 chars of `a-z`, `0-9`, and single hyphens, and matches its directory;
`description` is 1–1,024 chars; references are relative to the skill root.

| Id | Probe | Verdict |
| --- | --- | --- |
| `SK01` | project skills exist | warn when no skill is found in any root, at the root or below; the per-skill probes are then `n/a` |
| `SK02` | both agents reach each skill | warn for a skill only in `.agents/skills/`, `.opencode/skills/`, or `.opencode/skill/`: Claude Code never loads it |
| `SK03` | one copy per name | warn when two roots of the same directory hold a skill of the same name with different `SKILL.md` content: Claude Code reads the `.claude` copy, OpenCode keeps one by directory id |
| `SK04` | layout both agents load | warn for a `*.md` file directly in a skill root (OpenCode loads it as a skill, Claude Code does not), for a skill directory whose only `SKILL.md` is a case variant (`skill.md`: neither agent loads it), and for a `SKILL.md` nested below a root folder that holds none (`<group>/<name>/SKILL.md`: OpenCode loads it, O5; Claude Code documents only `<name>/SKILL.md`, C17) |
| `SK05` | nested skill roots | warn for each skill root below the repository root: Claude Code loads it once it works there, OpenCode only in a session started inside that subtree |
| `SK06` | frontmatter parses | fail when `SKILL.md` does not open with `---` on line 1 or never closes it; fail when a top-level unquoted value holds `: ` on any of its lines, starts with `[x] text`, or starts with `` ` ``, `@`, `*` (an alias), `!` (a tag), or `%`, which YAML rejects: Claude Code then loads the skill with no fields; OpenCode repairs a value that holds `:` or starts with `[x] text` and skips the skill otherwise |
| `SK07` | a description to match | fail when `description` is missing, empty, or not a string, unless `disable-model-invocation` is true: OpenCode never lists the skill (or skips it), Claude Code matches on the first body line |
| `SK08` | description length | `description` + `when_to_use` chars: warn above 1,024 (the spec's maximum, enforced by claude.ai uploads and the Skills API), fail above 1,536 (Claude Code truncates the listing) |
| `SK09` | trigger text OpenCode reads | warn when `when_to_use` is set: OpenCode never reads it, so its trigger phrases reach Claude Code only |
| `SK10` | name | fail for a directory or `name` that Claude Code reserves (`synced` in any case, `anthropic-skills…`), and for a `name` that is not a string (OpenCode skips the skill); warn for a name outside the spec's charset, and for a `name` that differs from the directory (Claude Code invokes `/name`, OpenCode the directory id) |
| `SK11` | body budget | warn above 500 lines (Claude Code docs and the spec) |
| `SK12` | references resolve | fail for each relative Markdown link in `SKILL.md`, outside code, inline or a reference definition (`[label]: path`), whose target does not exist, `%XX` escapes decoded; links that leave the repository are not judged. A link that leaves a symbolic-link skill folder passes when it resolves from where the folder is linked or from where it really is; behind a folder outside the repository it is not judged |
| `SK13` | skill inventory | lists every skill with its root, for the review to read |
| `SK14` | user scope: skill roots only OpenCode reads | warn for `.claude/skills/`, `.agents/skills/`, `.opencode/skill(s)/` in a parent directory of the repository (OpenCode loads them in every session here, Claude Code stops at the repository root), and for `~/.agents/skills/` and `~/.config/opencode/skill(s)/` (personal skills Claude Code never reads) |
| `SK16` | fields an agent reads | warn for a top-level frontmatter key outside the twenty of the Claude Code reference (C19): both agents ignore it without an error, so a misspelled `disable_model_invocation` does nothing |
| `SK17` | `compatibility` | warn above 500 chars, or when it is a list or a map (S5, C22) |
| `SK18` | scripts are named | warn for a file under the skill's `scripts/` whose file name `SKILL.md` never holds (S6); hidden files and `__*` directories are not judged |
| `SK19` | package commands are pinned | warn for `npx`, `bunx`, `uvx`, `pnpm dlx`, `yarn dlx`, or `pipx run` in a code span or a fenced block of `SKILL.md` whose package holds no `@version` or `==version` (S7); a path, a variable, or a placeholder is not a package |
| `SK20` | injected commands are pre-approved | warn for an injection line (C20) in a `SKILL.md` with no `allowed-tools`: outside auto mode Claude Code aborts the skill unless a permission rule allows the command (C21) |
| `SK15` | user scope: personal skills that shadow project skills | warn for each skill in the repository's `.claude/skills/` whose name is also in `~/.claude/skills/`: Claude Code runs the personal copy, OpenCode the project one. A pair passes when the repository's `.claude/qol-mini.lock.json` records the skill from the qol-mini bank and both copies carry the same `name` and `description`: the kit's global and project copies of one bank skill, which release the same token |

The tree is the one `agents-md` walks (hidden files, `.gitignore` honored, `.git/` and
`.claude/worktrees/` skipped), plus every skill root read whole with no ignore rule, as
both agents read it: the four at the repository root, each root the walk crosses, and a
root behind a symbolic link (`.claude`, or `.claude/skills` itself). Symbolic-link skill
folders are followed. Roots outside the repository are read the same way, so a home
directory whose `.gitignore` holds `*` hides none of them. `SK07`–`SK10` skip
a skill that `SK06` reports without frontmatter. `SK16`–`SK20` print after `SK15`: ids are
stable, and the report follows them. The frontmatter is read by a line scanner
for top-level keys and their scalar values, not by a YAML parser: it decides only the cases
above, so no YAML crate is admitted (ADR 0007). `SK14` and `SK15` are user scope: labeled,
warn only, skipped by `--repo-only`.

The review (`skills-review`) judges what reading decides:

| # | Criterion | Source |
| --- | --- | --- |
| 1 | The description says what the skill does and when to use it, key use case first, in words a user would type | Claude Code skills docs, "Skill not triggering"; spec, `description` |
| 2 | No two skills claim the same requests | Claude Code skills docs, "Skill triggers too often" |
| 3 | Side-effect workflows (deploy, commit, push, publish) set `disable-model-invocation: true`; background knowledge sets `user-invocable: false` | Claude Code skills docs, "Control who invokes a skill" |
| 4 | The body states what to do, not narration: every loaded line is a recurring cost | Claude Code skills docs, "Types of skill content" |
| 5 | Detail lives in files one level deep, each named with what it holds and when to read it | spec, "File references"; Claude Code, "Add supporting files" |
| 6 | The instructions that matter most come first: compaction keeps only the start | Claude Code skills docs, "Skill content lifecycle" |
| 7 | Guidance is phrased to hold for the whole task, not as one-time steps | Claude Code skills docs, "Claude stops following a skill" |
| 8 | A rule that must hold every time is a hook, not skill prose | same section |
| 9 | Scripts and `` !`command` `` lines hold no prompt injection, exfiltration, dropper (`curl … \| sh`, decode-and-exec), or unconfirmed destructive command; `allowed-tools` grants no blanket `Bash` | ADR 0005, pillar 2 "Safety"; SkillSpector pattern categories (ADR 0006) |
| 10 | Behavior both agents need sits in fields both read (`name`, `description`, `disable-model-invocation`); a body that relies on Claude Code-only fields (`context: fork`, `paths`, `allowed-tools`, `hooks`, `!` injection) still works without them | OpenCode `config/plugin/skill-file.ts`; Claude Code, "Frontmatter reference" |
| 11 | It belongs in a skill: not a rule every session needs (that is `AGENTS.md`), not a one-line command | `agents-md-review` criterion 15, inverted |
| 12 | The commands, paths, and tools it names exist in this repository | ADR 0005, pillar 1 "no references to files or commands that do not exist" |
| 13 | An operation that is fragile, repeated, or bound to one sequence is a bundled script, not prose the agent re-derives each time | agentskills.io, best-practices ("write a tested script once and bundle it in `scripts/`"); using-scripts |
| 14 | `SKILL.md` tells the agent to run a script, not to read it: only its output enters the context | Claude Code skills docs, "Add supporting files" (`scripts/`: "executed, not loaded") |
| 15 | A script asks nothing interactively, documents itself through `--help`, prints structured data on stdout and diagnostics on stderr, says in an error what to try, and offers `--dry-run` before it destroys | using-scripts (S8) |

Not probed yet: the 5,000-token body target (S9: no char count stands for a token), reference
chains deeper than one level (criterion 5 judges them), the type of `metadata` values, the
form of `allowed-tools` (the spec asks for a string, Claude Code also takes a list), what a
script itself does (criteria 9 and 15), whether an `allowed-tools` entry covers each injected
command, an external validator (`claude plugin validate`, `skills-ref validate`: launched by
the CLI, never from a gate — a later amendment), script safety and per-agent format lint by an external scanner
(SkillSpector `--no-llm --format json` and agnix are the candidates, ADR 0005 "integrate";
detecting and running one amends this ADR when it lands — until then the review covers
script safety),
deeper layouts such as `.claude/skills/<group>/<name>/SKILL.md` (OpenCode loads them;
Claude Code documents only `<name>/SKILL.md`), unclosed frontmatter in Claude Code (probed
as missing), YAML errors other than the `SK06` cases, `.claude/commands/` files,
skills added by `opencode.json` `skills` entries or `--add-dir`, the order between OpenCode's
`.opencode` and `.claude`/`.agents` sources for one id, `XDG_CONFIG_HOME`, enterprise and
plugin skills, and backticked paths in skill bodies.

### Tests

Every gate is tested at three levels, all run by `cargo xtask check`:

- **Unit**: each probe on in-memory snapshots, each classification and budget edge, and
  property tests on the algebra (`TextSize`, `Budget`).
- **End to end on real trees**: the binary on `tempfile` directory trees, one per case:
  every probe, symbolic links, ignore rules, and exit statuses 0, 1, and 2. Repository
  cases run with `--repo-only`; user-scope cases build their parent directories and a
  fake `$HOME` inside the temporary directory.
- **End to end in a container**: a temporary directory cannot hold `/CLAUDE.md` or a real
  `$HOME`. `cargo xtask e2e` builds a static (musl) binary and runs it in `FROM scratch`
  images whose whole filesystem is the fixture (`/CLAUDE.md`, `/home/dev/CLAUDE.md`,
  `/home/dev/.claude/CLAUDE.md`, the repository at `/home/dev/work/repo`), with no network
  and no base image to pull. It needs docker, locally and in CI.

## Alternatives Rejected

**NO gate binary that spawns `claude -p` or `opencode run`**: We reject because it needs
an authenticated agent CLI on the machine and in CI, its output varies between runs,
and the process boundary is hard to test; a skill runs in the session the user already
has.

**NO agent verdict in the exit code or the score**: We reject because two runs can
disagree, so a CI gate would flake; ADR 0005's reproducibility holds for the score.

**NO single binary for every gate**: We reject for now because one app per gate keeps
each gate's dependencies, tests, and release independent; shared code lives in
`crates/vitals-utils`. Revisit when a combined report or score is built.

**NO meaning heuristics in probes** (keyword lists for "has a commands section", "has
guardrails"): We reject because prose matching yields false positives and false
negatives that a deterministic gate cannot justify; that judgment belongs to the review.
Probes count syntax whose effect a source documents (block length, headings, emphasis
markers, references that resolve), and leave what the text means to the review.

## Trade-offs

### Wins

- The gate's verdict is reproducible in CI, and the judgment half still reaches the
  user, with evidence and a diff.
- One review format (the kaizen block) for every gate, read and answered the same way.
- Probes and review share one catalog, so a criterion moves from review to probe when it
  becomes decidable.

### Costs

- Review quality depends on the model and the session; the same file can get different
  suggestions.
- The review skill must be installed in the agent's skill directory to run; distribution
  is not settled (ADR 0005, open question).
- `AM07`/`AM08` recognize one convention by name; other conventions only pass in the
  review.
- The `skills` frontmatter scanner is not a YAML parser: it decides two YAML errors
  and two reserved indicators (`SK06`); the others reach only the review.

## Supersedes

- **`AM05` failed above 500 lines** (2026-11-14 → 2026-11-15). 500 was the cap the kaizen
  skill sets, not a documented breaking point; the docs give only the 200-line target, so
  `AM05` now warns and never fails.
- **`AM06` failed a root file above 40,000 chars** (2026-11-14 → 2026-11-15). The docs and a
  run of Claude Code 2.1.325 show that a file loaded at launch loads whole up to 4 MiB;
  40,000 chars bound only the files loaded on demand, which `AM10` judges.
- **`AM20` matched `paths` patterns as written** (2026-11-15). The docs' table makes a pattern
  without `/` match at any depth and a leading `/` anchor it; matching as written reported
  live rules as dead.

## References

- [Claude Code — How Claude remembers your project](https://code.claude.com/docs/en/memory)
  — 200-line target, four-hop imports, launch and on-demand loading, when AGENTS.md is
  read, the 4 MiB and 40,000-char limits, `paths` matching, conflicts (read 2026-11-15).
- [AGENTS.md](https://agents.md/) — the open format: root file, suggested sections,
  nested files, migration by symbolic link (read 2026-11-15).
- [Using CLAUDE.md files](https://claude.com/resources/articles/using-claude-md-files)
- [Claude Code — Best practices](https://code.claude.com/docs/en/best-practices) — keep
  `CLAUDE.md` short, emphasis that stops working, hooks and deny rules for zero-exception
  rules, `/doctor prompt-audit` (read 2026-11-15).
- [Claude Code in Action, "Configure Claude"](https://campus.datacamp.com/courses/claude-code-in-action/configure-claude?ex=1)
  — Anthropic's course: the four memory locations, imports that do not reduce context,
  specific and checkable rules, naming the replacement, emphasis as a budget.
- [Gloaguen et al., *Evaluating AGENTS.md*](https://arxiv.org/abs/2602.11988) (ICLR 2026)
  — context files: over 20% more inference cost, no general gain in success, overviews do
  not help.
- [Jaroslawicz et al., *How Many Instructions Can LLMs Follow at Once?*](https://arxiv.org/abs/2507.11538)
  (NeurIPS 2025) — IFScale: degradation with instruction density, bias toward earlier
  instructions.
- [OpenCode source](https://github.com/anomalyco/opencode/tree/d759c548aa/packages/core/src)
  at `d759c548aa`: `instruction-discovery.ts` and `config/plugin/instruction.ts` (an
  `AGENTS.md` is injected verbatim).
- [OpenCode source](https://github.com/anomalyco/opencode/tree/024a1462f5/packages/core/src)
  at `024a1462f5` (2026-11-14): `config/plugin/instruction.ts` (the `AGENTS.md` walk up
  to `$HOME` or the project root, configured `instructions`), `tool/plugin/read.ts`
  (subdirectory `AGENTS.md` on read). The V1 rules page
  (<https://opencode.ai/docs/rules/>) still describes a `CLAUDE.md` fallback that the V2
  source no longer has.
- [Claude Code — Extend Claude with skills](https://code.claude.com/docs/en/skills) —
  skill locations, parent walk up to the repository root, nested skills on demand, name
  precedence, frontmatter fields, the 1,536-char listing cap, the 500-line tip,
  compaction, reserved names.
- [Agent Skills specification](https://agentskills.io/specification) — `name` and
  `description` constraints, 500 lines, relative file references.
- [OpenCode source](https://github.com/anomalyco/opencode/tree/d759c548aa/packages/core/src)
  at `d759c548aa` (2026-11-14): `config/discovery.ts` (`.claude`, `.agents`, `.opencode`
  in every directory up to `/`, the global roots), `config/plugin/compatibility.ts` and
  `config/plugin/skill.ts` (`skills/` and `skill/` roots, source order),
  `config/plugin/skill-scan.ts` (layout), `config/plugin/skill-file.ts` (id, fields),
  `config/markdown.ts` (YAML repair), `skill/instructions.ts` (only described skills are
  listed).
- [SkillSpector](https://github.com/NVIDIA/SkillSpector) — skill-safety scanner, the
  integration candidate for `skills` (25,972 stars; 986 commits in the last 14 days;
  v2.13.4, 2026-11-04; 282 issues and pull requests opened, 273 closed in 30 days;
  measured 2026-11-14).
- `skills` rubric sources: `crates/skills-chkr/skills/skills-review/references/sources.md`.
- [qol-mini](https://github.com/ltruchot/qol-mini-4-ai-tui) — kaizen skill, `TODO.md`
  handoff, ADR 0003 (AGENTS.md as the canonical rules file).
- `agents-md` rubric sources: `crates/agents-md-chkr/skills/agents-md-review/references/sources.md`.
- ADR 0005: `0005-vitals-audits-a-repository-for-coding-agents.md` — pillars and principles.
- ADR 0007: `0007-the-gates-are-strict-rust.md` — workspace, lints, coverage.
