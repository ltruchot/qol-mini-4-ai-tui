//! End-to-end tests in a container whose whole filesystem is the fixture.
//!
//! A temporary directory cannot test `/.claude/skills` or a real `$HOME/.claude/skills`: its
//! parent directories are the host's. Each test here builds a `FROM scratch` image (no base
//! image to pull) holding only the static binary and a fixture tree copied to `/`, with
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

fn skill(name: &str) -> String {
    format!(
        "---\nname: {name}\ndescription: Does {name}. Use when asked to {name}.\n---\n# {name}\n"
    )
}

fn static_binary() -> PathBuf {
    let binary = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../target/x86_64-unknown-linux-musl/release/skills-chkr");
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

/// An image context: the static binary, a repository with one healthy skill, and `files`,
/// all under `/`.
fn context(files: &[(&str, String)]) -> tempfile::TempDir {
    let context = tempfile::tempdir().unwrap();
    fs::copy(static_binary(), context.path().join("skills-chkr")).unwrap();
    let healthy = [(
        format!("{REPO}/.claude/skills/deploy/SKILL.md"),
        skill("deploy"),
    )];
    let fixtures = files
        .iter()
        .map(|(path, text)| ((*path).to_owned(), text.clone()));
    for (path, text) in healthy.into_iter().chain(fixtures) {
        let target = context.path().join("root").join(path);
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::write(target, text).unwrap();
    }
    fs::write(
        context.path().join("Dockerfile"),
        format!(
            "FROM scratch\n\
             COPY skills-chkr /usr/bin/skills-chkr\n\
             COPY root/ /\n\
             ENV HOME=/home/dev\n\
             WORKDIR /{REPO}\n\
             ENTRYPOINT [\"/usr/bin/skills-chkr\"]\n"
        ),
    )
    .unwrap();
    context
}

/// Builds the image for `files`, runs `skills-chkr <args>` in it, and removes the image.
fn run_in_container(files: &[(&str, String)], args: &[&str]) -> Run {
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
    assert!(
        line(&run, "[pass] SK14 (user scope) ..:").is_some(),
        "{}",
        run.stdout
    );
    assert!(
        line(&run, "[pass] SK15 (user scope) ..:").is_some(),
        "{}",
        run.stdout
    );
    assert!(
        run.stdout
            .ends_with("skills gate passed: 0 fail, 0 warn, 15 pass, 0 n/a\n"),
        "{}",
        run.stdout
    );
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn skill_roots_at_the_filesystem_root_are_found_and_never_fail_the_gate() {
    let run = run_in_container(
        &[
            (".claude/skills/machine/SKILL.md", skill("machine")),
            (".opencode/skill/oc/SKILL.md", skill("oc")),
        ],
        &[],
    );
    assert_eq!(run.code, Some(0), "{}", run.stdout);
    let found = line(&run, "[warn] SK14 (user scope) /.claude/skills:").unwrap();
    assert!(found.contains("OpenCode loads these skills in every session here (machine)"));
    assert!(line(&run, "[warn] SK14 (user scope) /.opencode/skill:").is_some());
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn home_roots_are_judged_and_the_personal_claude_root_is_exempt() {
    let run = run_in_container(
        &[
            ("home/dev/.claude/skills/deploy/SKILL.md", skill("deploy")),
            ("home/dev/.claude/skills/notes/SKILL.md", skill("notes")),
            ("home/dev/.agents/skills/other/SKILL.md", skill("other")),
            ("home/dev/.config/opencode/skills/oc/SKILL.md", skill("oc")),
            ("home/dev/work/.agents/skills/team/SKILL.md", skill("team")),
        ],
        &[],
    );
    assert_eq!(run.code, Some(0), "{}", run.stdout);
    assert!(line(&run, "[warn] SK14 (user scope) /home/dev/.claude/skills:").is_none());
    for (path, says) in [
        (
            "/home/dev/.agents/skills",
            "personal skills only OpenCode loads (other)",
        ),
        (
            "/home/dev/.config/opencode/skills",
            "personal skills only OpenCode loads (oc)",
        ),
        ("/home/dev/work/.agents/skills", "outside the repository"),
    ] {
        let found = line(&run, &format!("[warn] SK14 (user scope) {path}:"));
        assert!(
            found.is_some_and(|text| text.contains(says)),
            "{path}\n{}",
            run.stdout
        );
    }
    let shadow = line(
        &run,
        "[warn] SK15 (user scope) /home/dev/.claude/skills/deploy/SKILL.md:",
    )
    .unwrap();
    assert!(shadow.contains("Claude Code runs this personal copy"));
    assert!(!run.stdout.contains("notes/SKILL.md"));
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn repo_only_ignores_the_machine() {
    let run = run_in_container(
        &[(".agents/skills/machine/SKILL.md", skill("machine"))],
        &["--repo-only"],
    );
    assert_eq!(run.code, Some(0), "{}", run.stdout);
    assert!(line(&run, "[warn] SK14").is_none(), "{}", run.stdout);
    assert!(line(&run, "[n/a] SK14 (user scope) ..: skipped: --repo-only").is_some());
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn a_repository_failure_sets_the_exit_status_inside_the_container() {
    let run = run_in_container(
        &[
            (
                &format!("{REPO}/.claude/skills/bare/SKILL.md"),
                "# no frontmatter\n".to_owned(),
            ),
            (".claude/skills/machine/SKILL.md", skill("machine")),
        ],
        &[],
    );
    assert_eq!(run.code, Some(1), "{}", run.stdout);
    assert!(line(&run, "[fail] SK06 .claude/skills/bare/SKILL.md:").is_some());
    assert!(line(&run, "[warn] SK14 (user scope) /.claude/skills:").is_some());
}

#[test]
#[ignore = "needs docker and the static binary: cargo xtask e2e"]
fn an_explicit_repository_path_resolves_from_the_root() {
    let run = run_in_container(&[], &["--repo-only", "/home/dev/work/repo"]);
    assert_eq!(run.code, Some(0), "{}", run.stdout);
    let missing = run_in_container(&[], &["/nowhere"]);
    assert_eq!(missing.code, Some(2));
}
