# Vitals merge: what is left

## State

Branch `feat/vitals` holds the merge of `code-harness-vitals` (its branch
`fix/agents-md-sources`, commit `9f7085d`; history not imported). Its `test` run is
green: the Rust chain, the TypeScript gates on Linux, macOS and the Node floor, and
`vitals skills` in `install-cycle` on Linux, macOS and Windows. In `test-windows` the
`vitals` tests pass; the thirteen failures there are the POSIX assumptions that job
already reports.

## Left, in order

1. Merge `feat/vitals` into `main`, then `./install.sh --replace`.
2. Trigger evals for the two bank skills that entered, per AGENTS.md "Skills":
   `scripts.run_eval` with `--num-workers 1`, one scratch project per skill, should and
   should-not queries. They changed in one way only: the command they run is
   `qol-mini vitals <gate>`.
3. Run each review skill once from an installed copy
   (`qol-mini skills install agents-md-review skills-review <repo>`): never done.
4. Version `0.7.0` in `packages/qol-mini/package.json`, tag `v0.7.0`, approve the
   release run. The job needs docker for `cargo xtask check`: the first run tells.
5. After the publish: in `code-harness-vitals`, a README that points to
   `qol-mini vitals`, then `gh repo archive ltruchot/code-harness-vitals`. Both need a
   yes at that moment.

## Known

- Tarball size: the two modules weigh 1.6 MB each, unoptimized for size. `wasm-opt` or
  `opt-level = "z"` is unmeasured.
- A gate run costs about 0.15 s, against 2 ms native.
