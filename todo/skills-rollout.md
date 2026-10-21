# Skills rollout: commit in nine repos

## State

`0.2.0` is on npm and this repo is pushed. What is left: in each repo below, read the diff
and commit, in that repo's own flow.

## The nine repos

Seven personal repos and two organization repos, one of them on a feature branch.

Installed from this clone (`node packages/qol-mini/dist/cli.js`), lock `ref: 0.2.0`,
**uncommitted in each repo**, `skills check` up to date, the repo's own `vp check` passing:

| Repo | Managed | Local skill kept beside it | Ignore entries |
|---|---|---|---|
| a Pixi TypeScript seed | `vp` | `vp-local` | `vite.config.ts` fmt + lint |
| an Elm monorepo | `vp` | `vp-local` | `vite.config.ts` fmt + lint |
| two Datastar apps (single repo, monorepo) | `vp`, `datastar` | `vp-local`, `datastar-cqrs` (five facts corrected) | `vite.config.ts`, `.oxlintrc.json` |
| a Three.js app | `vp` | `vp-local` + `references/ops-traps.md` | `vite.config.ts` fmt + lint |
| a monorepo with an `apps/animator` | `vp` | `vp-local` | `vite.config.ts` fmt + lint |
| a NATS tutorial | `datastar` (replaces its copy) | none | no formatter at the root |
| a WordPress SSE plugin | `datastar` | `datastar-wordpress` (one fact corrected) | PHPCS reads PHP only |
| an organization monorepo | `css-modern` updated to 0.2.0, four conflicts resolved | its repo note stays in the file: `check` says modified | Prettier + ESLint, committed |

`vp check` in the monorepo with `apps/animator` reports seven TypeScript errors there,
present before.

- What is specific to a repo sits in a local skill beside the managed one (`vp-local`), so
  the managed file is never edited.
- The other local skills of those repos still declare `globs`, which Claude Code ignores; the
  field is `paths`. Only the files touched during the rollout were changed.
- A WordPress theme repo is untouched: it keeps its own `css-modern`.
