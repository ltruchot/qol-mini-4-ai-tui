# Testing a gate

Every probe behavior gets a unit test and a real-tree test. Behavior that depends on `/`
or a real `$HOME` also gets a container test. Copy the test helpers from
`crates/agents-md-chkr/tests/`.

Fast loop while building, full gate only to commit:

```sh
cargo check --offline -p <id>-chkr        # once: adds the new member to Cargo.lock
cargo test -p <id>-chkr                   # unit and real-tree tests, seconds
cargo xtask e2e                           # container tests
cargo xtask check                         # every gate, before each commit
```

The `cargo check --offline` line works while the gate uses only workspace crates. A new
external crate meets the ADR 0007 admission criteria first, then enters `Cargo.lock` through
a plain `cargo check`.

| Level | Where | Pattern |
|---|---|---|
| Unit | next to each probe | the probe on an in-memory `Snapshot`; every verdict; every budget edge (`N`, `N + 1`) |
| Real tree | `tests/cli.rs` | one `tempfile` tree per case through the binary with `assert_cmd`; exit statuses 0, 1, 2 |
| Container | `tests/container.rs`, `#[ignore]` | a `FROM scratch` image whose whole filesystem is the fixture, `HOME=/home/dev`, the repository at `/home/dev/work/repo`, `--network none` |

Real-tree cases:

- Run repository cases with `--repo-only`; otherwise the host's parent directories leak
  into the output.
- Keep one golden test: the full output of a healthy repository, compared exactly.
- User-scope cases build the parent directories and a fake `HOME` inside the tempdir and
  assert only on those paths.

Containers:

- Add the crate to `CONTAINER_GATES` in `crates/xtask/src/plan.rs`, and the array length
  in its type: `e2e()`, `wasm()` and `wasm_lints()` read it. `e2e()` builds the static
  binary (`--target` `STATIC_TARGET`, `-p <id>-chkr`), then runs
  `cargo test -p <id>-chkr --test container -- --ignored`. `check` runs `e2e()`: raise the
  step count in `check_runs_static_gates_before_coverage` by 2.
- The image helper reads the binary from
  `target/x86_64-unknown-linux-musl/release/<id>-chkr`.
