//! Probes `SK01`–`SK05` and `SK13`: where skills live and which agent loads them. Pure
//! functions of a [`Snapshot`].

use std::path::{Path, PathBuf};

use vitals_utils::{Finding, Verdict, or_pass};

use crate::layout::{Located, Place, Root, SKILL_MD, locate};
use crate::probes::no_skill;
use crate::snapshot::{Skill, Snapshot};

pub(crate) fn findings(snapshot: &Snapshot) -> Vec<Finding> {
    let skills = &snapshot.skills;
    [
        vec![presence(skills)],
        reach(skills),
        copies(skills),
        layout(&snapshot.files),
        nested(skills),
    ]
    .concat()
}

/// `SK01`: the repository has project skills.
fn presence(skills: &[Skill]) -> Finding {
    if skills.is_empty() {
        Finding::new(
            "SK01",
            Verdict::Warn,
            Root::Claude.path(),
            "no project skill in .claude/skills, .agents/skills, or .opencode/skill(s)",
        )
        .with_fix(
            "turn each workflow agents repeat here into .claude/skills/<name>/SKILL.md, which \
             both Claude Code and OpenCode load",
        )
    } else {
        Finding::new(
            "SK01",
            Verdict::Pass,
            ".",
            format!("{} project {}", skills.len(), skill_noun(skills.len())),
        )
    }
}

const fn skill_noun(count: usize) -> &'static str {
    if count == 1 { "skill" } else { "skills" }
}

fn in_claude_root(place: &Place) -> PathBuf {
    Place {
        root: Root::Claude,
        ..place.clone()
    }
    .dir()
}

/// `SK02`: every skill is in a root that Claude Code reads too.
fn reach(skills: &[Skill]) -> Vec<Finding> {
    if skills.is_empty() {
        return vec![no_skill("SK02")];
    }
    let mirrored = |place: &Place| {
        skills
            .iter()
            .any(|other| other.place.root.claude_reads() && other.place.same_name(place))
    };
    let found = skills
        .iter()
        .map(|skill| &skill.place)
        .filter(|place| !place.root.claude_reads() && !mirrored(place))
        .map(|place| {
            Finding::new(
                "SK02",
                Verdict::Warn,
                place.skill_md(),
                format!(
                    "only OpenCode loads {}: Claude Code reads skills from .claude/skills only",
                    place.root.path()
                ),
            )
            .with_fix(format!(
                "move the folder to {}, which both agents read",
                in_claude_root(place).display()
            ))
        })
        .collect();
    or_pass(
        found,
        Finding::new(
            "SK02",
            Verdict::Pass,
            ".",
            "every skill is in a .claude/skills root, which both agents read",
        ),
    )
}

/// `SK03`: one copy per skill name in each directory's roots.
fn copies(skills: &[Skill]) -> Vec<Finding> {
    if skills.is_empty() {
        return vec![no_skill("SK03")];
    }
    let found = skills
        .iter()
        .filter_map(|skill| {
            let others: Vec<&Skill> = skills
                .iter()
                .filter(|other| other.place.same_name(&skill.place) && other.place != skill.place)
                .collect();
            // Report each group once, at its first place (the .claude copy when there is one).
            let first = others.iter().all(|other| other.place > skill.place);
            let differ = others.iter().any(|other| other.text != skill.text);
            (first && differ).then(|| diverging(skill, &others))
        })
        .collect();
    or_pass(
        found,
        Finding::new("SK03", Verdict::Pass, ".", "one copy of each skill name"),
    )
}

fn diverging(skill: &Skill, others: &[&Skill]) -> Finding {
    let elsewhere: Vec<String> = others
        .iter()
        .filter(|other| other.text != skill.text)
        .map(|other| other.place.skill_md().display().to_string())
        .collect();
    Finding::new(
        "SK03",
        Verdict::Warn,
        skill.place.skill_md(),
        format!(
            "differs from {}: Claude Code reads only the .claude/skills copy, and OpenCode keeps \
             one copy per folder name",
            elsewhere.join(", ")
        ),
    )
    .with_fix(
        "keep one copy in .claude/skills and delete the others, or make them symbolic links to it",
    )
}

/// `SK04`: no file in a skill root that only one agent, or neither, loads as a skill: a
/// `*.md` file directly in the root, a case variant of `SKILL.md`, or a `SKILL.md` nested
/// below a folder that has none.
fn layout(files: &[PathBuf]) -> Vec<Finding> {
    let located: Vec<(&PathBuf, Located)> = files
        .iter()
        .filter_map(|path| locate(path).map(|found| (path, found)))
        .collect();
    if located.is_empty() {
        return vec![Finding::new(
            "SK04",
            Verdict::NotApplicable,
            Root::Claude.path(),
            "no skill root",
        )];
    }
    let found = located
        .iter()
        .filter_map(|(path, found)| stray(path, found, files))
        .collect();
    or_pass(
        found,
        Finding::new(
            "SK04",
            Verdict::Pass,
            ".",
            "no skill file in the skill roots that only one agent, or neither, loads",
        ),
    )
}

fn stray(path: &Path, found: &Located, files: &[PathBuf]) -> Option<Finding> {
    let warn = |message: String, fix: String| {
        Finding::new("SK04", Verdict::Warn, path, message).with_fix(fix)
    };
    let moved = |name: &str| {
        format!(
            "move it to {}",
            found.root_dir().join(name).join(SKILL_MD).display()
        )
    };
    match found.rest.as_slice() {
        [file] => {
            let stem = file.strip_suffix(".md")?;
            Some(warn(
                format!(
                    "OpenCode loads this file as a skill named `{stem}`; Claude Code loads \
                     only <name>/SKILL.md"
                ),
                moved(stem),
            ))
        }
        [name, file] => {
            let exact = found.root_dir().join(name).join(SKILL_MD);
            let variant = file != SKILL_MD && file.eq_ignore_ascii_case(SKILL_MD);
            (variant && !files.contains(&exact)).then(|| {
                warn(
                    "neither agent loads this skill: both look for SKILL.md exactly, and names \
                     are case-sensitive on Linux and in CI"
                        .to_owned(),
                    format!("rename it to {}", exact.display()),
                )
            })
        }
        [group, .., last] if last == SKILL_MD => nested_skill(path, found, group, files),
        _ => None,
    }
}

/// A `SKILL.md` below `<root>/<group>/`, where `group` holds no `SKILL.md` of its own.
fn nested_skill(path: &Path, found: &Located, group: &str, files: &[PathBuf]) -> Option<Finding> {
    let first = found.root_dir().join(group).join(SKILL_MD);
    let name = path.parent()?.file_name()?.to_str()?;
    (!files.contains(&first)).then(|| {
        Finding::new(
            "SK04",
            Verdict::Warn,
            path,
            format!(
                "OpenCode loads this nested folder as a skill named `{name}`; Claude Code \
                 documents only <name>/SKILL.md directly in the skill root"
            ),
        )
        .with_fix(format!(
            "move it to {}",
            found.root_dir().join(name).join(SKILL_MD).display()
        ))
    })
}

/// `SK05`: skill roots below the repository root load differently in each agent.
fn nested(skills: &[Skill]) -> Vec<Finding> {
    if skills.is_empty() {
        return vec![no_skill("SK05")];
    }
    let mut roots: Vec<(&Path, Root)> = skills
        .iter()
        .filter(|skill| !skill.place.scope.as_os_str().is_empty())
        .map(|skill| (skill.place.scope.as_path(), skill.place.root))
        .collect();
    roots.dedup();
    let found = roots
        .into_iter()
        .map(|(scope, root)| {
            let below = scope.display();
            let message = if root.claude_reads() {
                format!(
                    "Claude Code loads these skills once it reads or edits a file below {below}; \
                     OpenCode only in a session started there"
                )
            } else {
                format!(
                    "only an OpenCode session started below {below} loads these skills; Claude \
                     Code never reads {}",
                    root.path()
                )
            };
            Finding::new("SK05", Verdict::Warn, scope.join(root.path()), message).with_fix(format!(
                "move them to the root .claude/skills/ and name {below} in each description"
            ))
        })
        .collect();
    or_pass(
        found,
        Finding::new(
            "SK05",
            Verdict::Pass,
            ".",
            "every skill root is at the repository root",
        ),
    )
}

/// `SK13`: the inventory of skills, for the review skill to read.
pub(crate) fn inventory(snapshot: &Snapshot) -> Finding {
    if snapshot.skills.is_empty() {
        return Finding::new("SK13", Verdict::NotApplicable, ".", "no skill");
    }
    let paths: Vec<String> = snapshot
        .skills
        .iter()
        .map(|skill| skill.place.skill_md().display().to_string())
        .collect();
    Finding::new(
        "SK13",
        Verdict::Pass,
        ".",
        format!(
            "{} {}: {}",
            paths.len(),
            skill_noun(paths.len()),
            paths.join(", ")
        ),
    )
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{findings, inventory};
    use crate::layout::{Place, Root};
    use crate::snapshot::{Skill, Snapshot};
    use std::path::PathBuf;
    use vitals_utils::{Finding, Verdict};

    fn skill(scope: &str, root: Root, name: &str, text: &str) -> Skill {
        Skill {
            place: Place {
                scope: PathBuf::from(scope),
                root,
                name: name.to_owned(),
            },
            text: text.to_owned(),
            files: vec![PathBuf::from("SKILL.md")],
            link: None,
        }
    }

    fn run(mut skills: Vec<Skill>, files: &[&str]) -> Vec<Finding> {
        skills.sort_by(|a, b| a.place.cmp(&b.place));
        findings(&Snapshot {
            skills,
            files: files.iter().map(PathBuf::from).collect(),
            user: None,
        })
    }

    fn of(found: &[Finding], probe: &str) -> Vec<(Verdict, String)> {
        found
            .iter()
            .filter(|finding| finding.probe() == probe)
            .map(|finding| (finding.verdict(), finding.evidence().display().to_string()))
            .collect()
    }

    #[test]
    fn no_skill_warns_on_presence_and_skips_the_rest() {
        let found = run(Vec::new(), &[]);
        assert_eq!(
            of(&found, "SK01"),
            [(Verdict::Warn, ".claude/skills".to_owned())]
        );
        for probe in ["SK02", "SK03", "SK04", "SK05"] {
            assert_eq!(of(&found, probe)[0].0, Verdict::NotApplicable, "{probe}");
        }
        assert_eq!(
            inventory(&Snapshot::default()).verdict(),
            Verdict::NotApplicable
        );
    }

    #[test]
    fn skills_only_opencode_reads_warn_unless_mirrored_in_claude_skills() {
        let found = run(
            vec![
                skill("", Root::Agents, "lint", "a"),
                skill("", Root::OpencodeSingular, "fmt", "b"),
                skill("", Root::Opencode, "deploy", "c"),
                skill("", Root::Claude, "deploy", "c"),
            ],
            &[],
        );
        assert_eq!(
            of(&found, "SK02"),
            [
                (Verdict::Warn, ".opencode/skill/fmt/SKILL.md".to_owned()),
                (Verdict::Warn, ".agents/skills/lint/SKILL.md".to_owned()),
            ]
        );
        assert!(
            found
                .iter()
                .filter_map(Finding::fix)
                .any(|fix| fix == "move the folder to .claude/skills/lint, which both agents read")
        );
    }

    #[test]
    fn diverging_copies_warn_once_and_identical_copies_pass() {
        let found = run(
            vec![
                skill("", Root::Claude, "deploy", "v1"),
                skill("", Root::Agents, "deploy", "v2"),
                skill("", Root::Opencode, "deploy", "v1"),
                skill("", Root::Claude, "lint", "same"),
                skill("", Root::Agents, "lint", "same"),
                skill("pkg", Root::Claude, "deploy", "v3"),
            ],
            &[],
        );
        assert_eq!(
            of(&found, "SK03"),
            [(Verdict::Warn, ".claude/skills/deploy/SKILL.md".to_owned())]
        );
        let message = found
            .iter()
            .find(|f| f.probe() == "SK03")
            .unwrap()
            .message();
        assert!(message.starts_with("differs from .agents/skills/deploy/SKILL.md:"));
        let same = run(vec![skill("", Root::Claude, "a", "x")], &[]);
        assert_eq!(of(&same, "SK03"), [(Verdict::Pass, ".".to_owned())]);
    }

    #[test]
    fn loose_files_and_case_variants_warn() {
        let files = [
            ".claude/skills/notes.md",
            ".claude/skills/notes.txt",
            ".agents/skills/lower/skill.md",
            ".claude/skills/both/skill.md",
            ".claude/skills/both/SKILL.md",
            ".claude/skills/ok/SKILL.md",
            ".claude/skills/ok/references/a.md",
        ];
        let found = run(vec![skill("", Root::Claude, "ok", "x")], &files);
        assert_eq!(
            of(&found, "SK04"),
            [
                (Verdict::Warn, ".claude/skills/notes.md".to_owned()),
                (Verdict::Warn, ".agents/skills/lower/skill.md".to_owned()),
            ]
        );
        let suggested: Vec<&str> = found.iter().filter_map(Finding::fix).collect();
        assert_eq!(
            suggested,
            [
                "move it to .claude/skills/notes/SKILL.md",
                "rename it to .agents/skills/lower/SKILL.md"
            ]
        );
        let clean = run(vec![skill("", Root::Claude, "ok", "x")], &files[5..]);
        assert_eq!(of(&clean, "SK04"), [(Verdict::Pass, ".".to_owned())]);
        let none = run(vec![skill("", Root::Claude, "ok", "x")], &["README.md"]);
        assert_eq!(of(&none, "SK04")[0].0, Verdict::NotApplicable);
    }

    #[test]
    fn nested_roots_warn_once_per_root_with_the_agent_that_misses_them() {
        let found = run(
            vec![
                skill("apps/web", Root::Claude, "a", "x"),
                skill("apps/web", Root::Claude, "b", "x"),
                skill("apps/api", Root::Agents, "c", "x"),
                skill("", Root::Claude, "root", "x"),
            ],
            &[],
        );
        assert_eq!(
            of(&found, "SK05"),
            [
                (Verdict::Warn, "apps/api/.agents/skills".to_owned()),
                (Verdict::Warn, "apps/web/.claude/skills".to_owned()),
            ]
        );
        let messages: Vec<&str> = found
            .iter()
            .filter(|f| f.probe() == "SK05")
            .map(Finding::message)
            .collect();
        assert!(messages[0].contains("Claude Code never reads .agents/skills"));
        assert!(messages[1].starts_with("Claude Code loads these skills once"));
        let flat = run(vec![skill("", Root::Claude, "root", "x")], &[]);
        assert_eq!(of(&flat, "SK05"), [(Verdict::Pass, ".".to_owned())]);
    }

    #[test]
    fn inventory_lists_every_skill() {
        let snapshot = Snapshot {
            skills: vec![
                skill("", Root::Claude, "a", "x"),
                skill("pkg", Root::Agents, "b", "y"),
            ],
            ..Snapshot::default()
        };
        let listed = inventory(&snapshot);
        assert_eq!(listed.verdict(), Verdict::Pass);
        assert_eq!(
            listed.message(),
            "2 skills: .claude/skills/a/SKILL.md, pkg/.agents/skills/b/SKILL.md"
        );
    }
}
