# 0007 — The gates are strict Rust

**Date**: 2026-11-13
**Status**: Accepted
**Context**: Resolves the "Stack" open question of ADR 0005. The workspace lives in the
`qol-mini` repository; how the gates reach a user is ADR 0009.

## Implementation Status

| Component                                   | Status     | Location                              |
| ------------------------------------------- | ---------- | ------------------------------------- |
| Cargo workspace, tool versions in mise      | ✅ Done    | `Cargo.toml`, `mise.toml`             |
| Lint, format, complexity, effect policy     | ✅ Done    | `Cargo.toml`, `clippy.toml`, `rustfmt.toml` |
| Supply-chain gate                           | ✅ Done    | `deny.toml`, `Cargo.lock`             |
| 90% branch-coverage gate                    | ✅ Done    | `crates/xtask/src/coverage.rs`               |
| Task runner                                 | ✅ Done    | `crates/xtask/`, `.cargo/config.toml`        |
| Pre-commit hook, CI, Dependabot             | ✅ Done    | `.vite-hooks/`, `.github/`            |
| Native Cargo cooldown (`min-publish-age`)   | ✅ Done    | `.cargo/config.toml`                  |

## Problem

The auditor must ship as a dependable CI tool, so its own codebase has to meet the bar it
will enforce on others. Requirements:

- A monorepo with no special tooling: no Nx, moon, Bazel, or task-runner binaries.
- Language and tool versions managed per repository with mise (`mise.toml`), the
  convention across these repositories.
- Current Rust, with the strictest lint, format, and safety settings available.
- Low complexity, idiomatic Rust, and a functional core: side effects pushed to the
  boundaries, referentially transparent functions everywhere else.
- At least 90% **branch** coverage, enforced, not reported.
- Dependencies that are highly rated, safe, and current, with a **3-day grace period** on
  every update download.
- One simple command to run the app and one to see its test results.

## Decision

### Workspace

- A plain Cargo workspace: `members = ["crates/*"]`, `resolver = "3"`
  (MSRV-aware), shared `[workspace.package]`, `[workspace.dependencies]`, and
  `[workspace.lints]` inherited by every crate with `lints.workspace = true`.
- Every crate lives in `crates/<name>/`: one binary per gate (ADR 0008), the library
  `crates/vitals-utils` shared by the gates, automation in `crates/xtask/` (the cargo-xtask
  pattern: plain Rust, no extra binary). Workspace crates are path entries in
  `[workspace.dependencies]`. Aliases in `.cargo/config.toml`:
  `cargo agents-md-chkr`, `cargo skills-chkr`, `cargo xtask`.
- `Cargo.lock` is committed; every gate runs with `--locked`.

### Toolchain

- `mise.toml` is the single source of tool versions: Rust (latest stable, **1.100.0**,
  profile `minimal` with `clippy` and `rustfmt`, plus the `x86_64-unknown-linux-musl`
  target for the static binary of the container tests), `cargo-deny`, and
  `cargo-llvm-cov`.
  `mise install` installs them all; locally and in CI (`jdx/mise-action`).
- No `rust-toolchain.toml`: mise exports `RUSTUP_TOOLCHAIN`, which rustup ranks above
  that file, so a second version source drifts silently.
- Edition **2024**, `rust-version = "1.100"`.
- Bump rule: adopt a new stable or point release when it ships; keep rustup on its
  default self-update.
- Branch coverage needs nightly, so one dated nightly is pinned for coverage only
  (`nightly-2026-11-09`, constant `NIGHTLY` in `crates/xtask/src/plan.rs`). Everything else runs
  on stable. Bump it together with the stable toolchain.

### Grace period: third-party code only

The 3-day grace period applies to code published on open registries, where a
compromised account or token can ship a malicious version that scanners catch within
days. It does not apply to the official Rust toolchain, which carries its own soak:

- A stable `rustc`/`cargo` spends a six-week cycle on the beta channel, tested by crater
  across the ecosystem. Its final artifacts are then published to `dev-static` about three
  days before release, with a public pre-release testing call. Point releases go through
  the same pre-release step.
- Each rustup release is published to a beta self-update channel (`dev-static`) with a
  public call for testing before promotion to stable.
- Both are built and signed by the Rust project on its own infrastructure, not uploaded
  to an open registry.

Exempt: stable and point releases of `rustc`, `cargo`, `clippy`, and `rustfmt`, plus
rustup itself. Not exempt, because they skip that soak: nightlies (pinned by date
instead), crates, dev tools (`cargo-deny`, `cargo-llvm-cov`), and GitHub Actions.

How the grace period is enforced:

- Crates: `[registry] global-min-publish-age = "3 days"` in `.cargo/config.toml`, the
  native Cargo cooldown (stable since 1.100). Every resolution skips versions published
  in the last 3 days. For an urgent fix, override a single update with
  `CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE=allow cargo update <crate> --precise <version>`.
- Dependabot: `cooldown: default-days: 3` for both `cargo` and `github-actions`.
- CI actions: pinned by full commit SHA to a release at least 3 days old.
- Dev tools: exact versions in `mise.toml`, chosen at least 3 days old.

### Idiomatic Rust first

The code reads as idiomatic Rust 2024 written by a seasoned Rustacean. The functional
style is expressed through Rust's own idioms, never by importing another language's
patterns.

- References: the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/checklist.html),
  the Rust Book, and *Effective Rust*.
- Borrow by default (`&str`, `&Path`, `&[T]`); no gratuitous `clone` or `to_string`.
- Errors: `?` and `let … else` for early returns. Use `Option`/`Result` combinators where
  they read better than `match`. Error types come from `thiserror`: lowercase messages
  without a trailing period, a `source()` chain, and `From` conversions.
- Conversions through `From`, `TryFrom`, `FromStr`. User output through `Display`.
  Derive the common traits (`Debug`, `Clone`, `Copy`, `PartialEq`, `Eq`, `Hash`,
  `Default`) where they make sense.
- Types make invalid states unrepresentable: enums over flags, private fields behind
  getters, `#[must_use]` on values and pure accessors.
- Iterators, `fold`, `sum`, and pattern matching over index loops.
- Naming per RFC 430: no `get_` prefix, and `as_`/`to_`/`into_` by cost.
- Modules: no `mod.rs`, `pub(crate)` inside private modules. Doc comments carry
  `# Errors` and `# Examples`, and doc tests run in `cargo test`.
- Enforced by rustc `rust_2018_idioms` and `rust_2024_compatibility`; clippy `style`,
  `pedantic`, and `nursery`; and rustfmt `style_edition = "2024"`. The API Guidelines
  points no lint covers are checked in review.

### Functional core, effects at the boundaries

- Pure modules hold the logic. A function's output depends only on its inputs.
- A local `mut` inside a function is allowed when it does not escape: referential
  transparency is a property of the function boundary.
- Side effects are confined to boundary modules, and this is enforced, not documented:
  - `clippy.toml` `disallowed-methods` bans filesystem, environment, terminal, process,
    clock, and directory-walk calls workspace-wide.
  - A boundary module opts out with a file-level
    `#![expect(clippy::disallowed_methods, reason = "boundary: …")]`.
  - `allow_attributes` forces `expect` over `allow`, so a stale exemption fails the build.
- `disallowed-types` bans `Cell`, `RefCell`, `Mutex`, and `RwLock`: state flows through
  values, not shared cells.
- Data types are values. In `apps/dummy`, `Counts` is a monoid (`Default` identity,
  associative saturating `Add`, `Sum`), so per-file results fold in any order or grouping.

### Lint and complexity policy

- `unsafe_code = "forbid"`.
- Every lint is set to `warn` in `Cargo.toml`, so editors surface them all; the gates run
  `clippy … -- -D warnings` and `RUSTDOCFLAGS="-D warnings" cargo doc`.
- Cargo lints: `unused_dependencies`.
- Clippy groups `all`, `pedantic`, `nursery`, and `cargo`, plus restriction picks:
  `unwrap_used`, `expect_used`, `panic`, `indexing_slicing`, `arithmetic_side_effects`,
  `as_conversions`, `print_stdout`, `print_stderr`, `exit`, `shadow_unrelated`,
  `wildcard_enum_match_arm`, `mod_module_files`, and others listed in `Cargo.toml`.
- `redundant_pub_crate` is allowed because it contradicts rustc `unreachable_pub`, which
  wins.
- Complexity budget (`clippy.toml`):
  - cognitive complexity 7;
  - nesting depth 3;
  - 40 lines per function;
  - 4 arguments;
  - 1 boolean parameter.

  Clippy has no cyclomatic-complexity lint; cognitive complexity is the closest
  maintained proxy.
- Tests may `unwrap`, `expect`, `panic`, index, and print (`allow-*-in-tests`).
  Integration test crates start with `#![cfg(test)]` so these exemptions apply.

### Tests and coverage

- Unit tests sit next to the code. `proptest` checks algebraic laws: monoid identity,
  associativity, and additivity across newline splits. `assert_cmd` drives the real
  binary against `tempfile` trees.
- Container end-to-end tests (`tests/container.rs`, `#[ignore]` for plain `cargo test`)
  cover what a temporary directory cannot: files at the filesystem root and in a real
  `$HOME`. `cargo xtask e2e` builds the static musl binary, then runs them in `FROM
  scratch` images with no network (ADR 0008, "Tests"). They need docker.
- Gate: at least **90% branch coverage** per run.
  - `cargo-llvm-cov` 0.9.1 provides branch coverage on nightly only (`--branch`) and has
    no `--fail-under-branches`.
  - `xtask` reads `data[0].totals.branches` from the `--json --summary-only` export and
    fails under 90%. A run with zero branches also fails, because it means
    instrumentation was off.
- Test modules carry `#[cfg_attr(coverage_nightly, coverage(off))]`, so the percentage
  measures product code only. `xtask` is excluded from the gate as dev tooling; its pure
  modules are unit-tested.
- Reports: `lcov.info` for the editor gutters, plus `coverage/html/`.

### Supply chain

- `cargo-deny` (`deny.toml`):
  - every advisory kind fails, including unmaintained and yanked crates;
  - license allow-list: Apache-2.0, MIT, Unicode-3.0, Unlicense;
  - wildcard versions are denied;
  - crates.io is the only source.
- Exact version requirements (`=x.y.z`) in `[workspace.dependencies]`.
- Admission criteria for a new crate:
  - millions of downloads, or a maintainer with an established record;
  - a release within the last 12 months;
  - an OSI license on the allow-list;
  - `cargo deny` clean;
  - the version is at least 3 days old.

  The standard library is preferred when the gain is marginal.
- Current set: `clap`, `globset` (rule `paths` patterns; already a dependency of `ignore`),
  `ignore`, `thiserror`, and `serde_json` (xtask); for tests,
  `assert_cmd`, `predicates`, `proptest`, and `tempfile`.

### Commands and gates

| Command                      | What it does                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `cargo agents-md-chkr [PATH]`| Runs the `agents-md` gate's probes (ADR 0008); exit 0 / 1 (a fail) / 2 (error)  |
| `cargo skills-chkr [PATH]`   | Runs the `skills` gate's probes (ADR 0008); exit 0 / 1 (a fail) / 2 (error)     |
| `cargo test`                 | Runs every unit, property, integration, and doc test on stable              |
| `cargo xtask cov`            | Branch coverage on the pinned nightly, reports, and the 90% gate             |
| `cargo xtask e2e`            | Static binary, then the container end-to-end tests (needs docker)            |
| `cargo xtask check`          | fmt → clippy → test → doc → cargo-deny → e2e → coverage; stops at first fail |
| `mise install`               | Installs Rust, cargo-deny, and cargo-llvm-cov from `mise.toml`              |
| `cargo xtask setup`          | Installs the coverage nightly (the only toolchain outside `mise.toml`)      |
| `cargo xtask wasm`           | Release builds of the gates for `wasm32-wasip1` (ADR 0009)                   |

- The pre-commit hook also rejects staged diffs that add an email address.
- CI (`.github/workflows/test.yml`, job `vitals`) installs `mise.toml` with `jdx/mise-action`, then runs
  the same `cargo xtask check` with
  `permissions: contents: read` and SHA-pinned actions.

## Alternatives Rejected

**NO TypeScript probes**: We reject because Rust's type system and lints enforce the
purity and safety rules mechanically. The TypeScript CLI of `qol-mini` launches the gates
and judges nothing (ADR 0009).

**NO Go**: We reject because Go has no equivalent of clippy's pedantic and restriction
lints, no sum types for unrepresentable states, and no compile-time effect boundary.

**NO monorepo tooling (Nx, moon, Bazel, Turborepo) or a task-runner binary (just,
Make)**: We reject because a Cargo workspace plus `xtask` covers builds, tasks, and
dependency sharing; mise, already present for versions, is the only tool to install.

**NO `rust-toolchain.toml` or `cargo install` for tool versions**: We reject because
every version belongs in `mise.toml`; a second source is overridden by mise's
`RUSTUP_TOOLCHAIN` and drifts, and `cargo install` compiles from source and duplicates
the versions in CI.

**NO hook runner (prek, lefthook, pre-commit)**: We reject for now because one shell hook
calling `cargo xtask check` needs no install. Revisit when non-Rust gates join.

**NO cargo-tarpaulin**: We reject because it has no branch coverage.

**NO `cargo-cooldown` wrapper**: We reject because it has too little adoption for a
supply-chain control (about 5k downloads), and Cargo ships the feature natively in 1.100.

**NO grace period on official toolchains**: We reject because stable Rust and rustup
already soak through beta channels and a public pre-release on `dev-static`. A second
delay postpones point releases, which are usually regression or security fixes, without
adding a review step.

## Trade-offs

### Wins

- Every rule in this ADR is checked by a machine: lints, the effect boundary, complexity,
  coverage, licenses, advisories.
- The editor, the hook, and CI run the same gate (`cargo xtask check`).
- Pure cores are trivial to test; property tests cover the algebra, not only examples.

### Costs

- Coverage depends on a pinned nightly that must be bumped with the stable toolchain.
- `xtask` is code to maintain; its tool versions are repeated in the CI workflow.
- The strict lint set occasionally conflicts with itself (`redundant_pub_crate` vs.
  `unreachable_pub`) or needs scoped `expect`s, such as `arithmetic_side_effects` in
  tests.
- Contributors need mise installed; plain rustup alone does not pick the pinned
  version.
- `cargo xtask check` needs a running docker daemon for the
  container tests.
- The toolchain exemption trusts the Rust project's release process; a compromise of
  that pipeline is outside what a cooldown can catch.

## Supersedes

**Standalone repository and static binary as the product** (2026-11-13 → 2026-11-18): the
gates lived in their own repository, with a toolchain smoke-test app (`dummy`), a
`.githooks/` pre-commit running `cargo xtask check`, shared VS Code settings, and a
rejection of any TypeScript CLI. Dropped because the gates and the `qol-mini` kit serve
one need and ship as one npm package (ADR 0009); the pre-commit hook of that repository
runs the TypeScript checks, and CI runs `cargo xtask check`.

**Products in `pkg/<name>/`** (2026-11-13 → 2026-11-14): every crate, binary or library,
lived in `pkg/`. Dropped because the gate model (ADR 0008) ships one binary per gate plus
shared libraries, and the two kinds need separate homes.

**Grace period on toolchains** (2026-11-13, same day): the toolchain was pinned to the
newest stable at least 3 days old (1.99.1, holding back 1.100.0), and rustup
self-updates were disabled in `cargo xtask setup`. Dropped because official toolchains
already ship through beta and pre-release testing (see "Grace period: third-party code
only"); it also delayed the native Cargo cooldown, which needs 1.100.

**Toolchain in `rust-toolchain.toml`, tools via `cargo install`** (2026-11-13, same
day): versions lived in `rust-toolchain.toml`, a gitignored `mise.local.toml`, and
`xtask`/CI constants. Dropped because mise's `RUSTUP_TOOLCHAIN` overrode the file and a
shell kept a stale toolchain; `mise.toml` now holds every version.

## References

- [Rust API Guidelines checklist](https://rust-lang.github.io/api-guidelines/checklist.html)
- [Rust 1.100.0 release notes](https://blog.rust-lang.org/2026/11/12/Rust-1.100.0/)
  — `registry.global-min-publish-age`, `[lints.cargo]`.
- [Cargo issue #15973 — minimum age for dependencies](https://github.com/rust-lang/cargo/issues/15973)
- [Rust Forge — release process](https://forge.rust-lang.org/release/process.html)
  — stable promotion and the `dev-static` pre-release.
- [Rust 1.98.0 pre-release testing](https://blog.rust-lang.org/inside-rust/2026/08/19/1.98.0-prerelease/)
  — example of the public pre-release call.
- [rustup release process](https://rust-lang.github.io/rustup/dev-guide/release-process.html)
  — beta self-update channel before stable.
- [Package managers need to cool down](https://nesbitt.io/2026/03/04/package-managers-need-to-cool-down.html)
  — the threat model cooldowns address.
- [cargo-llvm-cov](https://github.com/taiki-e/cargo-llvm-cov) — branch coverage
  (nightly), report formats.
- [Clippy lint list](https://rust-lang.github.io/rust-clippy/master/index.html)
- [cargo-deny](https://github.com/EmbarkStudios/cargo-deny)
- [Dependabot `cooldown` option](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference#cooldown-)
- [mise — Rust](https://mise.jdx.dev/lang/rust.html) — tool options, `RUSTUP_TOOLCHAIN`
  precedence over `rust-toolchain.toml`.
- [matklad — cargo xtask](https://github.com/matklad/cargo-xtask)
- ADR 0005: `0005-vitals-audits-a-repository-for-coding-agents.md` — product intent.
