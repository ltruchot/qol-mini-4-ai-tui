# Vitals merge: what is left

## State

`main` holds the merge of `code-harness-vitals` (its branch
`fix/agents-md-sources`, commit `9f7085d`; history not imported). Its `test` run is
green: the Rust chain, the TypeScript gates on Linux, macOS and the Node floor, and
`vitals skills` in `install-cycle` on Linux, macOS and Windows. In `test-windows` the
`vitals` tests pass; the thirteen failures there are the POSIX assumptions that job
already reports.

## Left

In `code-harness-vitals`, a README that points to `qol-mini vitals`, then
`gh repo archive ltruchot/code-harness-vitals`. Both need a yes at that moment.

## Known

- Tarball size: the two modules weigh 1.6 MB each, unoptimized for size. `wasm-opt` or
  `opt-level = "z"` is unmeasured.
- A gate run costs about 0.15 s, against 2 ms native.
