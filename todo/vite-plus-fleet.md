# Vite+ fleet: one `vp` skill, Vite+ 1.5.0, Node 26.13.0, pnpm 12.16.1

The repos are listed in `.local/repos.json` (machine-local, ignored by git).

## State

Every repo of `.local/repos.json`: Vite+ 1.5.0, `vp env pin node@26.13.0 pnpm@12.16.1`,
`pmOnFail: ignore`, `runtimeOnFail: ignore`, `minimumReleaseAge: 4320`, the managed `vp`
skill of `qol-mini@0.6.0` (published), and a `vp-local` beside it where the repo has its own
facts. unary-js has no mise left.

## Left

1. **From 2026-11-07 05:00 UTC**: every exact version under the comment "Exact versions of the
   Vite+ 1.5.0 toolchain" (French in some repos) in `minimumReleaseAgeExclude` is three days
   old. Remove those lines and that comment in every repo of `.local/repos.json`, then
   `vp install --frozen-lockfile` must pass. Before that date it fails: pnpm 12 checks the
   lockfile against the policy. Other exclusions stay (`@opencode/schema@2.1.2` here, the
   name-wide toolchain list of the Elm monorepo, which documents its own reason).
   boardgame-helper also lists `@anthropic-ai/sdk@1.4.0`, three days old on 2026-11-05 19:20 UTC.
2. unary-js: `feat/maieutics` (the maieutics package and the upgrade) is pushed; its PR into
   `main` is not opened, and its CI runs on `main` and pull requests only.
3. Seen, not ours to fix: in tcg-look, `apps/viewer` misses `DOM.Iterable` (5 × TS2488 at build)
   and `apps/animator` has 7 TypeScript errors; in both Three.js repos, `ng test` finds no test
   in `apps/animator`; sone-anniv's `engines.node` (`>=22.12.0`) admits runtimes Vitest 5 does
   not support.
4. This machine: `~/.config/mise/config.toml` lists no tool; the inactive mise Node installs
   still put `node` and `pnpm` shims ahead of `~/.vite-plus/bin`. They fall through to Vite+,
   and `vp env doctor` flags them. `mise uninstall node --all` clears them, if no other
   project needs a mise Node.
