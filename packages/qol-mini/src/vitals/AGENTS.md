# The vitals launcher and its WASI host

Sources: `packages/qol-mini/src/vitals/` and `src/commands/vitals-*.ts`. The probes are
Rust, ruled in `crates/AGENTS.md`.

- The gates read and never write. The WASI host (`src/vitals/wasi/`) refuses an open
  that would create or truncate and holds no write call for a file.
- The host implements the preview1 calls the modules import, and no other. A new
  import fails at instantiation: list them with `WebAssembly.Module.imports` and add
  the call. `node:wasi` is not used: on Windows its `fd_readdir` is not implemented.
- WASI has no working directory, no drive letter, no home directory. The host
  preopens the root of the repository's drive as `/`, passes absolute guest paths
  (`vitals/guest.ts`), and names the home directory through `HOME`, which
  `vitals-utils` reads under `cfg(target_os = "wasi")`. A home directory on another
  drive is not named: the user-scope probes run without it.
- A change to the host is checked against the native binaries: same stdout and exit
  status on the same trees, both gates, with and without `--repo-only`. An OS error
  differs by its number only (`os error 44` under WASI, `2` native).
- User-scope probes read the parent directories and the home directory of the
  machine: tests assert on `--repo-only` output, or on paths they built.
- `vitals --fix` runs a finding's command only when its first word is `harmonize` or
  `skills`. Why: `docs/adr/0010-a-finding-names-the-command-that-fixes-it.md`.
