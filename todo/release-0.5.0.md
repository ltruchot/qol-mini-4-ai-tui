# Release 0.5.0

The converters target OpenCode 2.1 native shapes, checked by
`@opencode/schema`; undo survives a re-run; the kit fixes from the review.
`vp run ready` green in the tree.

- [x] commit, by concern: converters + contract tests, undo and options,
      kit fixes, CI and docs
- [x] `packages/qol-mini/package.json` at 0.5.0
- [ ] push `main`; CI green; the new jobs (Node 22.18, Windows tests,
      concurrency) run for the first time there
- [ ] CI green on the branch; the Windows test job is non-blocking
      (`continue-on-error`) until the suite's POSIX paths are ported
- [ ] tag `v0.5.0`, push it, approve
      the run in the `release` environment, `+ qol-mini@0.5.0` in the log
- [ ] dry-runs again on the four real repos, read every named loss
- [ ] the first live write: `harmonize <repo> --only rules`, then a full
      run; a Claude Code session and an OpenCode session in it
- [ ] other machines: `pnpm dlx qol-mini@latest install --replace`
