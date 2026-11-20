# TODO

## Where we stopped

`qol-mini@0.7.1` is published and `latest` on npm; 0.7.0 is deprecated there. `main` is
at that release. Two branches wait, stacked, nothing released from them:

- `feat/vitals-fix`, PR #2, ready, CI green: a finding names the `qol-mini` command that
  fixes it (`run:` line), each gate takes `--json`, `qol-mini vitals --fix [--dry-run]`
  runs the named commands and audits again (ADR 0010). To do: merge it into `main`.
- `gate/skills-standard`, on top of it: probes `SK16`–`SK20` (fields no agent reads,
  `compatibility`, scripts `SKILL.md` never names, package commands without a version,
  injected commands nothing pre-approves) and criteria 13–15 of `skills-review` (what
  belongs in a script, how a script behaves). To do: rebase on `main` once PR #2 is in,
  open its PR, run `skills-review` from an installed copy under `claude -p` and
  `opencode run`, and its trigger evals (the description did not change).

The next version is not chosen and no tag is pushed.

0.6.2 is what `./install.sh --replace` delivered on this machine; the global files did
not change since. Bank: `vp` and `css-modern` carry no `paths`, kaizen reads AGENTS.md.
This repo runs Vite+ 1.5.0, Node 26.13.0, pnpm 12.16.1, `minimumReleaseAge` 4320;
179 tests. `mise.toml` at the root is trusted on this machine (`mise trust`).

The twelve repos of `.local/repos.json` carry the same setup and are harmonized: AGENTS.md is
the rules file (the harness keeps `CLAUDE.md` as a symlink to it), committed and pushed where
they have a remote. Their temporary release-age exclusions are dropped by a job scheduled for
2026-11-07 06:13 local time in the session that set them up; it does not outlive that session.

## Later

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
- Bank: `SK19` warns on `agents-md-review` and `skills-review`, which name `npx qol-mini`
  with no version. Pinning freezes the gates a skill calls; decide, then pin or exempt
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
