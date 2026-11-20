# The harmonizer

- `qol-mini harmonize` makes one repo run under both agents. Sources:
  `src/commands/harmonize-*.ts`, `src/harmonize/`, `src/core/harmonize/`.
  The design lives in `docs/adr/0003-agents-md-is-the-canonical-rules-file.md`
  and `docs/harmonize.md`.
- AGENTS.md is the canonical rules file: `--rules pure` leaves it alone in the
  repo, `bridge` and `symlink` are the named fallbacks. Rules files are never
  lock artifacts: `check` verifies the layout state, not a hash — AGENTS.md is
  the user's file.
- `pure` moves the rules, not what names them: after a run, `git grep -n
  'CLAUDE\.md'` finds the repo's own references (docs, skills, code allow
  lists); `check` does not see them.
- The first run decides the source of truth; a re-run keeps it, `--from`
  overrides. Auto-detection is not stable once both sides exist: a flip would
  convert the tool's own output back.
- Two rules files where one imports the other merge into AGENTS.md, the
  import line replaced by the imported file (`core/harmonize/rules-merge.ts`):
  OpenCode does not expand `@` imports. Two that differ otherwise are a
  conflict: nothing is written until `--replace` names the winner. A generated markdown file edited by hand
  is named, not overwritten; one the kit never wrote is never overwritten.
- A JSON config the user wrote (`opencode.json(c)`, `settings.json`,
  `.mcp.json`) is patched in place with `jsonc-parser`: only owned keys move,
  comments and key order stay. Never reserialize it: in OpenCode's legacy
  `permission` map, key order is precedence.
- OpenCode output is the 2.1 native form, decoded in the tests by
  `@opencode/schema` (`tests/helpers/opencode.ts`): `permissions` array,
  `mcp.servers`, native agent keys. A command whose `model` is not
  `provider/model` fails that decode and OpenCode drops it without a word.
  Why: `docs/adr/0004-opencode-output-is-checked-against-its-schema.md`.
- Precedence: Claude Code applies deny, ask, allow; OpenCode the last
  matching rule. Converted rules go allow, ask, deny, ahead of the user's
  own `permissions`. Overriding a stricter legacy rule is a conflict.
- `settings.local.json` is machine-local: reported, never converted. MCP
  values that are literal, not `${VAR}` or `{env:VAR}`, are named before they
  can land in a committed file.
- The tests run the sources; `tests/e2e/bin-harmonize.test.ts` runs the
  bundle. The bundler resolves `module` before `main`: a UMD `main` that
  requires its parts at runtime breaks the bundle only.
- A kept file git ignores is a warning naming the `.gitignore` line, never a
  conflict (`harmonize/gitignored.ts`): the run still writes. A tracked file
  is never reported: git keeps it whatever the ignore rules say.
- Backups for `undo` live under `~/.cache/qol-mini/harmony/<repo>/`; slot
  numbers only grow, so an artifact carried between runs keeps its slot.
- Hooks are reported with the OpenCode event or hook a plugin listens to,
  not converted: a hook body is an arbitrary command.
- Scan walks named roots only, never `/` or the home directory, and a dir
  holding `.git` is scanned, not descended into.
