//! Pure task planning: which commands each task runs, in order. Nothing here spawns a process.

/// Nightly toolchain used only for branch coverage (`--branch` is nightly-only).
/// Pinned to a dated build: nightlies skip the beta and pre-release soak (ADR 3).
pub(crate) const NIGHTLY: &str = "nightly-2026-11-09";

/// Target of the static binary that the container end-to-end tests run on an empty root.
/// Installed from `mise.toml`; `tests/container.rs` reads the binary from its release dir.
pub(crate) const STATIC_TARGET: &str = "x86_64-unknown-linux-musl";

/// Target of the gates the npm package ships: `qol-mini vitals` runs them under WASI.
pub(crate) const WASM_TARGET: &str = "wasm32-wasip1";

/// Minimum branch coverage, in percent, for the coverage gate.
pub(crate) const MIN_BRANCH_COVERAGE: f64 = 90.0;

/// A task the user can run as `cargo xtask <task>`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Task {
    /// Every gate: format, lints, tests, docs, supply chain, container tests, branch coverage.
    Check,
    /// End-to-end tests in containers whose filesystem root holds the fixtures (needs docker).
    E2e,
    /// Branch coverage with reports (`lcov.info`, `coverage/html`) and the gate.
    Coverage,
    /// Install the coverage nightly. Every other tool comes from `mise.toml`.
    Setup,
    /// Release builds of the gates for [`WASM_TARGET`]; `scripts/wasm.ts` copies them into the package.
    Wasm,
}

/// What to do with a command once it exits successfully.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Expect {
    /// Exit status zero is enough.
    Success,
    /// Capture stdout as a cargo-llvm-cov JSON summary and apply the branch gate.
    BranchGate,
}

/// One command of a task.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Step {
    /// Program to run, resolved through `PATH`.
    pub(crate) program: &'static str,
    /// Arguments, in order.
    pub(crate) args: Vec<String>,
    /// Extra environment variables.
    pub(crate) env: Vec<(&'static str, &'static str)>,
    /// How the step is judged.
    pub(crate) expect: Expect,
}

impl Step {
    fn new(program: &'static str, args: &[&str]) -> Self {
        Self {
            program,
            args: args.iter().map(ToString::to_string).collect(),
            env: Vec::new(),
            expect: Expect::Success,
        }
    }

    fn cargo(args: &[&str]) -> Self {
        Self::new("cargo", args)
    }

    fn nightly_cargo(args: &[&str]) -> Self {
        let toolchain = format!("+{NIGHTLY}");
        let all = core::iter::once(toolchain.as_str()).chain(args.iter().copied());
        Self::new("cargo", &all.collect::<Vec<_>>())
    }

    fn with_env(self, key: &'static str, value: &'static str) -> Self {
        Self {
            env: [self.env, vec![(key, value)]].concat(),
            ..self
        }
    }

    fn gated(self) -> Self {
        Self {
            expect: Expect::BranchGate,
            ..self
        }
    }
}

/// The commands `task` runs, in order. Execution stops at the first failure.
pub(crate) fn steps(task: Task) -> Vec<Step> {
    match task {
        Task::Check => [static_gates(), e2e(), coverage()].concat(),
        Task::E2e => e2e(),
        Task::Coverage => coverage(),
        Task::Setup => vec![nightly_toolchain()],
        Task::Wasm => vec![wasm()],
    }
}

fn static_gates() -> Vec<Step> {
    vec![
        Step::cargo(&["fmt", "--all", "--check"]),
        Step::cargo(&[
            "clippy",
            "--workspace",
            "--all-targets",
            "--locked",
            "--",
            "-D",
            "warnings",
        ]),
        wasm_lints(),
        Step::cargo(&["test", "--workspace", "--locked"]),
        Step::cargo(&["doc", "--workspace", "--no-deps", "--locked"])
            .with_env("RUSTDOCFLAGS", "-D warnings"),
        Step::cargo(&["deny", "check"]),
    ]
}

/// Lints on the shipped target: code under `cfg(target_os = "wasi")` compiles nowhere else.
fn wasm_lints() -> Step {
    let gates = CONTAINER_GATES.iter().flat_map(|gate| ["-p", gate]);
    let head = ["clippy", "--locked", "--target", WASM_TARGET];
    let tail = ["--", "-D", "warnings"];
    Step::cargo(
        &head
            .into_iter()
            .chain(gates)
            .chain(tail)
            .collect::<Vec<_>>(),
    )
}

fn wasm() -> Step {
    let gates = CONTAINER_GATES.iter().flat_map(|gate| ["-p", gate]);
    let head = ["build", "--release", "--locked", "--target", WASM_TARGET];
    Step::cargo(&head.into_iter().chain(gates).collect::<Vec<_>>())
}

/// Gate binaries with container end-to-end tests (`tests/container.rs`).
pub(crate) const CONTAINER_GATES: [&str; 2] = ["agents-md-chkr", "skills-chkr"];

fn e2e() -> Vec<Step> {
    CONTAINER_GATES
        .iter()
        .flat_map(|gate| {
            [
                Step::cargo(&[
                    "build",
                    "--release",
                    "--locked",
                    "--target",
                    STATIC_TARGET,
                    "-p",
                    gate,
                ]),
                Step::cargo(&[
                    "test",
                    "--locked",
                    "-p",
                    gate,
                    "--test",
                    "container",
                    "--",
                    "--ignored",
                ]),
            ]
        })
        .collect()
}

fn coverage() -> Vec<Step> {
    let scope = ["--workspace", "--exclude", "xtask"];
    vec![
        Step::nightly_cargo(&["llvm-cov", "clean", "--workspace"]),
        Step::nightly_cargo(
            &[
                &["llvm-cov", "--branch", "--locked", "--no-report"][..],
                &scope,
            ]
            .concat(),
        ),
        Step::nightly_cargo(&[
            "llvm-cov",
            "report",
            "--branch",
            "--lcov",
            "--output-path",
            "lcov.info",
        ]),
        Step::nightly_cargo(&[
            "llvm-cov",
            "report",
            "--branch",
            "--html",
            "--output-dir",
            "coverage",
        ]),
        Step::nightly_cargo(&["llvm-cov", "report", "--branch", "--summary-only"]),
        Step::nightly_cargo(&["llvm-cov", "report", "--branch", "--json", "--summary-only"])
            .gated(),
    ]
}

fn nightly_toolchain() -> Step {
    Step::new(
        "rustup",
        &[
            "toolchain",
            "install",
            NIGHTLY,
            "--profile",
            "minimal",
            "--component",
            "llvm-tools-preview",
        ],
    )
}

#[cfg(test)]
mod tests {
    use super::{CONTAINER_GATES, Expect, NIGHTLY, STATIC_TARGET, Step, Task, WASM_TARGET, steps};

    fn command_lines(task: Task) -> Vec<String> {
        steps(task)
            .iter()
            .map(|step| format!("{} {}", step.program, step.args.join(" ")))
            .collect()
    }

    #[test]
    fn check_runs_static_gates_before_coverage() {
        let lines = command_lines(Task::Check);
        assert_eq!(
            lines.first().map(String::as_str),
            Some("cargo fmt --all --check")
        );
        assert!(lines.iter().any(|line| line.ends_with("-- -D warnings")));
        assert!(lines.iter().any(|line| line == "cargo deny check"));
        assert_eq!(lines.len(), 16);
    }

    #[test]
    fn e2e_builds_each_static_binary_then_runs_its_ignored_container_tests() {
        let lines = command_lines(Task::E2e);
        assert_eq!(lines.len(), 2 * CONTAINER_GATES.len());
        for (pair, gate) in lines.chunks(2).zip(CONTAINER_GATES) {
            assert!(pair[0].contains(&format!("--target {STATIC_TARGET}")));
            assert!(pair[0].ends_with(&format!("-p {gate}")));
            assert!(pair[1].ends_with(&format!("-p {gate} --test container -- --ignored")));
        }
        let check = command_lines(Task::Check);
        let deny = check
            .iter()
            .position(|line| line == "cargo deny check")
            .unwrap();
        assert_eq!(check[deny + 1], lines[0]);
    }

    #[test]
    fn coverage_ends_with_the_branch_gate_on_the_pinned_nightly() {
        let all = steps(Task::Coverage);
        let gate = all.last().unwrap();
        assert_eq!(gate.expect, Expect::BranchGate);
        assert_eq!(gate.args.first().unwrap(), &format!("+{NIGHTLY}"));
        assert!(
            all.iter()
                .rev()
                .skip(1)
                .all(|step| step.expect == Expect::Success)
        );
        assert!(
            all.iter()
                .any(|step| step.args.contains(&"xtask".to_owned()))
        );
    }

    #[test]
    fn docs_deny_warnings_through_the_environment() {
        let docs: Vec<Step> = steps(Task::Check)
            .into_iter()
            .filter(|step| step.args.first().is_some_and(|arg| arg == "doc"))
            .collect();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].env, vec![("RUSTDOCFLAGS", "-D warnings")]);
    }

    #[test]
    fn setup_installs_only_the_coverage_nightly() {
        let setup = steps(Task::Setup);
        assert_eq!(setup.len(), 1);
        assert_eq!(setup[0].program, "rustup");
        assert!(setup[0].args.contains(&NIGHTLY.to_owned()));
    }

    #[test]
    fn wasm_builds_both_gates_for_the_shipped_target_and_check_lints_it() {
        let build = command_lines(Task::Wasm);
        assert_eq!(build.len(), 1);
        let head = format!("cargo build --release --locked --target {WASM_TARGET}");
        assert!(build[0].starts_with(&head));
        for gate in CONTAINER_GATES {
            assert!(build[0].contains(&format!("-p {gate}")));
        }
        let lint = format!("cargo clippy --locked --target {WASM_TARGET}");
        let check = command_lines(Task::Check);
        assert!(check.iter().any(|line| line.starts_with(&lint)));
    }
}
