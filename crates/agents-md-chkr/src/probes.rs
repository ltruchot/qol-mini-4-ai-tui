//! The probes of the `agents-md` gate: pure functions of a [`Snapshot`], one per probe id.

use std::path::{Component, Path};

use vitals_utils::markers::AGENTS_MD;
use vitals_utils::{Budget, Finding, Report, TextSize, Verdict};

use crate::imports::Load;
use crate::snapshot::{RulesFile, Snapshot};
use crate::{ancestors, content, nested, rules};

/// Gate id.
pub const GATE: &str = "agents-md";

/// Line budget: warn above 200, never fails.
///
/// Claude Code memory docs, "Write effective instructions": "target under 200 lines per
/// CLAUDE.md file. Longer files consume more context and reduce adherence". No source gives
/// a length at which a file stops working, so the budget only warns.
pub const LINES: Budget = Budget::soft(200);

/// Size budget of a file loaded at launch, in bytes: fail above 4 MiB.
///
/// Claude Code memory docs, "How it works" (auto memory): "Claude gets the whole of each
/// CLAUDE.md file that loads at launch, as long as the file is 4 MiB or smaller. Claude Code
/// skips a file over 4 MiB and loads none of it."
pub const LAUNCH_BYTES: Budget = Budget::hard(4 * 1024 * 1024);

/// Size budget of a file loaded on demand, in chars: fail above 40,000.
///
/// Claude Code memory docs, "Claude ignores the end of my subdirectory CLAUDE.md": a
/// subdirectory `CLAUDE.md` or `CLAUDE.local.md`, a subdirectory's rules file, or a
/// path-scoped rule over the per-file limit reaches Claude only up to the limit: 40,000
/// chars with a 200K context window, the smallest the docs list.
pub const ON_DEMAND_CHARS: Budget = Budget::hard(40_000);

/// Size budget of a subdirectory `AGENTS.md`, in chars: warn above 70,000.
///
/// Claude Code attaches a subdirectory `AGENTS.md` to the Read result through a hook. In
/// runs of Claude Code 2.1.325 (ADR 4, "Empirical checks"), one of 69,996 chars arrived
/// whole and one of 99,948 only as a preview; the docs give no limit, so this warns.
pub const ATTACHED_CHARS: Budget = Budget::soft(70_000);

/// How many leading lines of `AGENTS.md` must name the handoff file.
pub const HANDOFF_WINDOW: usize = 10;

const QOL_MINI: &str = "https://github.com/ltruchot/qol-mini-4-ai-tui";

/// A file Claude Code reads instead of `AGENTS.md` when it exists.
pub(crate) struct Location {
    probe: &'static str,
    path: &'static str,
    /// `AGENTS.md` as seen from the file's directory, for imports and link targets.
    pub(crate) agents: &'static str,
}

pub(crate) const ROOT_CLAUDE_MD: Location = Location {
    probe: "AM02",
    path: "CLAUDE.md",
    agents: "AGENTS.md",
};

pub(crate) const DOT_CLAUDE_MD: Location = Location {
    probe: "AM03",
    path: ".claude/CLAUDE.md",
    agents: "../AGENTS.md",
};

/// How a shadowing file relates to `AGENTS.md`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Layout {
    Absent,
    Symlink,
    Bridge,
    Own,
}

impl Layout {
    pub(crate) const fn loads_agents(self) -> bool {
        matches!(self, Self::Symlink | Self::Bridge)
    }
}

pub(crate) fn check(snapshot: &Snapshot) -> Report {
    let root = vec![
        presence(snapshot),
        shadow(&ROOT_CLAUDE_MD, &snapshot.claude_md, snapshot),
        shadow(&DOT_CLAUDE_MD, &snapshot.dot_claude_md, snapshot),
        local_file(snapshot),
        lines(snapshot),
        chars(snapshot),
        handoff(snapshot),
        kaizen(snapshot),
    ];
    let mut findings = [
        root,
        nested::findings(snapshot),
        ancestors::findings(snapshot),
        content::findings(snapshot),
        rules::finding(snapshot),
        vec![ancestors::managed(snapshot)],
    ]
    .concat();
    findings.sort_by_key(Finding::probe);
    Report::new(GATE, findings)
}

fn not_applicable(probe: &'static str, evidence: &str) -> Finding {
    Finding::new(
        probe,
        Verdict::NotApplicable,
        evidence,
        "no AGENTS.md to judge",
    )
}

/// `AM01`: `AGENTS.md` is at the root.
fn presence(snapshot: &Snapshot) -> Finding {
    match (&snapshot.agents_md, &snapshot.claude_md.content) {
        (Some(_), _) => Finding::new("AM01", Verdict::Pass, AGENTS_MD, "AGENTS.md is at the root"),
        (None, Some(_)) => Finding::new(
            "AM01",
            Verdict::Fail,
            AGENTS_MD,
            "no AGENTS.md: the rules live in CLAUDE.md, which OpenCode 2 does not read",
        )
        .with_fix("rename CLAUDE.md to AGENTS.md; Claude Code 2.1.277 and later reads it"),
        (None, None) => Finding::new("AM01", Verdict::Fail, AGENTS_MD, "no AGENTS.md at the root")
            .with_fix(
                "create AGENTS.md: project summary, build/test/lint commands, and the \
                 conventions an agent cannot infer",
            ),
    }
}

/// How `file` relates to the `AGENTS.md` that `agents` points to from its directory.
pub(crate) fn layout(file: &RulesFile, agents: &str) -> Layout {
    if let Some(target) = &file.link {
        let same = target
            .components()
            .filter(|part| *part != Component::CurDir)
            .eq(Path::new(agents).components());
        return if same { Layout::Symlink } else { Layout::Own };
    }
    match file.content.as_deref() {
        None => Layout::Absent,
        Some(text) if text.trim().strip_prefix('@') == Some(agents) => Layout::Bridge,
        Some(_) => Layout::Own,
    }
}

/// `AM02`, `AM03`: no `CLAUDE.md` shadows `AGENTS.md`, unless it imports or links to it.
fn shadow(at: &Location, file: &RulesFile, snapshot: &Snapshot) -> Finding {
    if snapshot.agents_md.is_none() {
        return not_applicable(at.probe, at.path);
    }
    let (verdict, message) = match layout(file, at.agents) {
        Layout::Absent => (Verdict::Pass, "absent: nothing shadows AGENTS.md"),
        Layout::Symlink => (Verdict::Pass, "a symbolic link to AGENTS.md"),
        Layout::Bridge => (Verdict::Pass, "a bridge that only imports AGENTS.md"),
        Layout::Own => (
            Verdict::Fail,
            "Claude Code reads this file and skips AGENTS.md, so the two agents follow \
             different rules",
        ),
    };
    let finding = Finding::new(at.probe, verdict, at.path, message);
    if verdict == Verdict::Fail {
        finding.with_fix(format!(
            "merge it into AGENTS.md, then delete it or reduce it to the single line `@{}`",
            at.agents
        ))
    } else {
        finding
    }
}

/// `AM04`: no `CLAUDE.local.md` makes Claude Code skip `AGENTS.md` on one machine.
fn local_file(snapshot: &Snapshot) -> Finding {
    const PATH: &str = "CLAUDE.local.md";
    if snapshot.agents_md.is_none() {
        return not_applicable("AM04", PATH);
    }
    let bridged = layout(&snapshot.claude_md, ROOT_CLAUDE_MD.agents).loads_agents()
        || layout(&snapshot.dot_claude_md, DOT_CLAUDE_MD.agents).loads_agents();
    match (snapshot.claude_local_md, bridged) {
        (false, _) => Finding::new("AM04", Verdict::Pass, PATH, "absent"),
        (true, true) => Finding::new(
            "AM04",
            Verdict::Pass,
            PATH,
            "present, and a bridge CLAUDE.md still loads AGENTS.md",
        ),
        (true, false) => Finding::new(
            "AM04",
            Verdict::Warn,
            PATH,
            "present: Claude Code reads it and skips AGENTS.md on this machine",
        )
        .with_fix(
            "add a CLAUDE.md holding only `@AGENTS.md`, or move the local rules to \
             ~/.claude/CLAUDE.md",
        ),
    }
}

/// The root rules file that the budget and handoff probes judge: `AGENTS.md`, or, when
/// there is none, the `CLAUDE.md` that Claude Code loads in its place.
pub(crate) fn subject(snapshot: &Snapshot) -> Option<(&'static str, &str)> {
    snapshot
        .agents_md
        .as_deref()
        .map(|text| (AGENTS_MD, text))
        .or_else(|| {
            [
                (ROOT_CLAUDE_MD.path, &snapshot.claude_md),
                (DOT_CLAUDE_MD.path, &snapshot.dot_claude_md),
            ]
            .into_iter()
            .find_map(|(path, file)| file.content.as_deref().map(|text| (path, text)))
        })
}

fn no_subject(probe: &'static str) -> Finding {
    Finding::new(
        probe,
        Verdict::NotApplicable,
        AGENTS_MD,
        "no root rules file to judge",
    )
}

/// The root rules file and its size as each agent loads it.
fn loaded(snapshot: &Snapshot) -> Option<(&'static str, Load)> {
    subject(snapshot).map(|(path, text)| {
        let opencode_reads = path == AGENTS_MD;
        let load = Load::of(Path::new(path), text, &snapshot.imported, opencode_reads);
        (path, load)
    })
}

/// A budget finding for `path`, whose size is `measured` (the size, and what makes it
/// differ from the file on disk), against `limit` in `unit`.
fn budget(
    probe: &'static str,
    path: &Path,
    measured: (usize, Option<String>),
    limit: (&str, Budget),
) -> Finding {
    let (measure, note) = measured;
    let (unit, budget) = limit;
    let verdict = budget.verdict(measure);
    let described = budget.describe(measure, unit);
    let message = note.map_or_else(|| described.clone(), |note| format!("{described}, {note}"));
    let finding = Finding::new(probe, verdict, path, message);
    if verdict > Verdict::Pass {
        finding.with_fix(
            "keep what every session needs; move workflow-specific sections into skills and \
             detail into docs that the rules file links to",
        )
    } else {
        finding
    }
}

/// `AM05`: the root rules file, as loaded, is within the [`LINES`] budget.
fn lines(snapshot: &Snapshot) -> Finding {
    loaded(snapshot).map_or_else(
        || no_subject("AM05"),
        |(path, load)| {
            let measured = load.larger(TextSize::lines);
            budget("AM05", Path::new(path), measured, ("lines", LINES))
        },
    )
}

/// `AM06`: the root rules file is within [`LAUNCH_BYTES`], past which Claude Code skips it.
fn chars(snapshot: &Snapshot) -> Finding {
    subject(snapshot).map_or_else(
        || no_subject("AM06"),
        |(path, text)| {
            let verdict = LAUNCH_BYTES.verdict(text.len());
            let finding = Finding::new(
                "AM06",
                verdict,
                path,
                LAUNCH_BYTES.describe(text.len(), "bytes"),
            );
            if verdict > Verdict::Pass {
                finding.with_fix(
                    "Claude Code skips a file over 4 MiB and loads none of it: move detail into \
                     docs the rules file links to, and workflow sections into skills",
                )
            } else {
                finding
            }
        },
    )
}

/// `AM07`: a session that starts after `/clear` or a compaction is sent to `TODO.md` first.
fn handoff(snapshot: &Snapshot) -> Finding {
    let Some((path, text)) = subject(snapshot) else {
        return no_subject("AM07");
    };
    let named = text
        .lines()
        .take(HANDOFF_WINDOW)
        .any(|line| line.contains("TODO.md"));
    let finding = match (named, snapshot.todo_md) {
        (true, true) => {
            return Finding::new(
                "AM07",
                Verdict::Pass,
                path,
                "opens by sending each session to TODO.md",
            );
        }
        (true, false) => Finding::new(
            "AM07",
            Verdict::Warn,
            "TODO.md",
            format!("{path} sends each session to TODO.md, which does not exist"),
        ),
        (false, _) => Finding::new(
            "AM07",
            Verdict::Warn,
            path,
            format!(
                "names no TODO.md handoff in its first {HANDOFF_WINDOW} lines: a session \
                 after /clear or a compaction starts cold"
            ),
        ),
    };
    finding.with_fix(format!(
        "open {path} with a line that sends each session to TODO.md (where the last \
         session stopped, what is left) and keep TODO.md current; the qol-mini kaizen skill \
         sets both up: {QOL_MINI}"
    ))
}

/// The only skill root both agents read: Claude Code loads project skills from
/// `.claude/skills/` alone (skills docs, "Where skills live"); `OpenCode` reads it too.
const SHARED_SKILLS: &str = ".claude/skills";

/// `AM08`: a continuous-improvement (kaizen) skill, where both agents load it, turns session
/// friction into rule edits.
fn kaizen(snapshot: &Snapshot) -> Finding {
    let Some(path) = snapshot.kaizen_skill.as_deref() else {
        return Finding::new(
            "AM08",
            Verdict::Warn,
            SHARED_SKILLS,
            "no kaizen skill in any skill root (.claude/skills, .agents/skills, \
             .opencode/skill, .opencode/skills): nothing turns session friction into rule edits",
        )
        .with_fix(format!(
            "`qol-mini skills install kaizen <repo>` ({QOL_MINI}); the agents-md-review \
             skill also recognizes an equivalent under another name"
        ));
    };
    if path.starts_with(SHARED_SKILLS) {
        return Finding::new("AM08", Verdict::Pass, path, "kaizen skill present");
    }
    let dir = path.parent().unwrap_or(path).display().to_string();
    Finding::new(
        "AM08",
        Verdict::Warn,
        path,
        "kaizen skill outside .claude/skills: OpenCode loads it, Claude Code never does",
    )
    .with_fix(format!(
        "move it to .claude/skills/kaizen, or link it there: \
         `ln -s ../../{dir} .claude/skills/kaizen`"
    ))
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{LAUNCH_BYTES, LINES, check};
    use crate::snapshot::{RulesFile, Snapshot};
    use std::path::PathBuf;
    use vitals_utils::{Finding, Outcome, Verdict};

    const HANDOFF: &str = "> Session handoff: read `TODO.md` first.\n\n# Rules\n";

    fn healthy() -> Snapshot {
        Snapshot {
            agents_md: Some(HANDOFF.to_owned()),
            todo_md: true,
            kaizen_skill: Some(PathBuf::from(".claude/skills/kaizen/SKILL.md")),
            ..Snapshot::default()
        }
    }

    fn content(text: &str) -> RulesFile {
        RulesFile {
            content: Some(text.to_owned()),
            link: None,
        }
    }

    fn link(target: &str) -> RulesFile {
        RulesFile {
            content: Some(HANDOFF.to_owned()),
            link: Some(PathBuf::from(target)),
        }
    }

    fn verdict(snapshot: &Snapshot, probe: &str) -> Verdict {
        check(snapshot)
            .findings()
            .iter()
            .find(|finding| finding.probe() == probe)
            .unwrap()
            .verdict()
    }

    fn sized(lines: usize, width: usize) -> Snapshot {
        let line = format!("{}\n", "x".repeat(width.saturating_sub(1)));
        Snapshot {
            agents_md: Some(format!("{HANDOFF}{}", line.repeat(lines.saturating_sub(3)))),
            ..healthy()
        }
    }

    #[test]
    fn a_healthy_repository_passes_every_probe() {
        let report = check(&healthy());
        let probes: Vec<&str> = report.findings().iter().map(Finding::probe).collect();
        let expected: Vec<String> = (1..=21).map(|n| format!("AM{n:02}")).collect();
        assert_eq!(probes, expected);
        assert_eq!(report.worst(), Verdict::Pass, "{report}");
    }

    #[test]
    fn a_missing_agents_md_fails_once_and_skips_the_rest() {
        let report = check(&Snapshot::default());
        assert_eq!(verdict(&Snapshot::default(), "AM01"), Verdict::Fail);
        assert_eq!(report.outcome(), Outcome::Failed);
        let skipped = ["AM02", "AM03", "AM04", "AM05", "AM06", "AM07"];
        let budget = report
            .findings()
            .iter()
            .find(|f| f.probe() == "AM05")
            .unwrap();
        assert_eq!(budget.message(), "no root rules file to judge");
        assert!(
            skipped
                .iter()
                .all(|probe| verdict(&Snapshot::default(), probe) == Verdict::NotApplicable)
        );
    }

    #[test]
    fn a_claude_md_alone_is_named_in_the_fix() {
        let snapshot = Snapshot {
            claude_md: content("# Rules\n"),
            ..Snapshot::default()
        };
        let report = check(&snapshot);
        let presence = report.findings().first().unwrap();
        assert_eq!(presence.verdict(), Verdict::Fail);
        assert!(presence.fix().unwrap().starts_with("rename CLAUDE.md"));
    }

    #[test]
    fn without_agents_md_the_budgets_and_handoff_judge_the_claude_md_that_loads() {
        let long = format!("> read `TODO.md` first\n{}", "rule\n".repeat(300));
        let root = Snapshot {
            claude_md: content(&long),
            todo_md: true,
            ..Snapshot::default()
        };
        let report = check(&root);
        let of = |probe| {
            report
                .findings()
                .iter()
                .find(|f| f.probe() == probe)
                .unwrap()
        };
        assert_eq!(of("AM05").verdict(), Verdict::Warn);
        assert_eq!(of("AM05").evidence(), std::path::Path::new("CLAUDE.md"));
        assert_eq!(of("AM06").verdict(), Verdict::Pass);
        assert_eq!(of("AM07").verdict(), Verdict::Pass);
        assert_eq!(of("AM02").verdict(), Verdict::NotApplicable);
        let dot = Snapshot {
            dot_claude_md: content("# Rules\n"),
            ..Snapshot::default()
        };
        let dot_report = check(&dot);
        let handoff = dot_report
            .findings()
            .iter()
            .find(|f| f.probe() == "AM07")
            .unwrap();
        assert_eq!(
            handoff.evidence(),
            std::path::Path::new(".claude/CLAUDE.md")
        );
        assert!(handoff.fix().unwrap().starts_with("open .claude/CLAUDE.md"));
    }

    #[test]
    fn root_claude_md_passes_as_bridge_or_symlink_and_fails_with_own_content() {
        let with = |claude_md| Snapshot {
            claude_md,
            ..healthy()
        };
        assert_eq!(
            verdict(&with(content("@AGENTS.md\n")), "AM02"),
            Verdict::Pass
        );
        assert_eq!(verdict(&with(link("AGENTS.md")), "AM02"), Verdict::Pass);
        assert_eq!(verdict(&with(link("./AGENTS.md")), "AM02"), Verdict::Pass);
        assert_eq!(
            verdict(&with(link("docs/AGENTS.md")), "AM02"),
            Verdict::Fail
        );
        assert_eq!(
            verdict(&with(content("# Other rules\n")), "AM02"),
            Verdict::Fail
        );
        assert_eq!(
            verdict(&with(content("@AGENTS.md\n- more\n")), "AM02"),
            Verdict::Fail
        );
    }

    #[test]
    fn dot_claude_md_bridges_through_the_parent_directory() {
        let with = |dot_claude_md| Snapshot {
            dot_claude_md,
            ..healthy()
        };
        assert_eq!(
            verdict(&with(content("@../AGENTS.md")), "AM03"),
            Verdict::Pass
        );
        assert_eq!(verdict(&with(link("../AGENTS.md")), "AM03"), Verdict::Pass);
        assert_eq!(verdict(&with(content("@AGENTS.md")), "AM03"), Verdict::Fail);
    }

    #[test]
    fn a_local_file_warns_unless_a_bridge_loads_agents_md() {
        let local = Snapshot {
            claude_local_md: true,
            ..healthy()
        };
        assert_eq!(verdict(&local, "AM04"), Verdict::Warn);
        let bridged = Snapshot {
            claude_md: content("@AGENTS.md"),
            ..local.clone()
        };
        assert_eq!(verdict(&bridged, "AM04"), Verdict::Pass);
        let dot_bridged = Snapshot {
            dot_claude_md: link("../AGENTS.md"),
            ..local
        };
        assert_eq!(verdict(&dot_bridged, "AM04"), Verdict::Pass);
    }

    #[test]
    fn line_budget_edges() {
        assert_eq!(verdict(&sized(LINES.warn(), 1), "AM05"), Verdict::Pass);
        assert_eq!(verdict(&sized(LINES.warn() + 1, 1), "AM05"), Verdict::Warn);
        // No source gives a length at which a file stops working: the budget never fails.
        assert_eq!(verdict(&sized(5_000, 1), "AM05"), Verdict::Warn);
    }

    #[test]
    fn launch_size_edges() {
        let of_bytes = |bytes: usize| Snapshot {
            agents_md: Some(format!("{HANDOFF}{}", "x".repeat(bytes - HANDOFF.len()))),
            ..healthy()
        };
        // 40,000 chars only bound files loaded on demand; a root file loads whole.
        assert_eq!(verdict(&of_bytes(64_000), "AM06"), Verdict::Pass);
        assert_eq!(
            verdict(&of_bytes(LAUNCH_BYTES.fail()), "AM06"),
            Verdict::Pass
        );
        let over = check(&of_bytes(LAUNCH_BYTES.fail() + 1));
        let size = over
            .findings()
            .iter()
            .find(|f| f.probe() == "AM06")
            .unwrap();
        assert_eq!(size.verdict(), Verdict::Fail);
        assert!(size.fix().unwrap().contains("4 MiB"));
    }

    #[test]
    fn handoff_must_name_an_existing_todo_md_early() {
        let no_todo = Snapshot {
            todo_md: false,
            ..healthy()
        };
        assert_eq!(verdict(&no_todo, "AM07"), Verdict::Warn);
        let late = Snapshot {
            agents_md: Some(format!("{}{HANDOFF}", "line\n".repeat(10))),
            ..healthy()
        };
        assert_eq!(verdict(&late, "AM07"), Verdict::Warn);
        let unnamed = Snapshot {
            agents_md: Some("# Rules\n".to_owned()),
            ..healthy()
        };
        assert_eq!(verdict(&unnamed, "AM07"), Verdict::Warn);
    }

    #[test]
    fn a_kaizen_skill_outside_claude_skills_warns_with_a_link_fix() {
        let snapshot = Snapshot {
            kaizen_skill: Some(PathBuf::from(".agents/skills/kaizen/SKILL.md")),
            ..healthy()
        };
        let report = check(&snapshot);
        let kaizen = report
            .findings()
            .iter()
            .find(|f| f.probe() == "AM08")
            .unwrap();
        assert_eq!(kaizen.verdict(), Verdict::Warn);
        assert!(kaizen.message().contains("Claude Code never does"));
        assert_eq!(
            kaizen.fix(),
            Some(
                "move it to .claude/skills/kaizen, or link it there: \
                 `ln -s ../../.agents/skills/kaizen .claude/skills/kaizen`"
            )
        );
    }

    #[test]
    fn a_missing_kaizen_skill_points_to_qol_mini() {
        let snapshot = Snapshot {
            kaizen_skill: None,
            ..healthy()
        };
        let report = check(&snapshot);
        let kaizen = report
            .findings()
            .iter()
            .find(|f| f.probe() == "AM08")
            .unwrap();
        assert_eq!(kaizen.verdict(), Verdict::Warn);
        assert!(
            kaizen
                .fix()
                .unwrap()
                .contains("qol-mini skills install kaizen")
        );
        assert_eq!(report.outcome(), Outcome::Passed);
    }
}
