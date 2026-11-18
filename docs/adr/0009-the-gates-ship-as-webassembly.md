# 0009 — The gates ship as WebAssembly in the npm package

## Context

- The gates (ADR 0008) are Rust, held to the rules of ADR 0007: workspace lints,
  `unsafe_code = "forbid"`, cargo-deny, 90% branch coverage.
- The kit is one npm package with no runtime dependency (ADR 0001), run with
  `pnpm dlx qol-mini` or `npx qol-mini` on Linux, macOS, WSL and Windows.
- A native binary per platform means one npm package per target, a cross-compilation
  matrix, and a publish right for each package.
- Rust has no stable ABI across platforms; `wasm32-wasip1` is one artifact that runs
  wherever Node runs.
- `node:wasi` is classed experimental, warns on load, and on Windows cannot list a
  directory: `fd_readdir` answers "Function not implemented".
- WASI defines no working directory, no drive letter and no home directory.
- The gates import eighteen preview1 calls, all of them reads, plus stdout and stderr.

## Decision

- The gates are built for `wasm32-wasip1` (`cargo xtask wasm`) and shipped in the
  package under `wasm/`, one module per gate. The Rust sources, lints and tests are the
  native ones: nothing is forked for the target.
- `qol-mini vitals [agents-md|skills] [path]` runs them on a WASI host written in
  TypeScript (`src/vitals/wasi/`), bundled like the rest of the CLI: those eighteen
  calls over `node:fs`, read-only. `node:wasi` is not used.
- TypeScript launches; Rust judges. No probe is written in TypeScript.
- The host preopens the root of the repository's drive as `/` and passes absolute guest
  paths. It names the home directory through `HOME`, which `vitals-utils` reads under
  `cfg(target_os = "wasi")`.
- The host refuses any open that would create or truncate, and holds no write call
  for a file.
- The tree walk is sorted in `vitals-utils`: the order a directory lists its entries in
  depends on the filesystem and on the host, and a gate's output does not.
- The exit status is the worst gate's: 0, 1 when a probe fails, 2 when the repository
  cannot be read.
- `cargo xtask check` lints the gates for `wasm32-wasip1` too: code under that `cfg`
  compiles nowhere else.

## Consequences

- One tarball for every platform; packcheck fails when a module is missing from it.
- Building the package needs the Rust toolchain of `mise.toml`: CI and the release job
  install it, and the release job builds the modules from the tagged commit.
- A gate run costs a Node start and a module compile, about 0.15 s against 2 ms native.
- An OS error is worded by WASI: `os error 44` where the native binary says `os error 2`.
- A home directory on another drive than the repository is out of reach: the user-scope
  probes run without it.
- The host is code this repository owns: a call a later gate imports must be added to
  it, and the module fails to instantiate until it is.
- The host is checked against the native binaries: same stdout and exit status on the
  same trees. The test suite runs the modules on the Node floor of `engines` and on
  the current version, on Linux, macOS and Windows.
- The native binaries remain what `cargo test` and the container tests run.
