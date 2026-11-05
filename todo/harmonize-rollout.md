# Harmonize rollout

`qol-mini@0.6.0` on npm: OpenCode 2.1 native output checked by
`@opencode/schema`, rules files that import each other merged, kept files
git ignores named after every run. Run no `harmonize` from 0.4.0.

Per repo, from any directory (absolute path; `<repo>` is a placeholder,
zsh reads `<…>` as a redirection):

```bash
pnpm dlx qol-mini@latest harmonize /abs/path/repo --dry-run   # read every warning
pnpm dlx qol-mini@latest harmonize /abs/path/repo --only rules
pnpm dlx qol-mini@latest harmonize /abs/path/repo
```

Then a Claude Code session (`AGENTS.md loaded` line) and an OpenCode
session in it; commit AGENTS.md, the generated files and
`.claude/qol-mini.lock.json`.

## State

- The twelve repos of `.local/repos.json` are harmonized from this clone: rules in
  AGENTS.md (pure; the harness in symlink mode), `opencode.json` where the repo has
  permissions, committed and pushed where they have a remote.
- gen-models-on-network: rules merged (AGENTS.md imported CLAUDE.md), its
  `.gitignore` line for AGENTS.md removed by the owner; the commit and the
  two live sessions are the owner's, unverified here.
- The other real repos: not run. Reading or running in them needs the owner's
  per-path permission.
- Other machines: `pnpm dlx qol-mini@latest install --replace`, restart the
  TUIs after.
- Never verified: a harmonized repo in a live session of either agent. The
  first one closes the "Never" row of the AGENTS.md verification table: a new
  Claude Code session in this repo now loads AGENTS.md, not CLAUDE.md.
