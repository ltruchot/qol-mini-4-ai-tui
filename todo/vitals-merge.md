# Vitals merge: what is left

## State

`main` holds the merge of `code-harness-vitals` (its branch
`fix/agents-md-sources`, commit `9f7085d`; history not imported). That repository is archived on
GitHub and its README points here. The `test` run of `main` is green: the Rust chain, the TypeScript gates on Linux, macOS and the Node floor, and
`vitals skills` in `install-cycle` on Linux, macOS and Windows. In `test-windows` the
`vitals` tests pass; the thirteen failures there are the POSIX assumptions that job
already reports.

## Left

1. `qol-mini@0.7.0` stays on npm with a `skills-review` that fails to load. On a yes,
   from `packages/qol-mini`: `npm deprecate qol-mini@0.7.0 "skills-review fails to load, use 0.7.1"`.
2. The review skills under OpenCode: never run. Under `claude -p`, one run of
   `skills-review` installed from npm 0.7.1 loaded and was refused its probe command by
   the allowlist (`Bash(npx qol-mini:*)`); the same text installed from the clone ran it.

## Known

- Tarball size: the two modules weigh 1.6 MB each, unoptimized for size. `wasm-opt` or
  `opt-level = "z"` is unmeasured.
- A gate run costs about 0.15 s, against 2 ms native.
