//! End-to-end tests in a container whose whole filesystem is the fixture.
//!
//! A temporary directory cannot test `/CLAUDE.md` or `$HOME/CLAUDE.md`: its parent
//! directories are the host's. Each test here builds a `FROM scratch` image (no base image
//! to pull) holding only the static binary and a fixture tree copied to `/`, with
//! `HOME=/home/dev` and the repository at `/home/dev/work/repo`, then runs the gate in it.
//!
//! Ignored by plain `cargo test`; `cargo xtask e2e` (part of `cargo xtask check`) builds the
//! static binary, then runs them. Needs docker.
#![cfg(test)]
#![expect(
    clippy::disallowed_methods,
    reason = "tests build image contexts on disk and run docker"
)]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const REPO: &str = "home/dev/work/repo";
const HANDOFF: &str = "> Session handoff: read `TODO.md` first.\n\n# Rules\n";

fn static_binary() -> PathBuf {
    let binary = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../target/x86_64-unknown-linux-musl/release/agents-md-chkr");
    assert!(
        binary.is_file(),
        "no static binary at {}: run `cargo xtask e2e`",
        binary.display()
    );
    binary
}

/// What one container run printed, and its exit status.
struct Run {
    code: Option<i32>,
    stdout: String,
}

/// An image context: the static binary, a healthy repository, and `files`, all under `/`.
fn context(files: &[(&str, &str)]) -> tempfile::TempDir {
    let context = tempfile::tempdir().unwrap();
    fs::copy(static_binary(), context.path().join("agents-md-chkr")).unwrap();
    let healthy = [
        (format!("{REPO}/AGENTS.md"), HANDOFF),
        (format!("{REPO}/TODO.md"), "# TODO\n"),
        (format!("{REPO}/.claude/skills/kaizen/SKILL.md"), "x"),
    ];
    let fixtures = files.iter().map(|(path, text)| ((*path).to_owned(), *text));
    for (path, text) in healthy.into_iter().chain(fixtures) {
        let target = context.path().join("root").join(path);
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::write(target, text).unwrap();
    }
    fs::write(
        context.path().join("Dockerfile"),
        format!(
            "FROM scratch\n\
             COPY agents-md-chkr /usr/bin/agents-md-chkr\n\
             COPY root/ /\n\
             ENV HOME=/home/dev\n\
             WORKDIR /{REPO}\n\
             ENTRYPOINT [\"/usr/bin/agents-md-chkr\"]\n"
        ),
    )
    .unwrap();
    context
}

/// Builds the image for `files`, runs `agents-md-chkr <args>` in it, and removes the image.
fn run_in_container(files: &[(&str, &str)], args: &[&str]) -> Run {
    let context = context(files);
    let build = Command::new("docker")
        .args(["build", "--quiet"])
        .arg(context.path())
        .output()
        .expect("docker is required: `cargo xtask e2e`");
    assert!(
        build.status.success(),
        "{}",
        String::from_utf8_lossy(&build.stderr)
    );
    let image = String::from_utf8(build.stdout).unwrap().trim().to_owned();
    let output = Command::new("docker")
        .args(["run", "--rm", "--network", "none", &image])
        .args(args)
        .output()
        .unwrap();
    Command::new("docker")
        .args(["rmi", "--force", &image])
        .output()
        .unwrap();
    Run {
        code: output.status.code(),
        stdout: String::from_utf8(output.stdout).unwrap(),
    }
}

fn line<'a>(run: &'a Run, start: &str) -> Option<&'a str> {
    run.stdout.lines().find(|line| line.starts_with(start))
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn a_clean_machine_passes_every_probe_including_user_scope() {
    let run = run_in_container(&[], &[]);
    assert_eq!(run.code, Some(0), "{}", run.stdout);
    assert!(line(&run, "[pass] AM14 (user scope) ..: no CLAUDE.md above").is_some());
    assert!(line(&run, "[pass] AM15 (user scope) ..: no AGENTS.md above").is_some());
    assert!(
        run.stdout
            .ends_with("agents-md gate passed: 0 fail, 0 warn, 17 pass, 4 n/a\n")
    );
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn a_claude_md_at_the_filesystem_root_is_found_and_never_fails_the_gate() {
    let run = run_in_container(&[("CLAUDE.md", "# machine-wide rules\n")], &[]);
    assert_eq!(run.code, Some(0), "{}", run.stdout);
    let found = line(&run, "[warn] AM14 (user scope) /CLAUDE.md:").unwrap();
    assert!(found.contains("skips every AGENTS.md, this repository's included"));
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn home_files_are_judged_and_user_memory_is_exempt() {
    let run = run_in_container(
        &[
            ("home/dev/.claude/CLAUDE.md", "# user memory\n"),
            ("home/dev/CLAUDE.md", "# stray\n"),
            ("home/dev/CLAUDE.local.md", "# stray, local\n"),
            ("home/AGENTS.md", "# above home\n"),
            ("home/dev/work/.claude/AGENTS.md", "# workspace\n"),
            (".claude/CLAUDE.md", "# root dot-claude\n"),
        ],
        &[],
    );
    assert_eq!(run.code, Some(0), "{}", run.stdout);
    for path in [
        "/home/dev/CLAUDE.md",
        "/home/dev/CLAUDE.local.md",
        "/.claude/CLAUDE.md",
    ] {
        assert!(
            line(&run, &format!("[warn] AM14 (user scope) {path}:")).is_some(),
            "{path}"
        );
    }
    assert!(!run.stdout.contains("/home/dev/.claude/CLAUDE.md"));
    assert!(line(&run, "[warn] AM15 (user scope) /home/AGENTS.md:").is_some());
    assert!(
        line(
            &run,
            "[warn] AM15 (user scope) /home/dev/work/.claude/AGENTS.md:"
        )
        .is_some()
    );
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn a_managed_claude_md_is_reported_in_user_scope() {
    let run = run_in_container(&[("etc/claude-code/CLAUDE.md", "# org policy\n")], &[]);
    assert_eq!(run.code, Some(0), "{}", run.stdout);
    let found = line(&run, "[warn] AM21 (user scope) /etc/claude-code/CLAUDE.md:").unwrap();
    assert!(found.contains("OpenCode never reads it"), "{found}");
    let clean = run_in_container(&[], &[]);
    assert!(line(&clean, "[pass] AM21 (user scope) /etc/claude-code:").is_some());
    let repo_only = run_in_container(
        &[("etc/claude-code/CLAUDE.md", "# org\n")],
        &["--repo-only"],
    );
    assert!(
        line(
            &repo_only,
            "[n/a] AM21 (user scope) /etc/claude-code: skipped"
        )
        .is_some()
    );
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn repo_only_ignores_the_machine() {
    let run = run_in_container(&[("CLAUDE.md", "# machine-wide\n")], &["--repo-only"]);
    assert_eq!(run.code, Some(0), "{}", run.stdout);
    assert!(line(&run, "[warn] AM14").is_none(), "{}", run.stdout);
    assert!(line(&run, "[n/a] AM14 (user scope) ..: skipped: --repo-only").is_some());
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn a_repository_failure_sets_the_exit_status_inside_the_container() {
    let run = run_in_container(
        &[
            (&format!("{REPO}/pkg/AGENTS.md"), "# pkg\n"),
            (&format!("{REPO}/pkg/CLAUDE.md"), "# pkg, Claude only\n"),
            ("CLAUDE.md", "# machine-wide\n"),
        ],
        &[],
    );
    assert_eq!(run.code, Some(1), "{}", run.stdout);
    assert!(line(&run, "[fail] AM09 pkg/CLAUDE.md:").is_some());
    assert!(line(&run, "[warn] AM14 (user scope) /CLAUDE.md:").is_some());
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn an_explicit_repository_path_resolves_from_the_root() {
    let run = run_in_container(&[], &["--repo-only", "/home/dev/work/repo"]);
    assert_eq!(run.code, Some(0), "{}", run.stdout);
    let missing = run_in_container(&[], &["/nowhere"]);
    assert_eq!(missing.code, Some(2));
}
