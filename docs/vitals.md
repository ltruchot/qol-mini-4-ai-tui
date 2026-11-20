# Vitals

`qol-mini vitals` audits whether a repository is ready for coding agents: what Claude Code
and OpenCode load from it, and whether each of them gets the same thing. It reads and
never writes, except under `--fix`.

| Command | Does |
|---|---|
| `qol-mini vitals [path]` | every gate on the repository, default the current directory |
| `qol-mini vitals agents-md [path]` | the `agents-md` gate alone |
| `qol-mini vitals skills [path]` | the `skills` gate alone |
| `qol-mini vitals [gate] [path] --repo-only` | skip the user scope: parent directories and the home directory |
| `qol-mini vitals [gate] [path] --json` | the reports as a JSON array, one object per gate |
| `qol-mini vitals [gate] [path] --fix` | run the `qol-mini` commands the findings name, then audit again |
| `qol-mini vitals [gate] [path] --fix --dry-run` | name those commands, run none |

| Exit status | Meaning |
|---|---|
| 0 | no repository probe failed |
| 1 | a repository probe failed |
| 2 | the repository cannot be read |

With several gates the status is the highest one. User-scope findings never change it.
A first word that names a gate picks it: `./skills` is the directory, `skills` the gate.

Each line is `[verdict] ID evidence: message`, verdicts `pass`, `warn`, `fail`, `n/a`; a
`fix:` line follows a `warn` or a `fail`; a summary line closes each gate.

A `run:` line under a `fix:` names the `qol-mini` command that applies it; the repository
goes last. `--fix` runs each named command once, then audits again: the exit status is
that second audit's, and at least 1 when a command failed or refused
([ADR 0010](adr/0010-a-finding-names-the-command-that-fixes-it.md)).

| Probe | When | `run:` |
|---|---|---|
| `AM01` | the rules live in `CLAUDE.md` alone | `qol-mini harmonize --only rules` |
| `AM02` | a root `CLAUDE.md` shadows `AGENTS.md` | `qol-mini harmonize --only rules`: merges when one file imports the other, refuses otherwise |
| `AM04` | a `CLAUDE.local.md` and no bridge | `qol-mini harmonize --only rules --rules bridge` |
| `AM08` | no kaizen skill | `qol-mini skills install kaizen` |

Under `--json` a report is `{"findings": [...], "gate": "...", "passed": true}`; a finding
holds `probe`, `verdict`, `scope` (`repository` or `user`), `evidence`, `message`, `fix`
and `command`, the last two `null` when there is none.

Every check is a gate with two parts: deterministic probes, which alone set the exit
status, and an agent review shipped as a skill, which proposes at most five `ADD`, `CUT`,
`MOVE` or `REWORD` edits, labeled advisory. Nothing is edited without a yes.

The probes are Rust (`crates/`), built for `wasm32-wasip1` and run by the CLI on a WASI
host it holds ([ADR 0009](adr/0009-the-gates-ship-as-webassembly.md)). Intent:
[ADR 0005](adr/0005-vitals-audits-a-repository-for-coding-agents.md). Gate model and
every sourced fact: [ADR 0008](adr/0008-a-gate-is-probes-plus-a-review-skill.md).

## What it checks

| Pillar                     | Questions it answers                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1. Instruction files       | Is there an `AGENTS.md`? Is it under budget, structured, consistent, with real build and test commands? |
| 2. Skills                  | Do project skills exist? Is `SKILL.md` frontmatter valid, the description triggerable, the code safe?   |
| 3. Codebase memory         | Is a code-intelligence MCP server or plugin wired in for both agents?                                    |
| 4. Context limiting        | Does a tool or hook keep raw tool output out of the context window?                                      |
| 5. Deterministic gates     | Do commit hooks actually run lint, format, type checks, tests, vulnerability and secret scans? Does CI?  |
| 6. Agent-config security   | Are permission lists tight, MCP servers pinned, auto-approving hooks flagged?                            |

Design principles: deterministic score and exit code (agent review is advisory), Claude
Code and OpenCode parity, repository and user-scope findings reported separately, Scorecard-style weighting
with per-pillar levels, stable exit codes and JSON/SARIF output for CI.

## Gates

| Gate | Pillar | Deterministic probes (Rust) | Agent review (skill, advisory) | Status |
| ---- | ------ | --------------------------- | ------------------------------ | ------ |
| [`agents-md`](../crates/agents-md-chkr/) | 1 | `AM01`–`AM21`, below | [`agents-md-review`](../packages/qol-mini/skills/agents-md-review/SKILL.md): 22-criterion rubric | ✅ |
| [`skills`](../crates/skills-chkr/) | 2 | `SK01`–`SK15`, below | [`skills-review`](../packages/qol-mini/skills/skills-review/SKILL.md): 12-criterion rubric | ✅ |
| `codebase-memory` | 3 | a code-intelligence MCP server or plugin, wired in for both agents | - | ⏳ |
| `context-limiting` | 4 | an output-capping tool or hook, wired in for both agents | - | ⏳ |
| `commit-gates` | 5 | an active hook runner calling lint, format, types, tests, vulnerability and secret scans; CI runs the same | fit of the gate list to the stack | ⏳ |
| `agent-config` | 6 | permission lists, pinned MCP servers, auto-approving hooks | - | ⏳ |

Each gate section opens with a TL;DR: a checked box is decided by the gate's probes, an
open box is left to its review skill or not probed yet. Every probe cites its source:
the agents' docs, their source code, or a published study; a threshold with no source is
named as this project's choice.

### `agents-md`

```sh
qol-mini vitals agents-md /path/to/repo              # exit 0: no fail · 1: a probe failed · 2: cannot read
qol-mini vitals agents-md /path/to/repo --repo-only  # CI: skip the parent directories and home
```

**TL;DR**

- [x] `AGENTS.md` is the rules file, and no `CLAUDE.md` hides it from Claude Code, in the
  repository or above it (`AM01`–`AM04`, `AM09`, `AM12`, `AM14`)
- [x] Under budget as each agent loads it: 200 lines as a target (imports and HTML comments
  counted), 4 MiB for a file loaded at launch, 40,000 chars for a file loaded on demand
  (`AM05`, `AM06`, `AM10`)
- [x] Project convention, not an agent requirement: a session after `/clear` resumes from
  `TODO.md`, and a kaizen skill turns friction into rule edits (`AM07`, `AM08`)
- [x] Both agents get the same rules: `.claude/rules` and imported files listed for
  OpenCode, nothing only one agent reads (`AM11`, `AM12`, `AM15`, `AM16`, `AM21`)
- [x] What the files point to exists: imports, repository paths, links, rule `paths`
  (`AM16`, `AM19`, `AM20`)
- [x] Headings and short blocks, emphasis spent on three rules at most (`AM17`, `AM18`)
- [ ] Real commands, conventions, guardrails, reuse before create, rules that a hook
  should enforce, rules that are checkable and name their replacement, the costly rules
  first, reference data moved out, contradictions across the cascade: the review
- [ ] Not probed yet: commands that do not exist, the number of instructions,
  `node_modules/*/AGENTS.md`, the **Project instructions** setting and `claudeMdExcludes`

**How the gate reads a repository.** Instruction files cascade: Claude Code loads every
`CLAUDE.md` from the working directory up to `/`, and one of them anywhere on that path
turns off every `AGENTS.md`; OpenCode loads every `AGENTS.md` up to `$HOME` and never reads
`CLAUDE.md`. Both load subdirectory files as they work there. They also load different
text from one file: Claude Code strips block HTML comments and expands `@path` imports (four
hops), OpenCode injects the file verbatim, so an import in `AGENTS.md` never reaches
OpenCode unless `opencode.json` lists the file. The gate checks the whole cascade, in the
repository and, as user-scope findings that never fail the gate, above it
([ADR 0008](adr/0008-a-gate-is-probes-plus-a-review-skill.md#the-agents-md-gate)).
Every probe cites its source there; the cascade was checked against Claude Code 2.1.325
itself, one throwaway repository per case ("Empirical checks"). `AGENTS.md` is the open
format that over 20 coding agents read ([agents]): one file at the root, nested files for
subprojects.

**Why these checks.** Claude Code's docs target "under 200 lines per CLAUDE.md file.
Longer files consume more context and reduce adherence", and ask for "markdown headers and
bullets" over "dense paragraphs" ([memory]). Anthropic's course treats emphasis as a
budget for "the two or three rules that hurt when broken" ([course]), and the best
practices add that "adding IMPORTANT probably won't fix it" ([best]). A study of four
agents on real issues found that context files raise inference cost by over 20% without
improving success in general, and that repository overviews do not help ([eth]); another
found that instruction following degrades as instructions accumulate, earlier ones first
([ifscale]).

| Probe | Checks | Fails or warns when | Source |
| ----- | ------ | ------------------- | ------ |
| `AM01` | `AGENTS.md` at the root | fail: missing (the fix names a `CLAUDE.md` to rename) | [memory], [oc] |
| `AM02` | root `CLAUDE.md` | fail: it has its own content, so Claude Code skips `AGENTS.md`; a bridge (`@AGENTS.md`) or a symlink passes | [memory] |
| `AM03` | `.claude/CLAUDE.md` | fail: same as `AM02` (bridge: `@../AGENTS.md`) | [memory] |
| `AM04` | `CLAUDE.local.md` | warn: present with no bridge, so Claude Code skips `AGENTS.md` on that machine | [memory] |
| `AM05` | lines, as loaded | warn above 200, never fail (`AGENTS.md`, else the `CLAUDE.md` that loads) | [memory] |
| `AM06` | launch size | fail above 4 MiB: Claude Code skips the file | [memory] |
| `AM07` | resume after `/clear` | warn: the first 10 lines do not name `TODO.md`, or it does not exist | [qol-mini] convention |
| `AM08` | continuous improvement | warn: no `kaizen` skill in `.claude/skills/` (Claude Code reads no other root); the fix points to [qol-mini] | [qol-mini] convention; [skills-docs] for the root |
| `AM09` | nested `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` | fail: own rules that OpenCode never reads and that hide the sibling `AGENTS.md` from Claude Code; warn: nested `CLAUDE.local.md` | [memory], [oc] |
| `AM10` | nested budgets | warn above 200 lines; fail above 40,000 chars for a file loaded on demand (subdirectory `CLAUDE.md` and its imports, subdirectory rules, rules with `paths`); warn above 70,000 chars for a subdirectory `AGENTS.md` (measured: a larger one arrives as a preview); fail above 4 MiB for the rest | [memory]; ADR 0008 runs |
| `AM11` | `.claude/rules` parity | warn: rules files that `opencode.json` `instructions` does not list | [memory], [oc] |
| `AM12` | names an agent skips | warn: `.claude/AGENTS.md`, `AGENTS.local.md`, `AGENTS.override.md`, `agents.md` | [memory], [oc] |
| `AM13` | cascade inventory | lists every nested instruction file | - |
| `AM14` | user scope: `CLAUDE.md` above the repository | warn: Claude Code loads it and skips every `AGENTS.md` (`~/.claude/CLAUDE.md` exempt) | [memory] |
| `AM15` | user scope: `AGENTS.md` above the repository | warn: rules that teammates and CI do not have | [oc] |
| `AM16` | `@path` imports | warn: no file at the target, past four hops, or in an `AGENTS.md` a target that `opencode.json` does not list | [memory], [oc] |
| `AM17` | structure | warn: a block (paragraph, list item, table row) over 400 chars; no heading in a file over 30 lines | [memory]; 400 and 30: project thresholds |
| `AM18` | emphasis budget | warn: more than 3 markers (`IMPORTANT`, `MUST`, `NEVER`… in capitals, or bold inside a sentence) | [course], [best] |
| `AM19` | references | warn: a backticked repository path or a relative link that resolves to nothing | [memory] (`/doctor prompt-audit`) |
| `AM20` | rule `paths` | warn: unclosed or unparsable frontmatter (the rule then loads everywhere), a malformed `paths`, brace groups past 1,000 patterns, or a pattern that matches no file, matched as the docs specify (`*.md` at any depth, `/*.md` at the base) | [memory] |
| `AM21` | user scope: managed `CLAUDE.md` | warn: `/etc/claude-code/CLAUDE.md` loads in every Claude Code session and no setting excludes it; OpenCode never reads it | [memory] |

The review skill checks what probes cannot, against a 22-criterion rubric: real commands,
conventions, guardrails (think before coding, simplicity, surgical changes, verify in a
loop), reuse before create, ADR discipline, rules hygiene, handoff and kaizen equivalents,
blocks and reference data that belong elsewhere, contradictions across the cascade, rules
only one agent sees, zero-exception rules that a hook should enforce, emphasis and order,
and rules that are checkable and name their replacement. To use it:
`qol-mini skills install agents-md-review /path/to/repo` (Claude Code and OpenCode both
read `.claude/skills/`), then ask your agent to review `AGENTS.md`.

### `skills`

```sh
qol-mini vitals skills /path/to/repo              # exit 0: no fail · 1: a probe failed · 2: cannot read
qol-mini vitals skills /path/to/repo --repo-only  # CI: skip the parent directories and home
```

**TL;DR**

- [x] Project skills exist where both agents load them: `.claude/skills/<name>/SKILL.md`
  (`SK01`, `SK02`, `SK04`, `SK05`)
- [x] One copy per name, in the repository and against personal skills (`SK03`, `SK15`)
- [x] Frontmatter that both agents parse, a description to match, within length, a valid
  name (`SK06`–`SK10`)
- [x] Body under 500 lines, and every relative link resolves (`SK11`, `SK12`)
- [x] User scope: skill roots above the repository that only OpenCode reads (`SK14`)
- [ ] Descriptions that trigger, overlapping skills, invocation control, body cost and
  order, script safety, Claude Code-only fields: the review
- [ ] Not probed yet: script safety by an external scanner, `.claude/commands/`, skills
  added by `opencode.json` or `--add-dir`, enterprise and plugin skills

**How the gate reads a repository.** Both agents read `SKILL.md`, but not from the same
places: Claude Code loads `.claude/skills/` only, from the working directory up to the
repository root; OpenCode also loads `.agents/skills/` and `.opencode/skill(s)/`, from every
directory up to `/`, and never the nested roots below its working directory. They also read
different frontmatter fields and react differently to the same YAML mistake. The gate checks
where each skill lives, its frontmatter, sizes, and links, and, as user-scope findings that
never fail the gate, the skill roots above the repository
([ADR 0008](adr/0008-a-gate-is-probes-plus-a-review-skill.md#the-skills-gate),
whose facts `C`, `S`, and `O` the Source column cites).

| Probe | Checks | Fails or warns when | Source |
| ----- | ------ | ------------------- | ------ |
| `SK01` | project skills exist | warn: none in any skill root | [skills-docs] C1, [oc] O1 |
| `SK02` | both agents reach each skill | warn: a skill only in `.agents/skills/` or `.opencode/skill(s)/`, which Claude Code never loads | C2, O1, O2 |
| `SK03` | one copy per name | warn: two roots hold the same skill name with different content | C5, O10 |
| `SK04` | layout | warn: a `*.md` file directly in a skill root (OpenCode only), `skill.md` instead of `SKILL.md` (neither agent), or a `SKILL.md` one folder too deep (OpenCode only) | C16, C17, O5 |
| `SK05` | nested skill roots | warn: a skill root below the repository root, which OpenCode loads only in a session started there | C4, O4 |
| `SK06` | frontmatter | fail: no `---` on line 1, never closed, or an unquoted value YAML rejects (`: `, `[x] text`, a leading `` ` ``, `@`, `*`, `!`, or `%`) | C8, C9, [spec] S4, O8 |
| `SK07` | description | fail: missing or not a string, unless `disable-model-invocation: true` | C10, O7, O9 |
| `SK08` | description length | warn above 1,024 chars, fail above 1,536 (`description` + `when_to_use`) | S2, C11 |
| `SK09` | `when_to_use` | warn: OpenCode never reads it | O7 |
| `SK10` | name | fail: reserved by Claude Code or not a string; warn: off the Agent Skills rule, or different from the folder | C7, S1, O6, O7 |
| `SK11` | lines | warn above 500 | C13, S3 |
| `SK12` | references | fail: a relative link, outside code, to a file that does not exist | S3 |
| `SK13` | skill inventory | lists every skill | - |
| `SK14` | user scope: skill roots only OpenCode reads | warn: in a parent directory, or `~/.agents/skills`, `~/.config/opencode/skill(s)` | C3, O1, O3 |
| `SK15` | user scope: personal skills that shadow project ones | warn: Claude Code runs the personal copy, OpenCode the project one | C5, O10 |

The review skill checks what probes cannot: descriptions that trigger, overlapping
skills, invocation control, body cost and order, script safety, and behavior that relies
on Claude Code-only fields. To use it:
`qol-mini skills install skills-review /path/to/repo`, then ask your agent to review the
skills.

[memory]: https://code.claude.com/docs/en/memory
[agents]: https://agents.md/
[best]: https://code.claude.com/docs/en/best-practices
[skills-docs]: https://code.claude.com/docs/en/skills
[course]: https://campus.datacamp.com/courses/claude-code-in-action/configure-claude?ex=1
[eth]: https://arxiv.org/abs/2602.11988
[ifscale]: https://arxiv.org/abs/2507.11538
[spec]: https://agentskills.io/specification
[oc]: https://github.com/anomalyco/opencode/tree/d759c548aa/packages/core/src
[qol-mini]: https://github.com/ltruchot/qol-mini-4-ai-tui

[memory]: https://code.claude.com/docs/en/memory
[agents]: https://agents.md/
[best]: https://code.claude.com/docs/en/best-practices
[skills-docs]: https://code.claude.com/docs/en/skills
[course]: https://campus.datacamp.com/courses/claude-code-in-action/configure-claude?ex=1
[eth]: https://arxiv.org/abs/2602.11988
[ifscale]: https://arxiv.org/abs/2507.11538
[spec]: https://agentskills.io/specification
[oc]: https://github.com/anomalyco/opencode/tree/d759c548aa/packages/core/src
[qol-mini]: https://github.com/ltruchot/qol-mini-4-ai-tui
