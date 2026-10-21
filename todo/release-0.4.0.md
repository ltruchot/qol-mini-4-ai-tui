# Release 0.4.0

Everything is on `main`, `vp run ready` green, 119/119. The harmonizer ships:
the converters, the command family, the lock section, the docs.

- [x] `qol-mini harmonize <project>|check|undo|scan` — bidirectional
      (rules pure/bridge/symlink, permissions, commands, agents, MCP),
      the first run decides the direction, guards on edits and foreign
      files, backups for undo, scan bounded to named roots
- [x] dry-runs on the four real repos: claw-manager (legacy, its
      opencode.json guarded), this kit (claude-only, one rename),
      gods-monorepo (legacy, the GSD-managed commands all guarded, the
      map-form `permission` named and untouched),
      modern-coder-24vram-harness (legacy)
- [x] scan over a 24-repo workspace, every rules state read correctly
- [x] ADR 0003, docs/harmonize.md, the README tables, the CLAUDE.md
      constraints, the install hint pointing at scan
- [ ] tag `v0.4.0`, push it, approve the run in the GitHub environment
      `release`
- [ ] after npm: the other machines move — `pnpm dlx qol-mini@latest
      install --replace`; each repo: `pnpm dlx qol-mini@latest harmonize
      <repo>`, then commit the lock and the generated files
- [ ] the first live write: `harmonize <repo>` on one repo, then a Claude
      Code session and an OpenCode session in it, both reading AGENTS.md —
      the dry-runs and the suite are the proof so far
