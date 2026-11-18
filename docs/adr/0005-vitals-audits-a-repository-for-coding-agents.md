# 0005 — Vitals audits a repository for coding agents

**Date**: 2026-11-13
**Status**: Accepted (living document — the product compass)
**Context**: Greenfield project. Competitive landscape in ADR 0006; stack in ADR 0007; gate
model in ADR 0008.

## Implementation Status

| Component                               | Status     | Location                                |
| --------------------------------------- | ---------- | --------------------------------------- |
| Agent instructions (US English, no PII) | ✅ Done    | `AGENTS.md`                             |
| Intent (this ADR)                       | ✅ Done    | `docs/adr/`   |
| Competitor analysis                     | ✅ Done    | `0006-vitals-and-the-related-projects.md`        |
| Stack choice (Rust, Cargo workspace)    | ✅ Done    | `0007-the-gates-are-strict-rust.md`         |
| Toolchain and gates                     | ✅ Done    | `crates/xtask/`                         |
| Gate model (probes + agent review)      | ✅ Done    | `0008-a-gate-is-probes-plus-a-review-skill.md`         |
| Pillar 1: `agents-md` gate              | ✅ Done    | `crates/agents-md-chkr/`                  |
| Pillar 2: `skills` gate                 | ✅ Done    | `crates/skills-chkr/`                     |
| Gates for pillars 3–6                   | ⏳ Planned | -                                       |
| CLI: `qol-mini vitals`                  | ✅ Done    | `0009-the-gates-ship-as-webassembly.md` |
| JSON/SARIF output, CI action            | ⏳ Planned | -                                       |

---

## Problem

In 2027, most code is produced by coding agents such as Claude Code and OpenCode. The
quality of that code depends less on the model than on the **agent setup** the repository
provides: the instructions the agent reads, the skills it can load, the memory it can
query, how much noise reaches its context window, and the deterministic gates that reject
bad output before it lands.

Today nothing tells a team, in one command, whether that setup is in place and sound:

- Instruction files (`AGENTS.md`, `CLAUDE.md`) are missing, bloated past the point where
  agents follow them, contradictory, or stale.
- Skills exist but have malformed frontmatter, vague descriptions that never trigger, or
  unsafe scripts.
- No codebase-memory tool is wired in, so agents re-read the tree every session.
- No context limiter is wired in, so tool output floods the context window.
- Commit hooks exist on paper but do not run lint, format, type checks, vulnerability
  scans, or secret scans, so agent mistakes reach the main branch.
- Agent configuration itself is a new attack surface: permissive `allow` lists, unpinned
  MCP servers, hooks that auto-approve commands.

ADR 0006 shows that no project with 1000+ GitHub stars has the health of the agent setup as its primary
purpose, that the closest dedicated scorer covers neither memory nor context limiting, and
that no auditor treats OpenCode on par with Claude Code.

## Decision

**Build an auditor that gates a repository's agent setup across six pillars,
with equal support for Claude Code and OpenCode: deterministic probes in Rust set the
score and the exit code, and agent-run reviews judge what only reading can (ADR 0008).**

### The six pillars

Each pillar is a set of gates (ADR 0008). A probe reports pass, warn, fail, or
not-applicable, with the evidence path and a concrete fix; a review skill proposes
advisory edits.

1. **Instruction files**
   - Presence: `AGENTS.md` at the root (read natively by OpenCode and by Claude Code when
     no `CLAUDE.md` exists), or `CLAUDE.md` importing `@AGENTS.md`.
   - Well-formedness: size under 200 lines per file, imports resolve (max depth 4),
     headers and bullets rather than prose walls, build/test/lint commands present and
     consistent across files, no contradictions between root, nested, and
     `.claude/rules/` files, no references to files or commands that do not exist.
   - Hygiene: no third-party blocks injected without review (for example
     `<claude-mem-context>`, `@RTK.md`, tool-managed `AGENTS.md` sections).
2. **Skills**
   - Presence of project skills in `.claude/skills/`, `.opencode/skills/`, or
     `.agents/skills/`.
   - Well-formedness: valid `SKILL.md` frontmatter (`name`, `description`), descriptions
     specific enough to trigger, bodies within size budget, referenced files exist.
   - Safety: no prompt injection, exfiltration, or dropper patterns in skill scripts.
3. **Codebase memory**
   - A persistent code-intelligence tool is configured and reachable for both agents:
     an MCP server or plugin such as codebase-memory-mcp, detected through repo files,
     `.mcp.json`, `opencode.json`, and user-scope config.
4. **Context limiting**
   - A tool or hook keeps raw tool output out of the context window: context-mode, rtk,
     or equivalent output-capping hooks, on both agents.
5. **Deterministic gates**
   - A hook runner is installed and active (prek, pre-commit, lefthook, husky), not just
     configured.
   - The hooks actually invoke a linter, a formatter, a type checker where the language
     has one, tests, a dependency vulnerability scanner, and a secret scanner.
   - CI runs the same gate list, so a bypassed local hook is still caught.
6. **Agent-config security**
   - Permission lists in `.claude/settings.json` and `opencode.json`: no blanket
     `Bash(*)`, no `bypassPermissions` default, deny rules for secrets paths.
   - MCP servers are pinned (no `npx -y pkg@latest`), and remote transports are known.
   - Hooks that auto-approve permission prompts, or that deny tools and can fail closed,
     are flagged.
   - Tools with telemetry on by default, or with non-OSI licenses, are reported as
     informational findings.

### Principles

- **Deterministic score, agent-assisted review.** Every scored probe is a pure function
  of files on disk and local command output: same input, same score. Content that needs
  judgment (what is missing, what belongs in a skill) is reviewed by a skill that runs in
  the user's own agent session, labeled advisory, and never part of the score or the
  exit code (ADR 0008).
- **Claude Code and OpenCode parity.** Every check that reads Claude Code configuration
  has an OpenCode counterpart (`opencode.json[c]`, `.opencode/`, OpenCode plugins). A
  check that cannot be mirrored is documented as such.
- **Two scopes.** Most setup tools install at user scope (`~/.claude.json`,
  `~/.claude/settings.json`, `~/.config/opencode/`), not in the repository. The auditor
  reports repository findings and user-scope findings separately, so CI results stay
  reproducible while local runs see the full picture.
- **Scored like OpenSSF Scorecard.** Probes roll up into checks scored 0–10, aggregated by
  risk weight. Maturity levels are gated per pillar, so a perfect score in one pillar
  cannot mask an empty one. The per-check breakdown is always shown, because one number
  hides detail.
- **Gate-ready output.** Stable exit codes, `--min-score` / `--min-level` thresholds,
  JSON and SARIF output, a badge, and a GitHub Action.
- **Integrate, do not reimplement.** Where a best-in-class, actively maintained scanner
  exists (agnix for instruction-file and skill linting, SkillSpector in `--no-llm` mode
  for skill safety), the auditor detects it, runs it when present, and folds its results
  into the score.
- **Detection by explicit markers.** Each recognized tool is detected through documented
  files, config keys, hook commands, or MCP server names (catalogued in ADR 0006), never by
  heuristics on prose.

### Non-goals

- Not a code-quality linter: the auditor checks that linters are wired in, it does not
  lint application code.
- Not a code reviewer and not an agent: it does not edit code or open pull requests.
- Not a generator: syncing configuration across agents is rulesync's job; the auditor may
  detect drift but does not write configuration.
- Not a machine-wide security scanner: it audits a repository and the user-scope
  configuration that applies to it.

## Open Questions

- **Stack**: resolved — Rust, as a Cargo workspace (ADR 0007).
- **Distribution**: resolved — the `qol-mini` npm package, the gates as WebAssembly
  (ADR 0009). A GitHub Action and agent plugins stay open.
- **User surface**: terminal report only, or also a TUI, a local web report, or an
  editor extension.
- **Weights**: risk weights per check and the thresholds for each maturity level.
- **Extensibility**: whether third-party checks can be added through a plugin interface.

## Alternatives Rejected

**NO LLM in the score or the exit code**: We reject because scores must be reproducible
in CI and free to run; an LLM verdict varies between runs. Agent review is advisory and
runs in the user's own session (ADR 0008).

**NO Claude-Code-only auditor**: We reject because the target is any agent that reads
`AGENTS.md`; every existing auditor is Claude- or Cursor-centric, which is the gap.

**NO extending an existing tool**: We reject because the closest candidates are either a
single command inside a large opinionated plugin that scores its own assets (ECC
`/harness-audit`) or a single-maintainer scorer without memory, context, or permission
checks (harness-score). See ADR 0006.

## Trade-offs

### Wins

- One command answers "is this repository ready for agents?" with evidence and fixes.
- Reproducible scores make the setup itself gateable in CI.
- Covers the pillars nobody else checks: codebase memory, context limiting, hook wiring,
  permission lists, MCP pinning, OpenCode parity.

### Costs

- Detection markers drift as tools evolve; the marker catalog needs continuous upkeep.
- Two agents and two scopes double the configuration surface to parse and test.
- Integrating external scanners adds optional runtime dependencies.

## Supersedes

**LLM analysis as an optional future add-on** (2026-11-13 → 2026-11-14): the auditor
was deterministic only, with LLM analysis "if ever added", opt-in and outside the score.
Dropped because the content quality of instruction files — what to move into a skill,
what every session lacks — cannot be judged by a pure function, and those are the most
useful findings. The score stays deterministic; review became part of each gate.

## References

- [Claude Code — How Claude remembers your project](https://code.claude.com/docs/en/memory)
  — CLAUDE.md and AGENTS.md loading, 200-line target, imports, `.claude/rules/`.
- [Claude Code 101 — The CLAUDE.md file](https://academy.claude.com/courses/claude-code-101/the-claude-md-file)
- [AGENTS.md open format](https://github.com/agentsmd/agents.md)
- [OpenSSF Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md)
  — scoring model reference.
- ADR 0006: `0006-vitals-and-the-related-projects.md` — competitors, detection markers, positioning.
- ADR 0008: `0008-a-gate-is-probes-plus-a-review-skill.md` — gate anatomy, review contract, gate catalog.
