//! The probes of the `skills` gate, assembled in id order, and their shared thresholds.

use vitals_utils::{Budget, Finding, Report, Verdict};

use crate::snapshot::Snapshot;
use crate::{content, tree, user};

/// Gate id.
pub const GATE: &str = "skills";

/// Budget for `description` plus `when_to_use`, in chars: warn above 1,024, fail above 1,536.
///
/// The Agent Skills spec caps `description` at 1,024 chars, and claude.ai uploads and the
/// Skills API enforce it. Claude Code truncates the combined `description` and
/// `when_to_use` text at 1,536 chars in the skill listing (skills docs, `description`).
pub const DESCRIPTION: Budget = Budget::new(1_024, 1_536);

/// `SKILL.md` lines above which `SK11` warns: "Keep `SKILL.md` under 500 lines" (Claude Code
/// skills docs and the Agent Skills spec). Neither agent enforces a limit, so it never fails.
pub const LINE_LIMIT: usize = 500;

pub(crate) fn check(snapshot: &Snapshot) -> Report {
    Report::new(
        GATE,
        [
            tree::findings(snapshot),
            content::findings(snapshot),
            vec![tree::inventory(snapshot)],
            user::findings(snapshot),
        ]
        .concat(),
    )
}

/// The finding of a per-skill probe when the repository has no skill to judge.
pub(crate) fn no_skill(probe: &'static str) -> Finding {
    Finding::new(probe, Verdict::NotApplicable, ".", "no skill to judge")
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::check;
    use crate::layout::{Place, Root};
    use crate::snapshot::{Skill, Snapshot};
    use std::path::PathBuf;
    use vitals_utils::{Finding, Outcome, Verdict};

    const HEALTHY: &str =
        "---\nname: deploy\ndescription: Deploy the app. Use when asked to ship.\n---\n# Deploy\n";

    #[test]
    fn a_healthy_skill_passes_every_probe_in_order() {
        let snapshot = Snapshot {
            skills: vec![Skill {
                place: Place {
                    scope: PathBuf::new(),
                    root: Root::Claude,
                    name: "deploy".to_owned(),
                },
                text: HEALTHY.to_owned(),
                files: vec![PathBuf::from("SKILL.md")],
                link: None,
            }],
            files: vec![PathBuf::from(".claude/skills/deploy/SKILL.md")],
            user: None,
        };
        let report = check(&snapshot);
        let probes: Vec<&str> = report.findings().iter().map(Finding::probe).collect();
        let expected: Vec<String> = (1..=15).map(|n| format!("SK{n:02}")).collect();
        assert_eq!(probes, expected);
        assert!(
            report
                .findings()
                .iter()
                .all(|finding| finding.verdict() <= Verdict::Pass),
            "{report}"
        );
    }

    #[test]
    fn an_empty_repository_warns_once_and_judges_nothing_else() {
        let report = check(&Snapshot::default());
        assert_eq!(report.worst(), Verdict::Warn);
        assert_eq!(report.outcome(), Outcome::Passed);
        let warned: Vec<&str> = report
            .findings()
            .iter()
            .filter(|finding| finding.verdict() == Verdict::Warn)
            .map(Finding::probe)
            .collect();
        assert_eq!(warned, ["SK01"]);
    }
}
