//! End-to-end tests of the `skills-chkr` binary on real directory trees.
//!
//! Repository cases run with `--repo-only`, so skill roots in the parent directories of the
//! temporary directory cannot leak in. User-scope cases build the parent directories and a
//! fake home inside the temporary directory, and assert only on those paths. The real
//! filesystem root is exercised in `tests/container.rs`.
#![cfg(test)]
#![expect(
    clippy::disallowed_methods,
    reason = "tests build fixture trees on disk"
)]

use std::fs;
use std::path::{Path, PathBuf};

use assert_cmd::Command;
use predicates::prelude::PredicateBooleanExt;
use predicates::str::contains;
use tempfile::TempDir;

const DEPLOY: &str = "---\nname: deploy\ndescription: Deploy the app to staging. Use when asked to ship or deploy.\n---\n# Deploy\n\n1. Run the checks in [the checklist](references/checklist.md).\n";

fn chkr() -> Command {
    Command::new(assert_cmd::cargo::cargo_bin!("skills-chkr"))
}

fn write(root: &Path, relative: &str, content: &str) {
    let path = root.join(relative);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, content).unwrap();
}

/// A skill named `name` with a valid frontmatter and `body`.
fn skill(name: &str, body: &str) -> String {
    format!("---\nname: {name}\ndescription: Does {name}. Use when asked to {name}.\n---\n{body}")
}

/// A repository with one healthy skill, plus `extra` files.
fn repo(extra: &[(&str, &str)]) -> TempDir {
    let dir = tempfile::tempdir().unwrap();
    write(dir.path(), ".claude/skills/deploy/SKILL.md", DEPLOY);
    write(
        dir.path(),
        ".claude/skills/deploy/references/checklist.md",
        "- tests pass\n",
    );
    for (path, content) in extra {
        write(dir.path(), path, content);
    }
    dir
}

/// Runs the gate on `dir` in repository scope.
fn gate(dir: &TempDir) -> assert_cmd::assert::Assert {
    chkr().arg("--repo-only").arg(dir.path()).assert()
}

#[test]
fn a_healthy_repository_prints_every_probe_and_exits_zero() {
    gate(&repo(&[])).code(0).stdout(
        "[pass] SK01 .: 1 project skill\n\
         [pass] SK02 .: every skill is in a .claude/skills root, which both agents read\n\
         [pass] SK03 .: one copy of each skill name\n\
         [pass] SK04 .: no skill file in the skill roots that only one agent, or neither, loads\n\
         [pass] SK05 .: every skill root is at the repository root\n\
         [pass] SK06 .: every SKILL.md opens with frontmatter that YAML accepts\n\
         [pass] SK07 .: every skill has a description to match\n\
         [pass] SK08 .: every description is within budget\n\
         [pass] SK09 .: no skill keeps trigger text in `when_to_use`\n\
         [pass] SK10 .: every skill name follows the Agent Skills rule\n\
         [pass] SK11 .: every SKILL.md is within the line budget\n\
         [pass] SK12 .: every relative link resolves\n\
         [pass] SK13 .: 1 skill: .claude/skills/deploy/SKILL.md\n\
         [n/a] SK14 (user scope) ..: skipped: --repo-only\n\
         [n/a] SK15 (user scope) ..: skipped: --repo-only\n\
         skills gate passed: 0 fail, 0 warn, 13 pass, 2 n/a\n",
    );
}

#[test]
fn a_repository_without_skills_warns_and_passes() {
    let dir = tempfile::tempdir().unwrap();
    chkr()
        .arg("--repo-only")
        .arg(dir.path())
        .assert()
        .code(0)
        .stdout(contains("[warn] SK01 .claude/skills: no project skill"))
        .stdout(contains("[n/a] SK06 .: no skill to judge"))
        .stdout(contains(
            "skills gate passed: 0 fail, 1 warn, 0 pass, 14 n/a",
        ));
}

#[test]
fn skills_only_opencode_reads_warn() {
    gate(&repo(&[
        (".agents/skills/lint/SKILL.md", &skill("lint", "")),
        (".opencode/skill/fmt/SKILL.md", &skill("fmt", "")),
        (".opencode/skills/deploy/SKILL.md", DEPLOY),
        (".opencode/skills/deploy/references/checklist.md", "- x\n"),
    ]))
    .code(0)
    .stdout(contains(
        "[warn] SK02 .agents/skills/lint/SKILL.md: only OpenCode loads .agents/skills",
    ))
    .stdout(contains("[warn] SK02 .opencode/skill/fmt/SKILL.md"))
    .stdout(contains(
        "fix: move the folder to .claude/skills/lint, which both agents read",
    ))
    .stdout(contains("SK02 .opencode/skills/deploy").not())
    .stdout(contains("[pass] SK03 .: one copy of each skill name"));
}

#[test]
fn diverging_copies_of_one_skill_warn() {
    gate(&repo(&[(
        ".agents/skills/deploy/SKILL.md",
        &skill("deploy", "v2\n"),
    )]))
    .code(0)
    .stdout(contains(
        "[warn] SK03 .claude/skills/deploy/SKILL.md: differs from .agents/skills/deploy/SKILL.md",
    ));
}

#[test]
fn loose_files_and_case_variants_in_a_skill_root_warn() {
    gate(&repo(&[
        (".claude/skills/notes.md", "# notes\n"),
        (".claude/skills/lower/skill.md", &skill("lower", "")),
        (
            ".claude/skills/ops/deploy-web/SKILL.md",
            &skill("deploy-web", ""),
        ),
        (".claude/skills/kept/SKILL.md", &skill("kept", "")),
        (".claude/skills/kept/examples/SKILL.md", "# an example\n"),
    ]))
    .code(0)
    .stdout(contains(
        "[warn] SK04 .claude/skills/ops/deploy-web/SKILL.md: OpenCode loads this nested folder \
         as a skill named `deploy-web`",
    ))
    .stdout(contains(
        "fix: move it to .claude/skills/deploy-web/SKILL.md",
    ))
    .stdout(contains(".claude/skills/kept/examples/SKILL.md:").not())
    .stdout(contains(
        "[warn] SK04 .claude/skills/notes.md: OpenCode loads this file as a skill named `notes`",
    ))
    .stdout(contains(
        "[warn] SK04 .claude/skills/lower/skill.md: neither agent loads this skill",
    ))
    .stdout(contains("fix: rename it to .claude/skills/lower/SKILL.md"));
}

#[test]
fn nested_skill_roots_warn() {
    gate(&repo(&[
        ("apps/web/.claude/skills/build/SKILL.md", &skill("build", "")),
        ("apps/api/.agents/skills/serve/SKILL.md", &skill("serve", "")),
    ]))
    .code(0)
    .stdout(contains(
        "[warn] SK05 apps/web/.claude/skills: Claude Code loads these skills once it reads or edits a file below apps/web",
    ))
    .stdout(contains(
        "[warn] SK05 apps/api/.agents/skills: only an OpenCode session started below apps/api",
    ))
    .stdout(contains(
        "[pass] SK13 .: 3 skills: .claude/skills/deploy/SKILL.md, apps/api/.agents/skills/serve/SKILL.md, apps/web/.claude/skills/build/SKILL.md",
    ));
}

#[test]
fn missing_frontmatter_fails_and_skips_the_field_probes() {
    gate(&repo(&[(
        ".claude/skills/bare/SKILL.md",
        "# Bare\n\nSteps.\n",
    )]))
    .code(1)
    .stdout(contains(
        "[fail] SK06 .claude/skills/bare/SKILL.md: no frontmatter: `---` is not the first line",
    ))
    .stdout(contains("fix: open SKILL.md with `---`, `name: bare`"))
    .stdout(contains("SK07 .claude/skills/bare").not());
}

#[test]
fn a_value_yaml_rejects_fails() {
    gate(&repo(&[(
        ".claude/skills/ship/SKILL.md",
        "---\nname: ship\ndescription: Ship it. Use when: releasing\n---\n",
    )]))
    .code(1)
    .stdout(contains(
        "[fail] SK06 .claude/skills/ship/SKILL.md: line 3: the `description` value holds an unquoted `: `: YAML rejects it, so Claude Code loads the skill with no frontmatter fields, and OpenCode repairs the value",
    ));
}

#[test]
fn a_missing_description_fails_unless_the_skill_is_manual_only() {
    gate(&repo(&[(
        ".claude/skills/quiet/SKILL.md",
        "---\nname: quiet\n---\n",
    )]))
    .code(1)
    .stdout(contains(
        "[fail] SK07 .claude/skills/quiet/SKILL.md: no description: OpenCode never lists the skill",
    ));
    gate(&repo(&[(
        ".claude/skills/release/SKILL.md",
        "---\nname: release\ndisable-model-invocation: true\n---\n",
    )]))
    .code(0)
    .stdout(contains("[pass] SK07"));
}

#[test]
fn description_budget_warns_then_fails() {
    let long = |chars: usize| format!("---\nname: long\ndescription: {}\n---\n", "d".repeat(chars));
    gate(&repo(&[(".claude/skills/long/SKILL.md", &long(1_025))]))
        .code(0)
        .stdout(contains(
            "[warn] SK08 .claude/skills/long/SKILL.md: 1025 chars of description and when_to_use (warn above 1024, fail above 1536)",
        ));
    gate(&repo(&[(".claude/skills/long/SKILL.md", &long(1_537))]))
        .code(1)
        .stdout(contains(
            "[fail] SK08 .claude/skills/long/SKILL.md: 1537 chars",
        ));
}

#[test]
fn when_to_use_warns() {
    gate(&repo(&[(
        ".claude/skills/deploy/SKILL.md",
        "---\nname: deploy\ndescription: Deploy.\nwhen_to_use: when asked to ship\n---\n",
    )]))
    .code(0)
    .stdout(contains(
        "[warn] SK09 .claude/skills/deploy/SKILL.md: OpenCode does not read `when_to_use`",
    ));
}

#[test]
fn reserved_and_mismatched_names() {
    gate(&repo(&[(
        ".claude/skills/Synced/SKILL.md",
        &skill("helper", ""),
    )]))
    .code(1)
    .stdout(contains(
        "[fail] SK10 .claude/skills/Synced/SKILL.md: `Synced` is a name Claude Code reserves",
    ));
    gate(&repo(&[(".claude/skills/ship-it/SKILL.md", &skill("ship", ""))]))
        .code(0)
        .stdout(contains(
            "[warn] SK10 .claude/skills/ship-it/SKILL.md: `name: ship` differs from the folder `ship-it`",
        ));
}

#[test]
fn line_budget_warns_above_500() {
    let head = skill("big", "");
    let body = "x\n".repeat(501 - head.lines().count());
    gate(&repo(&[(
        ".claude/skills/big/SKILL.md",
        &format!("{head}{body}"),
    )]))
    .code(0)
    .stdout(contains(
        "[warn] SK11 .claude/skills/big/SKILL.md: 501 lines (warn above 500)",
    ));
}

#[test]
fn broken_links_fail_and_links_in_code_do_not_count() {
    let body = "See [missing](references/missing.md) and [docs](../../../docs/guide.md).\n\
                ```\n[example](example.md)\n```\n";
    gate(&repo(&[
        (".claude/skills/links/SKILL.md", &skill("links", body)),
        ("docs/guide.md", "# guide\n"),
    ]))
    .code(1)
    .stdout(contains(
        "[fail] SK12 .claude/skills/links/SKILL.md: links to `references/missing.md`, which does not exist",
    ))
    .stdout(contains("example.md").not())
    .stdout(contains("guide.md").not());
}

#[cfg(unix)]
#[test]
fn a_symbolic_link_skill_folder_is_followed() {
    let dir = repo(&[
        (
            "shared/review/SKILL.md",
            &skill(
                "review",
                "Read [the rubric](rubric.md) and [the shared notes](../common.md).\n",
            ),
        ),
        ("shared/review/rubric.md", "1. x\n"),
        ("shared/common.md", "- shared\n"),
    ]);
    std::os::unix::fs::symlink(
        "../../shared/review",
        dir.path().join(".claude/skills/review"),
    )
    .unwrap();
    gate(&dir)
        .code(0)
        .stdout(contains(
            "[pass] SK13 .: 2 skills: .claude/skills/deploy/SKILL.md, .claude/skills/review/SKILL.md",
        ))
        .stdout(contains("[pass] SK12 .: every relative link resolves"));
}

#[test]
fn ignored_and_worktree_directories_are_not_read() {
    gate(&repo(&[
        (".gitignore", "vendor/\n"),
        ("vendor/lib/.claude/skills/x/SKILL.md", "# no frontmatter\n"),
        (
            ".claude/worktrees/feature/.claude/skills/x/SKILL.md",
            "# copy\n",
        ),
    ]))
    .code(0)
    .stdout(contains(
        "[pass] SK13 .: 1 skill: .claude/skills/deploy/SKILL.md",
    ));
}

#[cfg(unix)]
#[test]
fn a_skill_root_that_is_a_symbolic_link_is_read() {
    let dir = tempfile::tempdir().unwrap();
    write(dir.path(), ".agents/skills/deploy/SKILL.md", DEPLOY);
    write(
        dir.path(),
        ".agents/skills/deploy/references/checklist.md",
        "- x\n",
    );
    fs::create_dir(dir.path().join(".claude")).unwrap();
    std::os::unix::fs::symlink("../.agents/skills", dir.path().join(".claude/skills")).unwrap();
    gate(&dir)
        .code(0)
        .stdout(contains(
            "[pass] SK13 .: 2 skills: .claude/skills/deploy/SKILL.md, \
             .agents/skills/deploy/SKILL.md",
        ))
        .stdout(contains("[warn] SK02").not())
        .stdout(contains("[pass] SK12 .: every relative link resolves"));
}

#[cfg(unix)]
#[test]
fn a_symbolic_link_claude_directory_is_read() {
    let dir = tempfile::tempdir().unwrap();
    write(dir.path(), "shared/.claude/skills/deploy/SKILL.md", DEPLOY);
    write(
        dir.path(),
        "shared/.claude/skills/deploy/references/checklist.md",
        "- x\n",
    );
    std::os::unix::fs::symlink("shared/.claude", dir.path().join(".claude")).unwrap();
    gate(&dir)
        .code(0)
        .stdout(contains("[pass] SK01"))
        .stdout(contains(".claude/skills/deploy/SKILL.md"));
}

#[test]
fn ignore_rules_do_not_hide_a_skill_root() {
    gate(&repo(&[(".gitignore", ".claude/\n")]))
        .code(0)
        .stdout(contains(
            "[pass] SK13 .: 1 skill: .claude/skills/deploy/SKILL.md",
        ))
        .stdout(contains("[pass] SK12 .: every relative link resolves"));
}

/// `<tmp>/home` is `$HOME`; the repository is `<tmp>/home/work/repo`.
fn user_tree() -> (TempDir, PathBuf, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path().join("home");
    write(
        &home,
        ".claude/skills/deploy/SKILL.md",
        &skill("deploy", "mine\n"),
    );
    write(&home, ".claude/skills/notes/SKILL.md", &skill("notes", ""));
    write(&home, ".agents/skills/other/SKILL.md", &skill("other", ""));
    write(
        &home,
        "work/.claude/skills/team/SKILL.md",
        &skill("team", ""),
    );
    let repo = home.join("work/repo");
    write(&repo, ".claude/skills/deploy/SKILL.md", DEPLOY);
    write(
        &repo,
        ".claude/skills/deploy/references/checklist.md",
        "- x\n",
    );
    let home = home.canonicalize().unwrap();
    (dir, home, repo)
}

#[test]
fn skill_roots_outside_the_repository_are_reported_in_user_scope() {
    let (_dir, home, repo) = user_tree();
    let shown = |relative: &str| home.join(relative).display().to_string();
    chkr()
        .env("HOME", &home)
        .arg(&repo)
        .assert()
        .code(0)
        .stdout(contains(format!(
            "[warn] SK14 (user scope) {}: outside the repository: OpenCode loads these skills in every session here (team)",
            shown("work/.claude/skills")
        )))
        .stdout(contains(format!(
            "[warn] SK14 (user scope) {}: personal skills only OpenCode loads (other)",
            shown(".agents/skills")
        )))
        .stdout(contains(format!("SK14 (user scope) {}:", shown(".claude/skills"))).not())
        .stdout(contains(format!(
            "[warn] SK15 (user scope) {}: Claude Code runs this personal copy instead of .claude/skills/deploy/SKILL.md",
            shown(".claude/skills/deploy/SKILL.md")
        )))
        .stdout(contains("notes/SKILL.md").not());
}

#[cfg(unix)]
#[test]
fn symbolic_link_folders_count_in_roots_outside_the_repository() {
    let (_dir, home, repo) = user_tree();
    write(&home, "shared/linked/SKILL.md", &skill("linked", ""));
    write(
        &home,
        "work/.claude/skills/README.md",
        "# not a skill folder\n",
    );
    std::os::unix::fs::symlink(
        "../../../shared/linked",
        home.join("work/.claude/skills/linked"),
    )
    .unwrap();
    std::os::unix::fs::symlink("README.md", home.join("work/.claude/skills/alias")).unwrap();
    chkr()
        .env("HOME", &home)
        .arg(&repo)
        .assert()
        .code(0)
        .stdout(contains(
            "OpenCode loads these skills in every session here (linked, team)",
        ));
}

#[test]
fn a_home_directory_that_ignores_everything_still_shows_its_skill_roots() {
    let (_dir, home, repo) = user_tree();
    write(&home, ".gitignore", "*\n");
    fs::create_dir_all(repo.join(".git")).unwrap();
    chkr()
        .env("HOME", &home)
        .arg(&repo)
        .assert()
        .code(0)
        .stdout(contains(
            "[pass] SK13 .: 1 skill: .claude/skills/deploy/SKILL.md",
        ))
        .stdout(contains(
            "OpenCode loads these skills in every session here (team)",
        ))
        .stdout(contains("personal skills only OpenCode loads (other)"))
        .stdout(contains("[warn] SK15 (user scope)"));
}

#[test]
fn repo_only_skips_the_user_scope() {
    let (_dir, home, repo) = user_tree();
    chkr()
        .env("HOME", &home)
        .arg("--repo-only")
        .arg(&repo)
        .assert()
        .code(0)
        .stdout(contains("[n/a] SK14 (user scope) ..: skipped: --repo-only"))
        .stdout(contains("[warn] SK1").not());
}

#[test]
fn a_missing_directory_exits_two() {
    let dir = tempfile::tempdir().unwrap();
    chkr()
        .arg(dir.path().join("missing"))
        .assert()
        .code(2)
        .stderr(contains("skills-chkr: cannot read"));
}

#[test]
fn a_file_as_root_exits_two() {
    let dir = repo(&[]);
    chkr()
        .arg(dir.path().join(".claude/skills/deploy/SKILL.md"))
        .assert()
        .code(2)
        .stderr(contains("is not a directory"));
}

#[test]
fn an_unreadable_skill_file_exits_two() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(".claude/skills/x/SKILL.md");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, [0xff, 0xfe]).unwrap();
    chkr()
        .arg("--repo-only")
        .arg(dir.path())
        .assert()
        .code(2)
        .stderr(contains("skills-chkr: cannot read"));
}

#[test]
fn defaults_to_the_current_directory() {
    let dir = repo(&[]);
    chkr()
        .arg("--repo-only")
        .current_dir(dir.path())
        .assert()
        .code(0)
        .stdout(contains("skills gate passed"));
}
