//! Probes `AM14` and `AM15`, user scope: instruction files in the parent directories of the
//! repository, which agents load in every session started inside it. Pure functions of a
//! [`Snapshot`]; their findings never change the exit status.

use vitals_utils::{Finding, Verdict};

use crate::cascade::{Kind, classify};
use crate::probes::{DOT_CLAUDE_MD, ROOT_CLAUDE_MD, layout};
use crate::snapshot::{Entry, Snapshot};

pub(crate) fn findings(snapshot: &Snapshot) -> Vec<Finding> {
    let Some(ancestors) = &snapshot.ancestors else {
        return ["AM14", "AM15"]
            .into_iter()
            .map(|probe| {
                Finding::new(probe, Verdict::NotApplicable, "..", "skipped: --repo-only")
                    .in_user_scope()
            })
            .collect();
    };
    // `~/.claude/CLAUDE.md` is user memory by design: it does not disable AGENTS.md.
    let memory = snapshot
        .home
        .as_ref()
        .map(|home| home.join(".claude/CLAUDE.md"));
    let relevant: Vec<&Entry> = ancestors
        .iter()
        .filter(|entry| Some(&entry.path) != memory.as_ref())
        .collect();
    [
        claude_family(&relevant, bridged(snapshot)),
        agents_family(&relevant),
    ]
    .concat()
}

/// Whether a root `CLAUDE.md` of the repository imports or links to `AGENTS.md`.
fn bridged(snapshot: &Snapshot) -> bool {
    layout(&snapshot.claude_md, ROOT_CLAUDE_MD.agents).loads_agents()
        || layout(&snapshot.dot_claude_md, DOT_CLAUDE_MD.agents).loads_agents()
}

fn user(probe: &'static str, verdict: Verdict, entry: &Entry, message: &str) -> Finding {
    Finding::new(probe, verdict, &entry.path, message).in_user_scope()
}

/// `AM14`: no `CLAUDE.md` above the repository makes Claude Code drop its `AGENTS.md`.
fn claude_family(ancestors: &[&Entry], bridged: bool) -> Vec<Finding> {
    let message = if bridged {
        "outside the repository: Claude Code loads it in every session here, on top of the \
         repository's rules; OpenCode does not read it"
    } else {
        "outside the repository: Claude Code loads it and, by default, skips every AGENTS.md, \
         this repository's included; OpenCode does not read it"
    };
    let found: Vec<Finding> = ancestors
        .iter()
        .filter(|entry| {
            matches!(
                classify(&entry.path),
                Some(Kind::Claude | Kind::DotClaude | Kind::ClaudeLocal)
            )
        })
        .map(|entry| {
            user("AM14", Verdict::Warn, entry, message).with_fix(
                "move personal rules to ~/.claude/CLAUDE.md (it does not disable AGENTS.md) and \
                 delete this file, or add a CLAUDE.md holding only `@AGENTS.md` to the repository",
            )
        })
        .collect();
    if found.is_empty() {
        vec![
            Finding::new(
                "AM14",
                Verdict::Pass,
                "..",
                "no CLAUDE.md above the repository",
            )
            .in_user_scope(),
        ]
    } else {
        found
    }
}

/// `AM15`: no `AGENTS.md` above the repository adds rules that teammates and CI lack.
fn agents_family(ancestors: &[&Entry]) -> Vec<Finding> {
    let found: Vec<Finding> = ancestors
        .iter()
        .filter_map(|entry| {
            let message = match classify(&entry.path)? {
                Kind::Agents => {
                    "outside the repository: Claude Code loads it in every session here, and \
                     OpenCode too when the repository is under the home directory; teammates \
                     and CI do not have it"
                }
                Kind::ClaudeAgents => {
                    "outside the repository: Claude Code loads it in every session here; \
                     teammates and CI do not have it"
                }
                Kind::Claude | Kind::DotClaude | Kind::ClaudeLocal | Kind::Rule | Kind::Unread => {
                    return None;
                }
            };
            Some(user("AM15", Verdict::Warn, entry, message).with_fix(
                "keep personal rules in ~/.claude/CLAUDE.md and ~/.config/opencode/AGENTS.md, \
                 and shared rules in the repository",
            ))
        })
        .collect();
    if found.is_empty() {
        vec![
            Finding::new(
                "AM15",
                Verdict::Pass,
                "..",
                "no AGENTS.md above the repository",
            )
            .in_user_scope(),
        ]
    } else {
        found
    }
}

/// `AM21`, user scope: no managed `CLAUDE.md` gives Claude Code rules that `OpenCode`
/// never reads.
pub(crate) fn managed(snapshot: &Snapshot) -> Finding {
    let Some(managed) = &snapshot.managed else {
        return Finding::new(
            "AM21",
            Verdict::NotApplicable,
            "/etc/claude-code",
            "skipped: --repo-only",
        )
        .in_user_scope();
    };
    managed.first().map_or_else(
        || {
            Finding::new(
                "AM21",
                Verdict::Pass,
                "/etc/claude-code",
                "no managed CLAUDE.md on this machine",
            )
            .in_user_scope()
        },
        |entry| {
            user(
                "AM21",
                Verdict::Warn,
                entry,
                "managed CLAUDE.md: Claude Code loads it in every session on this machine and \
                 no setting excludes it; OpenCode never reads it",
            )
            .with_fix(
                "keep the repository's AGENTS.md complete without it; if both agents must follow \
                 these rules, mirror them in OpenCode's global ~/.config/opencode/AGENTS.md",
            )
        },
    )
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::findings;
    use crate::snapshot::{Entry, RulesFile, Snapshot};
    use std::path::PathBuf;
    use vitals_utils::{Finding, Scope, Verdict};

    fn file(path: &str) -> Entry {
        Entry {
            path: PathBuf::from(path),
            file: RulesFile {
                content: Some("# rules\n".to_owned()),
                link: None,
            },
        }
    }

    fn run(ancestors: Vec<Entry>, claude_md: Option<&str>) -> Vec<Finding> {
        findings(&Snapshot {
            ancestors: Some(ancestors),
            home: Some(PathBuf::from("/home/dev")),
            claude_md: RulesFile {
                content: claude_md.map(ToOwned::to_owned),
                link: None,
            },
            ..Snapshot::default()
        })
    }

    #[test]
    fn a_managed_claude_md_warns_in_user_scope() {
        let skipped = super::managed(&Snapshot::default());
        assert_eq!(skipped.verdict(), Verdict::NotApplicable);
        let clean = super::managed(&Snapshot {
            managed: Some(Vec::new()),
            ..Snapshot::default()
        });
        assert_eq!(clean.verdict(), Verdict::Pass);
        let present = super::managed(&Snapshot {
            managed: Some(vec![file("/etc/claude-code/CLAUDE.md")]),
            ..Snapshot::default()
        });
        assert_eq!(present.verdict(), Verdict::Warn);
        assert_eq!(present.scope(), Scope::User);
        assert!(
            present
                .fix()
                .unwrap()
                .contains("~/.config/opencode/AGENTS.md")
        );
    }

    #[test]
    fn repository_only_runs_skip_both_probes() {
        let found = findings(&Snapshot::default());
        assert_eq!(found.len(), 2);
        assert!(found.iter().all(|f| f.verdict() == Verdict::NotApplicable));
        assert!(found.iter().all(|f| f.scope() == Scope::User));
    }

    #[test]
    fn a_clean_path_passes_in_user_scope() {
        let found = run(Vec::new(), None);
        assert_eq!(found.len(), 2);
        assert!(
            found
                .iter()
                .all(|f| f.verdict() == Verdict::Pass && f.scope() == Scope::User)
        );
    }

    #[test]
    fn claude_files_above_warn_and_home_memory_is_exempt() {
        let found = run(
            vec![
                file("/home/dev/.claude/CLAUDE.md"),
                file("/home/dev/CLAUDE.md"),
                file("/srv/.claude/CLAUDE.md"),
                file("/CLAUDE.local.md"),
            ],
            None,
        );
        let warned: Vec<String> = found
            .iter()
            .filter(|f| f.probe() == "AM14")
            .map(|f| f.evidence().display().to_string())
            .collect();
        assert_eq!(
            warned,
            [
                "/home/dev/CLAUDE.md",
                "/srv/.claude/CLAUDE.md",
                "/CLAUDE.local.md"
            ]
        );
        assert!(found[0].message().contains("skips every AGENTS.md"));
    }

    #[test]
    fn a_repository_bridge_changes_the_consequence() {
        let found = run(vec![file("/CLAUDE.md")], Some("@AGENTS.md"));
        assert!(
            found[0]
                .message()
                .contains("on top of the repository's rules")
        );
    }

    #[test]
    fn agents_files_above_warn() {
        let found = run(
            vec![file("/home/AGENTS.md"), file("/.claude/AGENTS.md")],
            None,
        );
        let warned: Vec<&Finding> = found.iter().filter(|f| f.probe() == "AM15").collect();
        assert_eq!(warned.len(), 2);
        assert!(warned.iter().all(|f| f.verdict() == Verdict::Warn));
        assert!(warned[0].message().contains("OpenCode too"));
        assert!(!warned[1].message().contains("OpenCode"));
    }
}
