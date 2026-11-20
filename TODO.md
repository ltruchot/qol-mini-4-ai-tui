# TODO

## Where we stopped

`qol-mini@0.7.1` is published and `latest` on npm. `main` holds 0.8.0, not published:
`qol-mini vitals --fix` and `--json` (ADR 0010), probes `SK16`–`SK20`, the review skills
pinned to the kit version, `qol-mini kaizen release` and project kaizen copies that name
no machine path (ADR 0011), the rules split into nested `AGENTS.md` files.

Next action: publish 0.8.0 (`git tag v0.8.0`, push the tag, approve the `release` run,
`docs/release.md`). This repo's own kaizen copy releases through `npx qol-mini@0.8.0`,
which works once that version is on npm.

`qol-mini vitals . --repo-only` reports no warning on this repository. Without
`--repo-only`, the user scope of this machine reports `SK14` (personal skills under
`~/.agents/skills` and `~/.config/opencode/skills`) and `SK15` (the global kaizen copy
shadows the project one).

The changed bank skills (`qa-pr`, `npm-vulnerability-check`, `datastar`, `kaizen`, the
two review skills) load under `claude -p` and `opencode run`; their `skill-creator`
old-against-new runs are not done. Their descriptions did not change: no trigger eval.

This repo runs Vite+ 1.6.0, Node 26.13.0; 208 tests. `mise.toml` at the root is trusted on
this machine (`mise trust`).

## Later

- Tab marker format: settable through `CC_TAB_WORKING`, `CC_TAB_BLOCKED`, `CC_TAB_IDLE`;
  what reads best is untested
- A warning triangle shows on every tab in the terminal list. Cause unknown
- Unchecked on a `/compact` with markers: the dim post-compaction line and the
  compaction instructions, for our JSON. If dirty, remove the `PreCompact` marker only
- Vitals: a scoring engine, 0–10 per gate with risk weights and per-pillar levels (ADR
  0005 open question), in the JSON report and the summary line
- Vitals, next gate: `codebase-memory` (pillar 3), per the ADR 0008 catalog; use the
  `add-gate` skill
- Vitals, `agents-md`: commands that do not exist, imports outside the repository, the
  `claudeMd` key of managed settings; instruction files inside ignored dependency
  directories; user settings that change the cascade (`claudeMdExcludes`)
- Vitals, `skills`: SkillSpector or agnix when installed (amends ADR 0008);
  `.claude/commands/` files, `opencode.json` `skills` entries, `--add-dir`, enterprise and
  plugin skills, `XDG_CONFIG_HOME`; the order between OpenCode's sources for one id
- Vitals, `skills`: launch an external validator from the CLI, never from a gate:
  `qol-mini vitals skills --with claude` runs `claude plugin validate <root> --json`
  (Claude Code 2.1.233 or later), `--with skills-ref` the reference validator of
  agentskills.io (source checkout only, "not meant to be used in production"); amends
  ADR 0008
- Vitals, `skills`, not probed: the 5,000-token body target (no char count stands for a
  token), reference chains deeper than one level, whether `allowed-tools` covers each
  injected command
- Vitals, commands that are missing for a `run:` line: moving a skill into
  `.claude/skills/` (`SK02`–`SK05`), a `.claude/CLAUDE.md` or a nested `CLAUDE.md`
  (`AM03`, `AM09`)
- Vitals, SARIF from the same `Report`; `--min-score`
- Vitals, tarball: the two modules weigh 1.6 MB each, unoptimized for size; `wasm-opt` or
  `opt-level = "z"` is unmeasured. A gate run costs about 0.15 s, against 2 ms native
- Bank, the two review skills: `skills-review` run on them reports their closing
  `Rubric sources` link as naming no moment to read it (its rubric 5)
- `skills-review` installed from npm under `claude -p` with the allowlist
  `Bash(npx qol-mini:*)`: its probe command was refused once; installed from the clone
  it ran. Unexplained
- Vitals on Windows: a home directory on another drive than the repository is
  unmeasured
- From 2026-11-07 05:00 UTC: drop the Vite+ 1.5.0 release-age exclusions in every repo of
  `.local/repos.json` (done? check `minimumReleaseAgeExclude` in qol-mini) → todo/vite-plus-fleet.md
- `harmonize run` inside a repo misreads it: with no project it reports "no rules file" next to a
  CLAUDE.md and an AGENTS.md, and `harmonize run .` fails with `Unused args: .`;
  `qol-mini harmonize ./<repo>` and `harmonize check ./` work
- Rollout of the harmonizer on real repos and the first live sessions in both agents →
  todo/harmonize-rollout.md
- Port the test suite's POSIX paths and file modes to Windows, then drop
  `continue-on-error` from the `test-windows` job in `.github/workflows/test.yml`
- Harmonizer follow-ups: hooks compiled to OpenCode plugin shims, the home
  directory audit (`harmonize --global`), a CI job calling `harmonize check`,
  a validation pass under Orca (parallel worktrees vs `qol-mini-off`) →
  todo/harmonize.md
- `qol-mini install` asks, among its setup prompts, whether the kaizen `TODO.md`
  and `todo/` stay in git tracking: default yes — they are committed. A machine
  that wants them out names the repos, and only those repos' `.gitignore`
  gains the entries. The kaizen skill neither knows nor decides this.
- Commit the 0.2.0 skills in the rollout repos left, each in that repo's own flow →
  todo/skills-rollout.md
- A shared core for `qodo-pr-review` (finding anatomy, the GraphQL thread queries, the shell
  traps): a monorepo and a WordPress theme hold two forks with opposite merge policies,
  which stay local.
