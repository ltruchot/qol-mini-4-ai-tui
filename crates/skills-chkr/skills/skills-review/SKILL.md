---
name: skills-review
description: Review a repository's agent skills (SKILL.md files in .claude/skills, .agents/skills, .opencode/skills) for Claude Code and OpenCode — run the skills-chkr deterministic probes, then judge each skill's description, body, scripts, and fit against a rubric and propose at most five advisory ADD, CUT, MOVE, or REWORD edits, one block at a time. Use when asked to audit, review, or improve skills or slash commands, when a skill does not trigger or triggers too often, or after the skills gate reports findings.
---

# Skills review

The non-deterministic half of the `skills` gate (ADR 4). The probes decide what a pure
function can: where each skill lives, which agent loads it, its frontmatter, sizes, and
links. This review judges what only reading can: whether a description triggers, whether
two skills overlap, whether a script is safe, whether the body is worth its context.
Findings are **advisory**: they never change the gate's exit code or score.

## 1. Run the probes first

```sh
skills-chkr <repo>          # installed binary
cargo skills-chkr <repo>    # from a code-harness-vitals clone
```

Run it without `--repo-only`: the user-scope probes (`SK14`, `SK15`) find skill roots above
the repository and personal skills that shadow project ones, which change what each agent
loads in every session here.

Quote the output verbatim, every line. A `fail` comes before any content review: when
`SK06` (frontmatter YAML rejects), `SK07` (no description), `SK10` (a name an agent
refuses), or `SK12` (a broken link) fail, or `SK02` reports a skill Claude Code never
loads, propose that fix first, then review the skills as the agents actually load them.

Exit status: 0 = no repository probe failed, 1 = one failed, 2 = the repository cannot be
read. User-scope findings never change it.

## 2. Read everything that is loaded

Read every `SKILL.md` that `SK13` lists, in full, then every file it links to or tells the
agent to run (`references/`, `scripts/`, `` !`command` `` lines). Read the paths `SK14` and
`SK15` report outside the repository only after asking. Read `AGENTS.md` (and any
`CLAUDE.md`) to know what every session already gets, and skim the manifest, scripts, and
CI to check the commands and paths the skills name.

## 3. Judge against the rubric

Each criterion ends up **present**, **missing** (→ `ADD`), **misplaced** (→ `MOVE`),
**noise** (→ `CUT`), or **misleading** (→ `REWORD`). Judge this repository's skills; a
criterion that does not apply here is not missing.

| # | Criterion | Present when the skill… |
|---|---|---|
| 1 | Triggerable | has a description that says what it does and when to use it, key use case first, in the words a user would type |
| 2 | No overlap | claims requests that no other skill's description also claims |
| 3 | Invocation control | sets `disable-model-invocation: true` when it has side effects (deploy, commit, push, publish), and `user-invocable: false` when it is background knowledge |
| 4 | Concise body | states what to do, not narration or rationale an agent does not act on |
| 5 | Progressive disclosure | keeps detail in files one level deep, each linked with what it holds and when to read it |
| 6 | Most important first | puts the instructions that matter most at the top: after compaction only the start is kept |
| 7 | Standing instructions | phrases guidance to hold for the whole task ("run the tests after every edit"), not as one-time steps |
| 8 | Hooks for invariants | leaves a rule that must hold every time to a hook, not to prose |
| 9 | Safe scripts | runs nothing that injects instructions, sends repository content or secrets over the network, downloads and executes code (`curl … \| sh`, decode-and-exec), or deletes without confirmation; `allowed-tools` grants no blanket `Bash` |
| 10 | Works in both agents | puts behavior both agents need in fields both read (`name`, `description`, `disable-model-invocation`); a body that relies on Claude Code-only fields (`context: fork`, `paths`, `allowed-tools`, `hooks`, `` !`command` ``) still works when they are ignored |
| 11 | Belongs in a skill | is not a rule every session needs (that belongs in `AGENTS.md`) and not a one-line command |
| 12 | Up to date | names commands, paths, and tools that exist in this repository |

For 9, quote the exact line and say what it does; when a scanner is wanted, name
[SkillSpector](https://github.com/NVIDIA/SkillSpector) (`--no-llm` keeps it local) as one
way to scan every script.

## 4. Report: at most five items, one at a time

Rank by cost: what is unsafe first, then what makes a skill invisible or wrong in one
agent, then what wastes context in every session, then the rest. Keep the five with the
highest cost; list the rest in one line at the end. Zero items is a valid result.

One item per message, in this block, then wait for a yes or a no:

```
------------------------ SKILLS REVIEW 1/3 : REWORD ------------------------
advisory: not part of the skills score

TLDR: REWORD the description of .claude/skills/release/SKILL.md -- it names
      no trigger, so neither agent loads it when asked to cut a release.

COST: rubric 1. The description reads "Release helper." Requests in this
      repository say "cut a release" and "publish to crates.io" (CONTRIBUTING.md,
      line 40); neither phrase is in it.

EDIT: .claude/skills/release/SKILL.md, frontmatter:

      - description: Release helper.
      + description: Cut a release of the workspace crates (bump, tag, publish
      +   to crates.io). Use when asked to release, cut a release, or publish.

TRIGGER: "cut a release" now matches the description in both agents.

------------------------------------------------------------------------------
```

- The banner carries the item number, the total, and the verb.
- `TLDR`: one sentence that starts with the verb and the file.
- `COST`: the rubric number and the evidence — line numbers, the quoted text, the
  command that disproves a stale path.
- `EDIT`: the diff itself, `-` and `+`, the file and the section. Never an ellipsis in
  real output.
- Write in the skill's own language, vocabulary, and style.

## 5. Apply only what is accepted

Edit nothing without a yes. After the accepted edits, re-run `skills-chkr`: a description
that grew past 1,024 chars, a new unquoted `: `, or a link to a file that was not created
shows up there.

Rubric sources: [references/sources.md](references/sources.md).
