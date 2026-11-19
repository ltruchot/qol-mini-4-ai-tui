# TODO

## Where we stopped

`qol-mini@0.7.1` is published from `main`: `qol-mini vitals` runs the gates of
`code-harness-vitals` as WebAssembly, the two review skills are in the bank (trigger
evals 16/16 each) and each ran once from an installed copy under `claude -p`.
0.7.0 ships a `skills-review` that fails to load; 0.7.1 fixes it. Nothing in progress.
`code-harness-vitals` is archived on GitHub, its README points here. Left from the
merge: deprecate 0.7.0, on a yes; the review skills under OpenCode.
Context: todo/vitals-merge.md

0.6.2 is what `./install.sh --replace` delivered on this machine; the global files did
not change since. Bank: `vp` and `css-modern` carry no `paths`, kaizen reads AGENTS.md.
This repo runs Vite+ 1.5.0, Node 26.13.0, pnpm 12.16.1, `minimumReleaseAge` 4320;
179 tests. `mise.toml` at the root is trusted on this machine (`mise trust`).

The twelve repos of `.local/repos.json` carry the same setup and are harmonized: AGENTS.md is
the rules file (the harness keeps `CLAUDE.md` as a symlink to it), committed and pushed where
they have a remote. Their temporary release-age exclusions are dropped by a job scheduled for
2026-11-07 06:13 local time in the session that set them up; it does not outlive that session.

## Later

- Vitals: JSON and SARIF output for every gate (`vitals-utils::Report`); a scoring
  engine, 0–10 per gate with risk weights and per-pillar levels (ADR 0005 open question)
- Vitals, next gate: `codebase-memory` (pillar 3), per the ADR 0008 catalog; use the
  `add-gate` skill
- Vitals, `agents-md`: commands that do not exist, imports outside the repository, the
  `claudeMd` key of managed settings; instruction files inside ignored dependency
  directories; user settings that change the cascade (`claudeMdExcludes`)
- Vitals, `skills`: SkillSpector or agnix when installed (amends ADR 0008);
  `.claude/commands/` files, `opencode.json` `skills` entries, `--add-dir`, enterprise and
  plugin skills, `XDG_CONFIG_HOME`; the order between OpenCode's sources for one id
- Vitals, `skills`: a probe for a command-injection line in a `SKILL.md` that only cites
  the syntax (the skill fails to load)
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
