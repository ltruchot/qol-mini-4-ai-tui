# Skills rollout: commit in nine repos

## State

`0.2.0` is on npm and this repo is pushed. What is left: in each repo below, read the diff
and commit, in that repo's own flow.

## The nine repos

All under `/home/cellolow/workspace/`: `github-ltruchot/<name>`, except
`claw-shared-access-organization/elm-quiz-monorepo` and
`gods-academy-organization/gods-monorepo` (branch `claw-phase`).

Installed from this clone (`node packages/qol-mini/dist/cli.js`), lock `ref: 0.2.0`,
**uncommitted in each repo**, `skills check` up to date, the repo's own `vp check` passing:

| Repo | Managed | Local skill kept beside it | Ignore entries |
|---|---|---|---|
| seed-pixi-typescript | `vp` | `vp-local` | `vite.config.ts` fmt + lint |
| elm-quiz-monorepo | `vp` | `vp-local` | `vite.config.ts` fmt + lint |
| butterfly-gpt, vp-monorepo-butterfly-gpt | `vp`, `datastar` | `vp-local`, `datastar-cqrs` (five facts corrected) | `vite.config.ts`, `.oxlintrc.json` |
| threejs-character-generator | `vp` | `vp-local` + `references/ops-traps.md` | `vite.config.ts` fmt + lint |
| tcg-look | `vp` | `vp-local` | `vite.config.ts` fmt + lint |
| nats_4_noobs | `datastar` (replaces its copy) | none | no formatter at the root |
| ultralight-carousel-via-sse | `datastar` | `datastar-wordpress` (one fact corrected) | PHPCS reads PHP only |
| gods-monorepo | `css-modern` updated to 0.2.0, four conflicts resolved | its repo note stays in the file: `check` says modified | Prettier + ESLint, committed `b3a4e7d8` |

`vp check` in tcg-look reports seven TypeScript errors in `apps/animator`, present before.

- What is specific to a repo sits in a local skill beside the managed one (`vp-local`), so
  the managed file is never edited.
- The other local skills of those repos still declare `globs`, which Claude Code ignores; the
  field is `paths`. Only the files touched during the rollout were changed.
- wordpress-theme-st-jo is untouched: it keeps its own `css-modern`.
