//! `cargo xtask`: workspace automation. Planning is pure ([`plan`], [`coverage`]); this
//! module is the boundary that spawns the planned commands and reports to the terminal.
#![expect(
    clippy::disallowed_methods,
    clippy::print_stdout,
    clippy::print_stderr,
    reason = "boundary: spawns processes and writes to the terminal"
)]

mod coverage;
mod plan;

use std::process::{Command, ExitCode, ExitStatus};

use clap::{Parser, Subcommand};

use crate::plan::{Expect, MIN_BRANCH_COVERAGE, Step, Task};

/// Workspace automation for the qol-mini vitals gates.
#[derive(Debug, Parser)]
#[command(about)]
struct Cli {
    #[command(subcommand)]
    command: Cmd,
}

#[derive(Debug, Subcommand)]
enum Cmd {
    /// Run every gate: fmt, clippy, tests, docs, cargo-deny, container tests, branch coverage.
    Check,
    /// Run the container end-to-end tests (needs docker).
    E2e,
    /// Measure branch coverage, write `lcov.info` and `coverage/html/`, apply the gate.
    Cov,
    /// Install the coverage nightly (run `mise install` first for everything else).
    Setup,
    /// Build the gates for `wasm32-wasip1`, the form the npm package ships.
    Wasm,
}

impl From<Cmd> for Task {
    fn from(command: Cmd) -> Self {
        match command {
            Cmd::Check => Self::Check,
            Cmd::E2e => Self::E2e,
            Cmd::Cov => Self::Coverage,
            Cmd::Setup => Self::Setup,
            Cmd::Wasm => Self::Wasm,
        }
    }
}

/// Why a step failed.
#[derive(Debug, thiserror::Error)]
enum StepError {
    #[error("cannot start `{program}`")]
    Spawn {
        program: &'static str,
        #[source]
        source: std::io::Error,
    },
    #[error("`{command}` failed ({status})")]
    Failed { command: String, status: ExitStatus },
    #[error("coverage summary is not UTF-8")]
    Utf8(#[from] std::string::FromUtf8Error),
    #[error(transparent)]
    Gate(#[from] coverage::GateError),
}

fn main() -> ExitCode {
    let task = Task::from(Cli::parse().command);
    match plan::steps(task).iter().try_for_each(run) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("xtask: {}", chain(&error));
            ExitCode::FAILURE
        }
    }
}

fn run(step: &Step) -> Result<(), StepError> {
    let command = format!("{} {}", step.program, step.args.join(" "));
    eprintln!("xtask: {command}");
    let mut process = Command::new(step.program);
    process.args(&step.args).envs(step.env.iter().copied());
    let spawn = |source| StepError::Spawn {
        program: step.program,
        source,
    };
    match step.expect {
        Expect::Success => {
            let status = process.status().map_err(spawn)?;
            succeeded(status, command)
        }
        Expect::BranchGate => {
            let output = process.output().map_err(spawn)?;
            succeeded(output.status, command)?;
            let percent = coverage::gate(&String::from_utf8(output.stdout)?, MIN_BRANCH_COVERAGE)?;
            println!("xtask: branch coverage {percent:.2}% (minimum {MIN_BRANCH_COVERAGE}%)");
            Ok(())
        }
    }
}

fn succeeded(status: ExitStatus, command: String) -> Result<(), StepError> {
    if status.success() {
        Ok(())
    } else {
        Err(StepError::Failed { command, status })
    }
}

fn chain(error: &dyn std::error::Error) -> String {
    core::iter::successors(Some(error), |current| current.source())
        .map(ToString::to_string)
        .collect::<Vec<_>>()
        .join(": ")
}
