# 0006 — Vitals and the related projects

**Date**: 2026-11-13
**Status**: Accepted (snapshot — re-measure before reuse)
**Context**: Positioning for the auditor defined in ADR 0005. Selection of the ten projects
linked from `README.md`.

## Problem

ADR 0005 defines a deterministic auditor for the agent setup across six pillars
(instruction files, skills, codebase memory, context limiting, deterministic gates,
agent-config security), with Claude Code and OpenCode parity. Before building it, we need
to know:

- who already does it, and how well;
- which tools are the references our auditor should detect for each pillar;
- which tools are popular but unsafe to recommend (stale, unmaintained, risky defaults).

Agentic tooling changes weekly, so star count alone is not a signal. A project with many
stars and no maintainer activity is a liability to cite.

## Method

1. **Discovery**: GitHub GraphQL search across dozens of phrasings (agent readiness,
   agent-setup audit/health/score, CLAUDE.md/AGENTS.md lint, skill validator, MCP scan,
   OpenCode plugins); the awesome lists `hesreallyhim/awesome-claude-code`,
   `ai-boost/awesome-harness-engineering`, `walkinglabs/awesome-harness-engineering`,
   `Picrew/awesome-agent-harness`, and the awesome-opencode lists; web search for
   closed-source references (Factory Agent Readiness).
2. **Deep dive from source**, not README taglines: rule registries, check lists, CLI entry
   points, scoring code, Claude Code plugin manifests, OpenCode adapters.
3. **Freshness gate**, measured on 2026-11-13. A project is retained only if all hold:
   - 1000+ GitHub stars;
   - several commits in the last 14 days (since 2026-10-30);
   - a release in the last 3 months (since 2026-08-13);
   - issues and PRs closed in the last 30 days at a healthy ratio to those opened, with
     maintainers responding.
4. **Selection**: closeness to the "agent-setup checker" purpose first, then coverage of every
   pillar, then Claude Code and OpenCode support.

Notation: "100+" commits means the API page cap was hit. Issue counts are closed/opened
since 2026-10-14.

## Landscape Summary

- **The top of the space is empty.** No project with 1000+ stars has the health of the agent setup as its
  primary purpose. The closest high-star feature is a single command inside a large plugin
  (ECC `/harness-audit`).
- **The only dedicated deterministic scorer is small**: `paladini/harness-score` (620
  stars, one maintainer, Cursor-first).
- **The long tail is crowded and inactive**: 40+ "agent readiness" scanners, CLAUDE.md
  doctors, and skill linters under 160 stars, mostly Claude-centric, most with no commit in
  the last 14 days. `kodustech/agent-readiness` is an open-source clone of Factory's
  closed-source readiness report.
- **No OpenCode auditor exists.** The only OpenCode "doctor" commands check their own
  plugin install (`oh-my-opencode doctor`). OpenCode core ships none.

## Retained: the Top Ten

| #   | Project                                                                        | Stars | Role                               | Commits 14d | Latest release     | Issues 30d |
| --- | ------------------------------------------------------------------------------ | ----- | ---------------------------------- | ----------- | ------------------ | ---------- |
| 1   | [affaan-m/ECC](https://github.com/affaan-m/ECC)                                | 302k  | Serious competitor                 | 40          | v2.2.3, 10-01      | 90/106     |
| 2   | [NVIDIA/SkillSpector](https://github.com/NVIDIA/SkillSpector)                  | 25.7k | Serious competitor (skill safety)  | 100+        | v2.13.4, 11-04     | 91/103     |
| 3   | [snyk/agent-scan](https://github.com/snyk/agent-scan)                          | 3.2k  | Adjacent, discovery reference      | 7           | v0.6.11, 11-06     | 2/6        |
| 4   | [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) | 33k   | Inspiration                        | 100+        | npm 1.33.1, 11-10  | 7/8        |
| 5   | [ossf/scorecard](https://github.com/ossf/scorecard)                            | 5.8k  | Scoring model to copy              | 65          | v5.6.0, 10-12      | 172/32     |
| 6   | [dyoshikawa/rulesync](https://github.com/dyoshikawa/rulesync)                  | 1.6k  | Cross-agent config reference       | 100+        | v43.8.2, 11-12     | 64/83      |
| 7   | [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | 48k   | Pillar reference: codebase memory  | 100+        | v0.12.1, 10-16     | 86/99      |
| 8   | [mksglu/context-mode](https://github.com/mksglu/context-mode)                  | 34k   | Pillar reference: context limiting | 100+        | v2.1.10, 11-12     | 239/74     |
| 9   | [rtk-ai/rtk](https://github.com/rtk-ai/rtk)                                    | 86k   | Pillar reference: context limiting | 100+        | v1.2.0, 11-08      | 111/184    |
| 10  | [oxsecurity/megalinter](https://github.com/oxsecurity/megalinter)              | 2.6k  | Pillar reference: gates            | 81          | v10.2.0, 10-31     | 21/12      |

### 1. affaan-m/ECC — serious competitor

- **What it is**: a large kit for Claude Code and other agents (71 agents, 314
  skills, hooks, memory). Its `/harness-audit` command is the closest high-star overlap
  with this project.
- **How it works**: `scripts/harness-audit.js` (rubric dated 2026-05-19) is a fixed list
  of check objects `{id, category, points, scopes, path, pass, fix}`. Earned/max points
  per category are normalized to 0–10; non-applicable categories are dropped. Output is
  text or JSON (`--format json`) with failed checks, file paths, and a `top_actions` list
  of the three highest-value fixes. `doctor.js --json` reports install drift.
- **What it analyzes**: up to 12 categories — Tool Coverage, Context Efficiency, Quality
  Gates, Memory Persistence, Eval Coverage, Security Guardrails, Cost Efficiency, plus
  GitHub, Vercel, Netlify, Cloudflare, Fly. In consumer mode (about 11 checks) it tests
  presence only: `AGENTS.md` or `CLAUDE.md` exists, a test script and a CI workflow exist,
  `.claude/memory.md` or ADRs exist, `SECURITY.md` or Dependabot, `.gitignore` covers
  `.env`, `PreToolUse` appears in `.claude/settings.json`. Points are awarded for ECC's own
  assets being installed.
- **Security**: the AgentShield scanner (`npx ecc-agentshield scan`, also an ECC plugin
  and the `affaan-m/agentshield@v1` GitHub Action) carries 268 rules across secrets,
  permissions, hooks (injection, exfiltration, reverse shells), MCP supply chain, and
  per-agent rules such as `opencode-permission-allow-all`. Each category starts at 100
  and loses points per finding (critical 25, high 15, medium 5, low 2), graded A–F, with
  JSON, Markdown, HTML, and SARIF output and `fail-on-findings` gating.
- **Deterministic gates**: `harness-audit` exits 0 regardless of score, so it cannot gate
  CI. AgentShield's Action can.
- **Agentic**: yes. A `harness-optimizer` subagent runs the audit, applies fixes, and
  grades results pass@k. AgentShield `--opus` runs a three-agent red/blue/auditor pipeline
  through `@anthropic-ai/sdk`, which requires `ANTHROPIC_API_KEY`.
- **Surfaces**: slash commands inside the agent, `npx` CLI, GitHub Action, a GitHub App
  (paid tier), the MiniClaw dashboard for AgentShield.
- **Agents**: first-class Claude Code, Codex, Kimi; reduced adapters for OpenCode
  (`.opencode/commands/harness-audit.md`, `install.sh --target opencode`), Cursor, Gemini,
  and about ten others. The audit itself inspects `.claude/` only.
- **Detection markers**: `enabledPlugins["ecc@ecc"]` in Claude Code settings,
  `.opencode/commands/harness-audit.md`.
- **Freshness**: healthy activity on ECC; one dominant maintainer. The standalone
  AgentShield repository has had no commit since 2026-09-10.
- **Verdict**: same concept, weaker execution for our purpose — presence-only checks, a
  score that rewards installing ECC, no CI gating, Claude-scoped inspection.

### 2. NVIDIA/SkillSpector — serious competitor for skill safety

- **What it is**: a pre-install security scanner answering "is this skill safe to
  install?". Partial agent-setup auditor: skill safety and MCP least privilege only.
- **How it works**: a LangGraph pipeline (`src/skillspector/graph.py`) of about 25 static
  analyzers — regex patterns, Python and JavaScript AST checks, taint tracking, YARA rules
  (`yara_rules/agent_skills.yar`), live OSV.dev vulnerability lookups — plus an optional
  LLM stage across 13 providers, including local `claude_cli` and `opencode_cli`. 71
  patterns in 17 categories. Risk score 0–100 (critical +50, high +25, medium +10, low +5,
  ×1.3 for executable files), banded SAFE / CAUTION / DO NOT INSTALL.
- **Activation**: `uv tool install`, Docker, or `skillspector mcp` as an MCP server.
- **Deterministic gates**: documented exit-code contract (0/1/2), `--fail-on-findings`,
  `--fail-on-incomplete`, `--min-coverage`, baseline file for accepted findings; JSON,
  Markdown, SARIF output. `--no-llm` keeps the scan fully local and deterministic. No
  pre-commit hook or GitHub Action shipped.
- **Agentic**: optional LLM pass only; skill content is sent to the provider when enabled.
- **Surfaces**: terminal, MCP server, agent skill (`skills/skill-inspector/SKILL.md`).
- **Agents**: Claude Code (MCP and skill), OpenCode first-class
  (`.opencode/tools/skillspector_scan.ts`, a `/skillspector` command that asks OpenCode
  for permission before running), Pi, Codex.
- **Freshness**: very active, issues often fixed the same day; work concentrated on one
  lead contributor.
- **Verdict**: the strongest skill scanner available. Integrate it (`--no-llm --format
  json`) for the skill-safety checks of pillar 2 instead of rebuilding it.

### 3. snyk/agent-scan — adjacent tool, discovery reference

- **What it is**: formerly `invariantlabs/mcp-scan`. Discovers agents, MCP servers, and
  skills installed on a machine and scores their risk. Machine scope, not repository
  scope; security only.
- **How it works**: per-agent discovery modules in `src/agent_scan/agents/` (Claude Code,
  Claude Desktop, Codex, Copilot, OpenCode, Cursor, Windsurf, Kiro). It launches the stdio
  MCP servers it finds to read their tool lists, with consent per server unless
  `--dangerously-run-mcp-servers` is set. Analysis runs on Snyk's cloud API (`SNYK_TOKEN`
  required); skill content and tool descriptions are uploaded with secrets redacted. 14
  risk types.
- **Activation**: `uvx snyk-agent-scan@latest` or a signed standalone binary.
- **Deterministic gates**: `--ci` returns non-zero on findings; `--ignore-risks`. JSON
  output is marked experimental; no SARIF.
- **Agentic**: no. A separate "Guard" mode installs hooks into Claude Code, Cursor, Codex,
  and Copilot (not OpenCode) that report events to a Snyk dashboard.
- **Agents**: the most complete OpenCode discovery available — `agents/opencode.py` reads
  global, project (`opencode.json[c]`, `.opencode/`), system-managed configs,
  `$OPENCODE_CONFIG`, XDG paths, and the Claude-compatible `.claude/skills` and
  `.agents/skills` paths.
- **Freshness**: steady; Snyk staff review pull requests within one to three days.
- **Verdict**: inspiration and possible integration. Its OpenCode path resolution is the
  model for our own discovery; its cloud dependency rules it out as a deterministic gate.

### 4. davila7/claude-code-templates — inspiration

- **What it is**: a registry of about 1,980 Claude Code components (skills, agents,
  commands, MCP servers, hooks, settings) with an `npx` installer.
- **How it works**: `--health-check` (`cli-tool/src/health-check.js`) runs about 25 flat
  pass/warn/fail checks — system (OS, Node, memory, network, shell), Claude Code install,
  authentication, auto-update, permissions, `.claude/` presence, settings and `.mcp.json`
  parse, agent and command frontmatter, hooks present — and reports passed/total as a
  percentage. It never reads `CLAUDE.md` or `AGENTS.md` content and has no repository
  security checks.
- **Activation**: `npx claude-code-templates@latest --health-check`; `--analytics` opens a
  local web dashboard on port 3333.
- **Deterministic gates**: none for users (no JSON output, no failing exit code). Its own
  CI runs `claude plugin validate` and a five-tier component validator that assigns a
  0–100 trust score (`cli-tool/src/validation/`).
- **Agentic**: no.
- **Agents**: Claude Code only.
- **Freshness**: very active; pull requests merged within minutes.
- **Verdict**: inspiration for the component trust-score pattern and the local dashboard;
  the health check itself is shallow and Claude-only.

### 5. ossf/scorecard — scoring model

- **What it is**: the OpenSSF tool that scores the security health of open-source
  repositories. Not agent-related, but the reference design for a scored, deterministic
  repository checker.
- **How it works**: 54 probes (`probes/`) roll up into 20 checks scored 0–10. The
  aggregate is a risk-weighted average — Critical 10, High 7.5, Medium 5, Low 2.5
  (`docs/checks/internal/checks.yaml`). High-risk checks include Maintained,
  Branch-Protection, Code-Review, Token-Permissions, Vulnerabilities, Signed-Releases,
  Dependency-Update-Tool, Binary-Artifacts.
- **Activation**: Homebrew, Docker, `ossf/scorecard-action`; `scorecard mcp` serves
  published results.
- **Deterministic gates**: SARIF through the Action for code-scanning alerts, badges, a
  public BigQuery dataset, a conformance mode (`--catalog=osps-baseline`).
- **Agentic**: no.
- **Surfaces**: CLI, GitHub Action, REST API, web viewer, badge.
- **Freshness**: active, maintainer team, high closure rate.
- **Verdict**: copy the model — probes, checks, risk weights, 0–10, Action plus SARIF plus
  badge — and its own warning that one aggregate number hides detail. Its Vulnerabilities,
  SAST, and Pinned-Dependencies checks overlap pillar 5.

### 6. dyoshikawa/rulesync — cross-agent configuration reference

- **What it is**: a generator. One `.rulesync/` source produces rules, MCP config,
  commands, subagents, skills, hooks, and permissions for about 65 tools. Not an auditor.
- **How it works**: TypeScript with zod schemas, one processor per feature per tool.
  `rulesync doctor [--strict] [--json]` (`src/lib/doctor.ts`) validates rulesync's own
  configuration (about 22 diagnostic codes, plus tool-specific checks such as
  `codexcli/agents-md-size`).
- **Activation**: npm, Homebrew, single binary, an MCP server, official skills via
  `rulesync fetch`.
- **Deterministic gates**: `rulesync generate --check` exits 1 when generated files are
  stale — a ready-made drift gate for CI.
- **Agentic**: no.
- **Agents**: Claude Code, OpenCode (v1 and v2), and Codex are first-class.
- **Detection markers**: `.rulesync/` directory.
- **Freshness**: daily releases. (`intellectronica/ruler`, the older alternative, was
  rejected as stale.)
- **Verdict**: complementary. When `.rulesync/` is present, the auditor runs
  `generate --check` to detect configuration drift between agents.

### 7. DeusData/codebase-memory-mcp — codebase memory reference

- **What it is**: a local MCP server written in C that builds a persistent code knowledge
  graph. Not an agent-setup auditor.
- **How it works**: tree-sitter grammars plus LSP-backed type resolution, stored in SQLite
  under `~/.cache/codebase-memory-mcp/`. 17 MCP tools (`index_repository`,
  `search_graph`, `trace_path`, `detect_changes`, `query_graph`, `get_architecture`,
  `check_index_coverage`, and others). On Claude Code it adds non-blocking hooks
  (`SessionStart`, `SubagentStart`, `PreToolUse` on Grep/Glob/Bash adding context) and
  three subagents.
- **Activation**: `install.sh` then `codebase-memory-mcp install` (detects 46 clients), or
  `claude plugin install codebase-memory@codebase-memory`; npm, PyPI, Homebrew, AUR, Nix.
- **Deterministic gates**: experimental change-aware test selection (`docs/SMART_CI.md`).
- **Agentic**: ships subagent profiles; the server itself is not agentic.
- **Surfaces**: CLI, MCP, the CBM Lens web UI (beta).
- **Agents**: Claude Code (hooks, plugin) and OpenCode (plugin, agent file, MCP entry)
  first-class; Codex and Cursor via skills and agents.
- **Detection markers**: repository — `.mcp.json` server `codebase-memory-mcp`,
  `.cbmignore`, `.codebase-memory.json`, `.codebase-memory/`; user scope — `mcpServers`
  in `~/.claude.json`, hook command `codebase-memory-mcp hook-augment`,
  `~/.config/opencode/plugins/cbm-augment.ts`, `~/.config/opencode/agents/codebase-memory.md`,
  `mcp` entry in `opencode.json`; tool names `mcp__codebase-memory-mcp__*` or
  `mcp__plugin_codebase-memory_codebase-memory-mcp__*`.
- **Risks**: one dominant contributor; the installer edits many global files. No
  telemetry; SLSA level 3 provenance.
- **Verdict**: the reference for pillar 3, with the most explicit cross-agent markers.

### 8. mksglu/context-mode — context limiting reference

- **What it is**: an MCP server plus hooks that keep tool output out of the context
  window. Not an agent-setup auditor; `ctx_doctor` checks only its own install.
- **How it works**: a `PreToolUse` hook denies large reads (over 16 KB), `cat`/`tail`,
  `curl`, and web fetches, and redirects them to sandboxed `ctx_*` tools; a `PostToolUse`
  hook replaces outputs over 4 KB with an index reference. Content goes to an SQLite FTS5
  store per project; a compaction snapshot of at most 2 KB is restored with `ctx_resume`.
- **Activation**: Claude Code plugin; OpenCode `mcp` and `plugin` entries in
  `opencode.json`.
- **Deterministic gates**: none for users.
- **Agentic**: no.
- **Agents**: ten agents; Claude Code and OpenCode first-class.
- **Detection markers**: `enabledPlugins["context-mode@context-mode"]`, MCP server
  `context-mode`, skills `ctx-doctor`, `ctx-stats`, `ctx-upgrade`; in OpenCode,
  `mcp.context-mode` and `"context-mode"` in the `plugin` array.
- **Risks**: Elastic License 2.0 (not OSI-approved); a deny-and-redirect hook can fail
  closed when it breaks (issue #1370); hosted gateway upsell; single maintainer. No
  telemetry.
- **Verdict**: the most rigorous reference for pillar 4. The auditor reports its license
  and its fail-closed hook as informational findings.

### 9. rtk-ai/rtk — context limiting reference (shell output)

- **What it is**: a Rust CLI proxy with 100+ command-specific filters that compress shell
  output before it reaches the agent.
- **How it works**: a hook rewrites commands (`git status` becomes `rtk git status`).
  `hook_check.rs`, `integrity.rs`, `rtk discover`, and `rtk session` audit RTK's own
  install and analyze transcripts for missed savings — a design worth borrowing.
- **Activation**: `rtk init`; Claude Code `PreToolUse` hook; OpenCode plugin
  (`hooks/opencode/rtk.ts`) for OpenCode 1.18.29+.
- **Deterministic gates**: none for users.
- **Agentic**: no.
- **Agents**: Claude Code and OpenCode first-class; Codex and Cursor hooks.
- **Detection markers**: `PreToolUse` matcher `Bash` with command `rtk hook claude` (older
  installs: `~/.claude/hooks/rtk-rewrite.sh`), `RTK.md` plus an `@RTK.md` line in
  `CLAUDE.md`, the OpenCode plugin file, `.rtk/filters.toml`.
- **Risks**: the hook returns `permissionDecision: "allow"` for rewritten commands, which
  skips the permission prompt (now re-checked against user deny/ask/allow rules in
  `src/hooks/permissions.rs`); 930 open issues and 754 open pull requests; mixed Apache
  and BUSL editions; opt-in telemetry.
- **Verdict**: the de-facto standard for shell-output compression. The auditor flags its
  auto-approve hook and its injected `@RTK.md` line for review.

### 10. oxsecurity/megalinter — deterministic gates reference

- **What it is**: a Docker-based aggregator of 100+ linters and scanners.
- **How it works**: one configuration (`.mega-linter.yml`) runs language linters,
  formatters, secret scanners (trufflehog, secretlint, and others), vulnerability and
  infrastructure scanners (trivy, grype, osv-scanner, checkov, semgrep, devskim), and SBOM
  generation (syft), with SARIF output.
- **Activation**: GitHub Action, `mega-linter-runner` on npm, pre-commit hook
  `megalinter-incremental` (requires Docker, slow).
- **Agentic**: optional. A Claude Code plugin with watcher, runner, and fixer subagents;
  skills installable for OpenCode; an LLM advisor.
- **Agents**: Claude Code (plugin) and OpenCode (skills).
- **Detection markers**: `.mega-linter.yml`, a workflow using `oxsecurity/megalinter@*`,
  `megalinter-incremental` in `.pre-commit-config.yaml`, `megalinter-reports/`.
- **Risks**: AGPL-3.0; one dominant maintainer.
- **Gap it leaves**: no linter for agent configuration files (`AGENTS.md`, `SKILL.md`, MCP
  descriptors).
- **Verdict**: the strongest single CI-level bundle for pillar 5. For the commit-hook
  layer, the auditor recommends a fast hook runner (prek) instead.

## Watched, Below the 1000-Star Threshold

**paladini/harness-score** (620 stars) — the closest functional analog.

- 36 deterministic checks, 108 points, 6 dimensions (`packages/cli/src/checks/`):
  context guides (CTX), skills (SKL), hooks as gates versus feedback (HKS), sensors —
  test runner, linter, type checker, formatter (SNS), CI and pre-commit (CI), hygiene —
  `.env` handling, credential signatures, MCP credentials (HYG), plus subagents (AGT).
- Levels L0–L4 gated per dimension; zero LLM calls, zero network, zero runtime
  dependencies as stated commitments; JSON, Markdown, badge, diff output; `--min-level`
  gate; stable exit codes; GitHub Action with pull request comments.
- Gaps: no codebase-memory or context-limiting checks, no permission allow/deny audit, no
  MCP pinning, no skill-safety scan, no check that scanners are wired into hooks, no
  import validation. OpenCode support covers `.opencode/agents/*.md` only.
- Bus factor of one; an external pull request has waited since 2026-10-17.

**agent-sh/agnix** (480 stars) — the best well-formedness linter.

- Rust linter, LSP, and MCP server; 760 evidence-backed rules (source URL, verification
  date, MUST/SHOULD level, CWE), 67 of them for OpenCode, 125 auto-fixable.
- Examples: instruction file over 200 lines, always-loaded instructions over the combined
  budget, root `AGENTS.md` without build or test commands, conflicting commands across
  tools.
- SARIF, JSON, GitHub annotations; `.pre-commit-hooks.yaml`; VS Code, JetBrains, Neovim,
  and Zed extensions; GitHub Action.
- No readiness score, no memory, context, or hook-wiring checks.
- Candidate backend for the well-formedness checks of pillars 1 and 2.

## Rejected

| Project                             | Stars | Reason                                                                                                   |
| ----------------------------------- | ----- | -------------------------------------------------------------------------------------------------------- |
| github/spec-kit                     | 150k  | Process tool; `specify check` only verifies agent CLIs are on `PATH`.                                    |
| thedotmack/claude-mem               | 117k  | Pillar 3 already covered; telemetry on by default, paid upsell, README promotes a crypto token.          |
| coleam00/Archon                     | 24k   | OpenCode provider deprecated upstream; fails the parity requirement.                                     |
| oraios/serena                       | 31k   | Activity slowing: 2 commits in 14 days, 13/39 issues.                                                     |
| cobusgreyling/loop-engineering      | 11.8k | Last human-authored commit 2026-08-28; recent activity is bots; its score rewards its own method.        |
| Tencent/AI-Infra-Guard              | 7.5k  | LLM-only scanners, no deterministic gates, aimed at a different agent ecosystem.                         |
| cisco-ai-defense/mcp-scanner        | 1.1k  | MCP only; LLM and API engines need keys. Its offline YARA rules are worth reading.                       |
| Pantheon-Security/medusa            | 1.0k  | No commit since 2026-08-10; AGPL. Its `.claude/` permission heuristics are worth reading.                |
| affaan-m/agentshield (standalone)   | 1.4k  | No commit since 2026-09-10; covered under ECC.                                                            |
| intellectronica/ruler               | 3k    | No commit in 14 days; superseded by rulesync.                                                             |
| zilliztech/claude-context           | 12.7k | No release ever published; 1/1 issues.                                                                    |
| anthropics/skills                   | 194k  | Spec reference, but 1 commit in 14 days, no releases, 5/51 issues.                                       |
| alibaba/open-code-review            | 50k   | LLM code reviewer, not an agent-setup tool.                                                                    |

Hook runners are cited, not ranked: `j178/prek` (Rust drop-in for pre-commit, very
active) is the recommended runner; `pre-commit/pre-commit` and `evilmartians/lefthook` are
the other standard choices.

## Coverage Matrix

| Pillar                         | Best existing coverage                              | Gap                                                    |
| ------------------------------ | --------------------------------------------------- | ------------------------------------------------------ |
| 1. Instruction files           | agnix (deep lint); ECC, harness-score (presence)    | No score combining lint with content checks.           |
| 2. Skills                      | agnix (format); SkillSpector (safety)               | Nobody combines format, triggerability, and safety.    |
| 3. Codebase memory             | none (ECC checks a `.claude/memory.md` file)        | No detection of memory MCP servers or plugins.         |
| 4. Context limiting            | none (agnix checks file sizes only)                 | No detection of context-mode, rtk, or output caps.     |
| 5. Deterministic gates         | harness-score, ECC (a hook or CI file exists)       | Nobody checks that scanners are wired into the hooks.  |
| 6. Agent-config security       | AgentShield, SkillSpector, agent-scan               | No permission-list audit with OpenCode parity.         |
| Claude Code / OpenCode parity  | agent-scan (discovery only), agnix (lint only)      | No auditor scores both agents equally.                 |

## Decision

**Position qol-mini vitals as the first deterministic, scored auditor with Claude Code
and OpenCode parity, covering the pillars no existing tool checks.**

- Own the gaps: memory and context-limiter detection, hook wiring of lint, format,
  vulnerability, and secret scanners, permission-list audits, MCP pinning, OpenCode parity.
- Copy Scorecard's scoring model and harness-score's per-pillar level gating.
- Integrate agnix and SkillSpector when present instead of reimplementing them.
- Model discovery on agent-scan's OpenCode path resolution, covering repository and user
  scope.
- Use the detection markers catalogued above as the first marker registry.
- **Re-run the freshness gate before any change to the README project list.** Drop a
  project that fails it.

## Alternatives Rejected

**NO ranking by stars alone**: We reject because several high-star projects are stale,
bot-driven, or ship risky defaults; maintainer activity is the signal.

**NO contributing to ECC `/harness-audit` instead**: We reject because it lives inside an
opinionated plugin whose score rewards its own assets and which inspects `.claude/` only.

**NO contributing to harness-score instead**: We reject because it is Cursor-first,
maintained by one person with external pull requests waiting, and lacks four of our
checks families; it remains on the watch list.

## Trade-offs

### Wins

- Clear, defensible gap: no tool scores memory, context limiting, hook wiring, and OpenCode
  parity.
- A ready marker catalog for the ten pillar references.
- Integration targets that avoid rebuilding mature scanners.

### Costs

- The snapshot ages fast; star counts and activity figures must be re-measured.
- Pillar references with single maintainers or non-OSI licenses may need replacing.
- harness-score could close the gap quickly; watch it.

## References

- [Factory — Agent Readiness](https://factory.ai/news/agent-readiness) — closed-source
  readiness report, eight pillars and five levels.
- [kodustech/agent-readiness](https://github.com/kodustech/agent-readiness) — open-source
  clone of the Factory report.
- [paladini/harness-score](https://github.com/paladini/harness-score)
- [agent-sh/agnix](https://github.com/agent-sh/agnix)
- [j178/prek](https://github.com/j178/prek)
- [OpenSSF Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md)
- ADR 0005: `0005-vitals-audits-a-repository-for-coding-agents.md` — pillars and principles.
