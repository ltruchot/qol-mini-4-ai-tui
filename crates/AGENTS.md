# Rust sources of the vitals gates

- Sources: `crates/agents-md-chkr`, `crates/skills-chkr` (one binary per gate),
  `crates/vitals-utils` (what two gates need), `crates/xtask` (automation). Lints,
  versions and metadata are inherited from the root `Cargo.toml`. Details:
  `docs/adr/0007-the-gates-are-strict-rust.md`.
- `mise.toml` is the only place for Rust and cargo tool versions. No
  `rust-toolchain.toml`, no `.tool-versions`, no `cargo install` step.
- Side effects only in boundary modules, which open with
  `#![expect(clippy::disallowed_methods, reason = "boundary: …")]`; the rest is pure.
- An exemption is `#[expect(lint, reason = "…")]`, scoped narrowly, never `allow`.
  `Cargo.toml` and `clippy.toml` are not relaxed to make a gate pass.
- Test modules carry `#[cfg_attr(coverage_nightly, coverage(off))]`; integration test
  files start with `#![cfg(test)]`.
- Doc comments write CamelCase names in backticks (`` `OpenCode` ``): clippy
  `doc_markdown` rejects them bare.
- Before writing a function or adding a crate, search `crates/vitals-utils/` and the
  crate's own modules. A helper a second gate needs moves to `vitals-utils`.
- A new crate or a bump meets the admission criteria of ADR 0007 and is pinned
  `=x.y.z` in `[workspace.dependencies]`. The 3-day cooldown in `.cargo/config.toml`
  stays; stable toolchains are exempt, nightlies are date-pinned.
- A probe whose fix a `qol-mini` command applies names it with `with_command`: the
  arguments without the repository, set only when the command does what the fix says on
  every repository the finding fires on. A new command gets a test that runs the gate,
  the command, the gate again (ADR 0010).
- A probe's output never depends on listing order: `vitals-utils` sorts the walk.
- The gate's own messages name the binary (`agents-md-chkr: cannot read …`).
- `vp run wasm` builds the modules into the package's `wasm/` directory, gitignored and
  absent from a fresh clone. The test setup does not: a cached `vp run` task filters the
  environment, `RUSTUP_TOOLCHAIN` included, and cargo falls back to another toolchain.
  Run `vp run wasm` after a Rust change, before `vp run -r test`.
- `cargo agents-md-chkr [--repo-only] [PATH]` and `cargo skills-chkr` run a gate
  natively, without the CLI.
