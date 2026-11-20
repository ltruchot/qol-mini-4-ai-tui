# The skill bank

Each directory here is one shipped skill: `SKILL.md`, its files, and `qol-mini.yaml`.
The CLI that installs them is ruled in the root `AGENTS.md`, section "Skills".

- The bank grows by review: skills duplicated across local projects are collected and
  compared at intervals, and one enters when the same need shows in several projects.
  Its text is rewritten generic, every claim checked against a primary source.
- A skill enters only if it serves professional work and can be public. Never: a
  secret or a credential, private or personal data, a host or account name, an insecure
  practice, copyrighted text without a license that allows it, a third party's skill
  that has its own installer, anything specific to one project. What is specific to
  a project is a placeholder, or stays in that project.
- The bank's `SKILL.md` frontmatter holds only the fields of the skills reference; a
  field outside the table is ignored by Claude Code with no error.
- A `SKILL.md` never holds an exclamation mark before a backquoted command, in
  prose or in a table: Claude Code runs it when the skill loads, and the skill
  fails with `Shell command permission check failed`. Name the syntax in words.
- `paths` hides a skill: absent from the listing, `Unknown skill` on invoke, until a
  matching file inside the working directory is read. A skill needed before a command
  runs, not before a file is read, carries no `paths`.
- A new or changed bank skill goes through `skill-creator`: trigger evals
  (`scripts.run_eval`, should and should-not queries) and old-against-new runs.
  `tests/unit/shipped-skills.test.ts` holds the list.
- Run `run_eval` with `--num-workers 1`, one scratch project per skill: parallel
  workers share `<scratch>/.claude/commands/`, the model picks another worker's copy,
  and every query reads as untriggered.
- Trigger evals read the description, never the body. Before a release, install
  the skill in a scratch project and run `claude -p "/<name>" --output-format
  stream-json --verbose`: a body that fails to load shows only there.
  A skill that calls `npx qol-mini` runs the published version there: first
  `vp pm pack`, then `npm i -D <tarball>` in the scratch project.
  Under OpenCode: `opencode run --standalone --auto "<prompt>"`, in a scratch
  project only; without `--auto` the session holds no shell tool.
