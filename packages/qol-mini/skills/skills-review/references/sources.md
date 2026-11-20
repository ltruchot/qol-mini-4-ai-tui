# Rubric sources

Where each criterion of the `skills-review` rubric comes from, and which probes the same
sources back.

| Source | Criteria | What it contributes |
|---|---|---|
| [Claude Code — Extend Claude with skills](https://code.claude.com/docs/en/skills) | 1, 2, 3, 4, 5, 6, 7, 8, 10, 14; probes `SK02`–`SK12`, `SK15`, `SK16`, `SK17`, `SK20` | skill locations and the walk up to the repository root; nested skills on demand; personal over project; frontmatter fields and booleans; YAML that does not parse loads no fields; `description` + `when_to_use` truncated at 1,536 chars; "keep `SKILL.md` under 500 lines"; compaction keeps the first 5,000 tokens; "Skill not triggering", "Skill triggers too often", "Claude stops following a skill" |
| [Agent Skills specification](https://agentskills.io/specification) | 1, 5; probes `SK08`, `SK10`, `SK11`, `SK12`, `SK17` | `name` charset and length, matching its folder; `description` up to 1,024 chars; progressive disclosure; references relative to the skill root, one level deep |
| [OpenCode source](https://github.com/anomalyco/opencode/tree/d759c548aa/packages/core/src) at `d759c548aa` | 10; probes `SK02`–`SK07`, `SK09`, `SK14`, `SK15` | `config/discovery.ts` and `config/plugin/compatibility.ts`: `.claude`, `.agents`, `.opencode` in every directory up to `/`, source order; `config/plugin/skill-scan.ts`: layout; `config/plugin/skill-file.ts`: id, the four fields read; `config/markdown.ts`: YAML repair; `skill/instructions.ts`: only described skills are listed |
| [Agent Skills — Using scripts](https://agentskills.io/skill-creation/using-scripts) and [Best practices](https://agentskills.io/skill-creation/best-practices) | 13, 15; probes `SK18`, `SK19` | when a script replaces prose; scripts listed in `SKILL.md`; pinned versions; no interactive prompt, `--help`, structured stdout, diagnostics on stderr, errors that say what to try, `--dry-run` |
| [SkillSpector](https://github.com/NVIDIA/SkillSpector) pattern categories | 9 | prompt injection, exfiltration, droppers, and dangerous commands in skill scripts |
| [The audit's intent](https://github.com/ltruchot/qol-mini-4-ai-tui/blob/main/docs/adr/0005-vitals-audits-a-repository-for-coding-agents.md), pillar 2 "Safety"; pillar 1 "no references to files or commands that do not exist" | 9, 12 | the audit's own scope |
| `agents-md-review` criterion 15 | 11 | what every session needs lives in `AGENTS.md`; what one task needs lives in a skill |
