//! Probes `SK14` and `SK15`, user scope: skill roots outside the repository that the two
//! agents load differently. Pure functions of a [`Snapshot`]; their findings never change
//! the exit status.
//!
//! `OpenCode` 2 walks from the working directory up to `/` for `.claude/`, `.agents/`, and
//! `.opencode/` (`config/discovery.ts`) and also reads `~/.agents/skills` and its global
//! config directory; Claude Code reads parent directories only up to the repository root,
//! and only `~/.claude/skills` at home (skills docs). For one name, Claude Code prefers the
//! personal skill; `OpenCode` the project one (`config/plugin/compatibility.ts`).

use std::path::{Path, PathBuf};

use vitals_utils::{Finding, Verdict, or_pass};

use crate::kit;
use crate::layout::SKILL_MD;
use crate::snapshot::{OutsideRoot, Skill, Snapshot, User};

/// Skill roots under the home directory: the first is Claude Code's personal root, which
/// `OpenCode` reads too; `OpenCode` alone reads the others.
pub(crate) const HOME_ROOTS: [&str; 4] = [
    ".claude/skills",
    ".agents/skills",
    ".config/opencode/skills",
    ".config/opencode/skill",
];

pub(crate) fn findings(snapshot: &Snapshot) -> Vec<Finding> {
    let Some(user) = &snapshot.user else {
        return ["SK14", "SK15"]
            .into_iter()
            .map(|probe| {
                Finding::new(probe, Verdict::NotApplicable, "..", "skipped: --repo-only")
                    .in_user_scope()
            })
            .collect();
    };
    let personal = user.home.as_ref().map(|home| home.join(HOME_ROOTS[0]));
    [
        one_sided(user, personal.as_deref()),
        shadowed(&snapshot.skills, user, personal.as_deref()),
    ]
    .concat()
}

fn names(root: &OutsideRoot) -> String {
    root.skills.join(", ")
}

/// Whether `path` is one of the home roots that only `OpenCode` reads.
fn opencode_home(user: &User, path: &Path) -> bool {
    user.home.as_ref().is_some_and(|home| {
        HOME_ROOTS
            .iter()
            .skip(1)
            .any(|name| home.join(name) == path)
    })
}

/// `SK14`: no skill root outside the repository that only `OpenCode` loads.
fn one_sided(user: &User, personal: Option<&Path>) -> Vec<Finding> {
    let found = user
        .roots
        .iter()
        .filter(|root| Some(root.path.as_path()) != personal)
        .map(|root| {
            let (message, fix) = if opencode_home(user, &root.path) {
                (
                    format!(
                        "personal skills only OpenCode loads ({}); Claude Code reads personal \
                         skills from ~/.claude/skills only",
                        names(root)
                    ),
                    "move them to ~/.claude/skills/, which both agents read",
                )
            } else {
                (
                    format!(
                        "outside the repository: OpenCode loads these skills in every session \
                         here ({}); Claude Code stops at the repository root",
                        names(root)
                    ),
                    "move personal skills to ~/.claude/skills/ and shared ones into this \
                     repository's .claude/skills/",
                )
            };
            Finding::new("SK14", Verdict::Warn, &root.path, message)
                .with_fix(fix)
                .in_user_scope()
        })
        .collect();
    or_pass(
        found,
        Finding::new(
            "SK14",
            Verdict::Pass,
            "..",
            "no skill root outside the repository that only OpenCode reads",
        )
        .in_user_scope(),
    )
}

/// Whether `skill` and its personal namesake are the qol-mini kit's two copies of one bank
/// skill: the repository's lock records it, and both carry the same name and description.
fn kit_pair(skill: &Skill, user: &User) -> bool {
    let name = &skill.place.name;
    user.managed.contains(name)
        && user
            .personal
            .iter()
            .any(|(other, text)| other == name && kit::same_skill(text, &skill.text))
}

/// `SK15`: no personal Claude Code skill shares a name with a skill that Claude Code loads
/// from `.claude/skills` at the repository root, where each name is a single folder,
/// unless the two are the kit's copies of one bank skill.
fn shadowed(skills: &[Skill], user: &User, personal: Option<&Path>) -> Vec<Finding> {
    let shadowing: Vec<&Skill> = personal
        .and_then(|path| user.roots.iter().find(|root| root.path == path))
        .map_or_else(Vec::new, |root| {
            skills
                .iter()
                .filter(|skill| skill.place.scope.as_os_str().is_empty())
                .filter(|skill| skill.place.root.claude_reads())
                .filter(|skill| root.skills.contains(&skill.place.name))
                .collect()
        });
    let (pairs, found): (Vec<&Skill>, Vec<&Skill>) = shadowing
        .into_iter()
        .partition(|skill| kit_pair(skill, user));
    let base = personal.unwrap_or_else(|| Path::new(".."));
    let message = if pairs.is_empty() {
        "no personal skill shares a name with a project skill".to_owned()
    } else {
        let names: Vec<&str> = pairs
            .iter()
            .map(|skill| skill.place.name.as_str())
            .collect();
        format!(
            "no personal skill shadows a project skill; {} is the qol-mini kit's personal \
             and project copy of one bank skill",
            names.join(", ")
        )
    };
    or_pass(
        found.into_iter().map(|skill| shadow(base, skill)).collect(),
        Finding::new("SK15", Verdict::Pass, "..", message).in_user_scope(),
    )
}

fn shadow(personal: &Path, skill: &Skill) -> Finding {
    let copy: PathBuf = personal.join(&skill.place.name).join(SKILL_MD);
    Finding::new(
        "SK15",
        Verdict::Warn,
        copy,
        format!(
            "Claude Code runs this personal copy instead of {} (personal over project); \
             OpenCode runs the project one",
            skill.place.skill_md().display()
        ),
    )
    .with_fix("rename one of them, or delete the personal copy")
    .in_user_scope()
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::findings;
    use crate::layout::{Place, Root};
    use crate::snapshot::{OutsideRoot, Skill, Snapshot, User};
    use std::path::PathBuf;
    use vitals_utils::{Finding, Outcome, Report, Scope, Verdict};

    fn root(path: &str, skills: &[&str]) -> OutsideRoot {
        OutsideRoot {
            path: PathBuf::from(path),
            skills: skills.iter().map(|name| (*name).to_owned()).collect(),
        }
    }

    fn skill(scope: &str, root: Root, name: &str) -> Skill {
        Skill {
            place: Place {
                scope: PathBuf::from(scope),
                root,
                name: name.to_owned(),
            },
            text: String::new(),
            files: Vec::new(),
            link: None,
        }
    }

    fn run(skills: Vec<Skill>, roots: Vec<OutsideRoot>) -> Vec<Finding> {
        findings(&Snapshot {
            skills,
            files: Vec::new(),
            user: Some(User {
                home: Some(PathBuf::from("/home/dev")),
                roots,
                ..User::default()
            }),
        })
    }

    fn evidence(found: &[Finding], probe: &str) -> Vec<String> {
        found
            .iter()
            .filter(|f| f.probe() == probe && f.verdict() == Verdict::Warn)
            .map(|f| f.evidence().display().to_string())
            .collect()
    }

    #[test]
    fn repository_only_runs_skip_both_probes() {
        let found = findings(&Snapshot::default());
        assert_eq!(found.len(), 2);
        assert!(found.iter().all(|f| f.verdict() == Verdict::NotApplicable));
        assert!(found.iter().all(|f| f.scope() == Scope::User));
    }

    #[test]
    fn a_clean_machine_passes_in_user_scope() {
        let found = run(vec![skill("", Root::Claude, "a")], Vec::new());
        assert_eq!(found.len(), 2);
        assert!(
            found
                .iter()
                .all(|f| f.verdict() == Verdict::Pass && f.scope() == Scope::User)
        );
    }

    #[test]
    fn roots_only_opencode_reads_warn_and_the_claude_personal_root_does_not() {
        let found = run(
            Vec::new(),
            vec![
                root("/home/dev/work/.claude/skills", &["team"]),
                root("/home/dev/.claude/skills", &["mine"]),
                root("/home/dev/.agents/skills", &["other"]),
                root("/home/dev/.config/opencode/skill", &["oc"]),
                root("/.opencode/skills", &["machine"]),
            ],
        );
        assert_eq!(
            evidence(&found, "SK14"),
            [
                "/home/dev/work/.claude/skills",
                "/home/dev/.agents/skills",
                "/home/dev/.config/opencode/skill",
                "/.opencode/skills",
            ]
        );
        let messages: Vec<&str> = found.iter().map(Finding::message).collect();
        assert!(messages[0].starts_with(
            "outside the repository: OpenCode loads these skills in every session here (team)"
        ));
        assert!(messages[1].starts_with("personal skills only OpenCode loads (other)"));
        let report = Report::new("skills", found);
        assert_eq!(report.outcome(), Outcome::Passed);
    }

    #[test]
    fn personal_skills_that_shadow_root_skills_warn_once_per_name() {
        let found = run(
            vec![
                skill("", Root::Claude, "deploy"),
                skill("", Root::Claude, "solo"),
                // Sorted by root, a second copy of a name is not next to the first.
                skill("", Root::Agents, "deploy"),
                // Claude Code never loads this one, so the personal copy shadows nothing.
                skill("", Root::Agents, "opencode-only"),
                skill("pkg", Root::Claude, "lint"),
            ],
            vec![root(
                "/home/dev/.claude/skills",
                &["deploy", "lint", "opencode-only"],
            )],
        );
        assert_eq!(
            evidence(&found, "SK15"),
            ["/home/dev/.claude/skills/deploy/SKILL.md"]
        );
        let shadow = found.iter().find(|f| f.probe() == "SK15").unwrap();
        assert!(
            shadow
                .message()
                .contains("instead of .claude/skills/deploy/SKILL.md")
        );
    }

    #[test]
    fn the_kits_two_copies_of_one_bank_skill_pass() {
        let kaizen = "---\nname: kaizen\ndescription: Review the session.\n---\n";
        let project = Skill {
            text: format!("{kaizen}npx qol-mini kaizen release\n"),
            ..skill("", Root::Claude, "kaizen")
        };
        let machine = |managed: &[&str], description: &str| User {
            home: Some(PathBuf::from("/home/dev")),
            roots: vec![root("/home/dev/.claude/skills", &["kaizen"])],
            managed: managed.iter().map(|name| (*name).to_owned()).collect(),
            personal: vec![(
                "kaizen".to_owned(),
                format!("---\nname: kaizen\ndescription: {description}\n---\nnode hook\n"),
            )],
        };
        let sk15 = |user: User| {
            let found = findings(&Snapshot {
                skills: vec![project.clone()],
                files: Vec::new(),
                user: Some(user),
            });
            found.into_iter().find(|f| f.probe() == "SK15").unwrap()
        };
        let pair = sk15(machine(&["kaizen"], "Review the session."));
        assert_eq!(pair.verdict(), Verdict::Pass);
        assert!(
            pair.message()
                .contains("kaizen is the qol-mini kit's personal")
        );
        // Not in the lock, or another description: two skills under one name.
        assert_eq!(
            sk15(machine(&[], "Review the session.")).verdict(),
            Verdict::Warn
        );
        assert_eq!(
            sk15(machine(&["kaizen"], "Something else.")).verdict(),
            Verdict::Warn
        );
    }

    #[test]
    fn no_home_means_no_personal_root() {
        let found = findings(&Snapshot {
            skills: vec![skill("", Root::Claude, "deploy")],
            files: Vec::new(),
            user: Some(User {
                home: None,
                roots: vec![root("/srv/.agents/skills", &["deploy"])],
                ..User::default()
            }),
        });
        assert_eq!(evidence(&found, "SK14"), ["/srv/.agents/skills"]);
        assert_eq!(evidence(&found, "SK15"), Vec::<String>::new());
    }
}
