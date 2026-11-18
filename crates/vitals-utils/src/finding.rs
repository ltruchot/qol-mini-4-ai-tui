//! What probes conclude, and the report a gate prints: pure values, no I/O.

use core::fmt;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

/// What a probe concluded, ordered from best to worst: a report's verdict is its maximum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Verdict {
    /// The probe does not apply to this repository.
    NotApplicable,
    /// The harness meets the probe.
    Pass,
    /// The harness falls short of the probe; the gate still passes.
    Warn,
    /// The harness breaks the probe; the gate fails.
    Fail,
}

impl fmt::Display for Verdict {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::NotApplicable => "n/a",
            Self::Pass => "pass",
            Self::Warn => "warn",
            Self::Fail => "fail",
        })
    }
}

/// Where a finding's evidence lives (ADR 1, "Two scopes").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum Scope {
    /// Inside the repository: reproducible, and the only scope that sets the exit status.
    #[default]
    Repository,
    /// On this machine, outside the repository (parent directories, the home directory):
    /// reported, never part of the exit status.
    User,
}

/// How far a gate run looks (ADR 1, "Two scopes").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum Reach {
    /// The repository and the user scope: every parent directory up to the filesystem
    /// root, and the home directory.
    #[default]
    WithUserScope,
    /// The repository only, for reproducible CI runs.
    RepositoryOnly,
}

impl Reach {
    /// The reach a `--repo-only` flag selects.
    ///
    /// # Examples
    ///
    /// ```
    /// use vitals_utils::Reach;
    ///
    /// assert_eq!(Reach::from_repo_only(true), Reach::RepositoryOnly);
    /// assert!(Reach::from_repo_only(false).includes_user_scope());
    /// ```
    #[must_use]
    pub const fn from_repo_only(repo_only: bool) -> Self {
        if repo_only {
            Self::RepositoryOnly
        } else {
            Self::WithUserScope
        }
    }

    /// Whether the run reads outside the repository.
    #[must_use]
    pub const fn includes_user_scope(self) -> bool {
        matches!(self, Self::WithUserScope)
    }
}

/// `found` when a probe found something, else the single `pass` finding: per-file probes
/// report each offending file, or one pass for the whole tree.
#[must_use]
pub fn or_pass(found: Vec<Finding>, pass: Finding) -> Vec<Finding> {
    if found.is_empty() { vec![pass] } else { found }
}

/// One probe's conclusion: its stable id, the verdict, the file it is about, and the fix.
#[derive(Debug, Clone, PartialEq, Eq)]
#[must_use]
pub struct Finding {
    probe: &'static str,
    verdict: Verdict,
    scope: Scope,
    evidence: PathBuf,
    message: String,
    fix: Option<String>,
}

impl Finding {
    /// A finding without a fix. `evidence` is relative to the repository root.
    pub fn new(
        probe: &'static str,
        verdict: Verdict,
        evidence: impl Into<PathBuf>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            probe,
            verdict,
            scope: Scope::Repository,
            evidence: evidence.into(),
            message: message.into(),
            fix: None,
        }
    }

    /// The same finding with a concrete fix.
    pub fn with_fix(self, fix: impl Into<String>) -> Self {
        Self {
            fix: Some(fix.into()),
            ..self
        }
    }

    /// The same finding, about a file outside the repository.
    pub fn in_user_scope(self) -> Self {
        Self {
            scope: Scope::User,
            ..self
        }
    }

    /// Where the evidence lives.
    #[must_use]
    pub const fn scope(&self) -> Scope {
        self.scope
    }

    /// Stable probe id, such as `AM01`.
    #[must_use]
    pub const fn probe(&self) -> &'static str {
        self.probe
    }

    /// What the probe concluded.
    #[must_use]
    pub const fn verdict(&self) -> Verdict {
        self.verdict
    }

    /// The file the finding is about, relative to the repository root.
    #[must_use]
    pub fn evidence(&self) -> &Path {
        &self.evidence
    }

    /// What the probe observed.
    #[must_use]
    pub fn message(&self) -> &str {
        &self.message
    }

    /// How to fix it, when there is something to fix.
    #[must_use]
    pub fn fix(&self) -> Option<&str> {
        self.fix.as_deref()
    }
}

impl fmt::Display for Finding {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let scope = match self.scope {
            Scope::Repository => "",
            Scope::User => " (user scope)",
        };
        write!(
            f,
            "[{}] {}{scope} {}: {}",
            self.verdict,
            self.probe,
            self.evidence.display(),
            self.message
        )?;
        self.fix
            .as_ref()
            .map_or(Ok(()), |fix| write!(f, "\n       fix: {fix}"))
    }
}

/// How a gate binary exits (ADR 4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Outcome {
    /// No probe failed: exit status 0.
    Passed,
    /// At least one probe failed: exit status 1.
    Failed,
    /// The gate could not run (bad usage, unreadable repository): exit status 2.
    Error,
}

impl From<Outcome> for u8 {
    fn from(outcome: Outcome) -> Self {
        match outcome {
            Outcome::Passed => 0,
            Outcome::Failed => 1,
            Outcome::Error => 2,
        }
    }
}

impl From<Outcome> for ExitCode {
    fn from(outcome: Outcome) -> Self {
        Self::from(u8::from(outcome))
    }
}

/// Every finding of one gate run, in probe order.
#[derive(Debug, Clone, PartialEq, Eq)]
#[must_use]
pub struct Report {
    gate: &'static str,
    findings: Vec<Finding>,
}

impl Report {
    /// A report for `gate`.
    pub const fn new(gate: &'static str, findings: Vec<Finding>) -> Self {
        Self { gate, findings }
    }

    /// The gate id, such as `agents-md`.
    #[must_use]
    pub const fn gate(&self) -> &'static str {
        self.gate
    }

    /// The findings, in probe order.
    #[must_use]
    pub fn findings(&self) -> &[Finding] {
        &self.findings
    }

    /// The worst verdict, or [`Verdict::NotApplicable`] when there is no finding.
    ///
    /// # Examples
    ///
    /// ```
    /// use vitals_utils::{Finding, Report, Verdict};
    ///
    /// let report = Report::new("demo", vec![
    ///     Finding::new("D01", Verdict::Pass, "a", "fine"),
    ///     Finding::new("D02", Verdict::Warn, "b", "short of it"),
    /// ]);
    /// assert_eq!(report.worst(), Verdict::Warn);
    /// ```
    #[must_use]
    pub fn worst(&self) -> Verdict {
        self.findings
            .iter()
            .map(Finding::verdict)
            .max()
            .unwrap_or(Verdict::NotApplicable)
    }

    /// [`Outcome::Failed`] when a repository-scope probe failed, [`Outcome::Passed`]
    /// otherwise: user-scope findings never change the exit status.
    #[must_use]
    pub fn outcome(&self) -> Outcome {
        let failed = self.findings.iter().any(|finding| {
            finding.scope() == Scope::Repository && finding.verdict() == Verdict::Fail
        });
        if failed {
            Outcome::Failed
        } else {
            Outcome::Passed
        }
    }

    fn count(&self, verdict: Verdict) -> usize {
        self.findings
            .iter()
            .filter(|finding| finding.verdict() == verdict)
            .count()
    }
}

impl fmt::Display for Report {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.findings
            .iter()
            .try_for_each(|finding| writeln!(f, "{finding}"))?;
        let status = match self.outcome() {
            Outcome::Failed => "failed",
            Outcome::Passed | Outcome::Error => "passed",
        };
        write!(
            f,
            "{} gate {status}: {} fail, {} warn, {} pass, {} n/a",
            self.gate,
            self.count(Verdict::Fail),
            self.count(Verdict::Warn),
            self.count(Verdict::Pass),
            self.count(Verdict::NotApplicable),
        )
    }
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{Finding, Outcome, Reach, Report, Scope, Verdict, or_pass};

    fn finding(verdict: Verdict) -> Finding {
        Finding::new("T01", verdict, "AGENTS.md", "observed")
    }

    #[test]
    fn verdicts_order_from_best_to_worst() {
        assert!(Verdict::NotApplicable < Verdict::Pass);
        assert!(Verdict::Pass < Verdict::Warn);
        assert!(Verdict::Warn < Verdict::Fail);
    }

    #[test]
    fn an_empty_report_passes() {
        let report = Report::new("t", Vec::new());
        assert_eq!(report.worst(), Verdict::NotApplicable);
        assert_eq!(report.outcome(), Outcome::Passed);
    }

    #[test]
    fn a_warning_passes_and_a_failure_fails() {
        let warned = Report::new("t", vec![finding(Verdict::Pass), finding(Verdict::Warn)]);
        assert_eq!(warned.outcome(), Outcome::Passed);
        let failed = Report::new("t", vec![finding(Verdict::Fail), finding(Verdict::Warn)]);
        assert_eq!(failed.outcome(), Outcome::Failed);
    }

    #[test]
    fn outcomes_map_to_the_exit_contract() {
        assert_eq!(u8::from(Outcome::Passed), 0);
        assert_eq!(u8::from(Outcome::Failed), 1);
        assert_eq!(u8::from(Outcome::Error), 2);
        assert_eq!(
            std::process::ExitCode::from(Outcome::Error),
            std::process::ExitCode::from(2)
        );
    }

    #[test]
    fn accessors_return_what_was_built() {
        let built = finding(Verdict::Warn).with_fix("do this");
        assert_eq!(built.probe(), "T01");
        assert_eq!(built.evidence(), std::path::Path::new("AGENTS.md"));
        assert_eq!(built.message(), "observed");
        assert_eq!(built.fix(), Some("do this"));
        assert_eq!(finding(Verdict::Pass).fix(), None);
        assert_eq!(Report::new("gate", Vec::new()).gate(), "gate");
    }

    #[test]
    fn display_lists_findings_fixes_and_the_tally() {
        let report = Report::new(
            "demo",
            vec![
                finding(Verdict::Pass),
                finding(Verdict::Fail).with_fix("rename it"),
                finding(Verdict::NotApplicable),
            ],
        );
        assert_eq!(
            report.to_string(),
            "[pass] T01 AGENTS.md: observed\n\
             [fail] T01 AGENTS.md: observed\n       fix: rename it\n\
             [n/a] T01 AGENTS.md: observed\n\
             demo gate failed: 1 fail, 0 warn, 1 pass, 1 n/a"
        );
    }

    #[test]
    fn user_scope_is_shown_and_never_fails_the_gate() {
        let outside = finding(Verdict::Fail).in_user_scope();
        assert_eq!(outside.scope(), Scope::User);
        assert_eq!(finding(Verdict::Fail).scope(), Scope::Repository);
        assert_eq!(
            outside.to_string(),
            "[fail] T01 (user scope) AGENTS.md: observed"
        );
        let report = Report::new("t", vec![outside]);
        assert_eq!(report.worst(), Verdict::Fail);
        assert_eq!(report.outcome(), Outcome::Passed);
    }

    #[test]
    fn display_of_a_passing_report_says_passed() {
        let report = Report::new("demo", vec![finding(Verdict::Warn)]);
        assert!(
            report
                .to_string()
                .ends_with("demo gate passed: 0 fail, 1 warn, 0 pass, 0 n/a")
        );
    }

    #[test]
    fn reach_follows_the_repo_only_flag() {
        assert_eq!(Reach::default(), Reach::WithUserScope);
        assert_eq!(Reach::from_repo_only(false), Reach::WithUserScope);
        assert!(!Reach::from_repo_only(true).includes_user_scope());
    }

    #[test]
    fn or_pass_keeps_findings_or_falls_back_to_the_pass() {
        let pass = finding(Verdict::Pass);
        assert_eq!(or_pass(Vec::new(), pass.clone()), vec![pass.clone()]);
        let found = vec![finding(Verdict::Warn)];
        assert_eq!(or_pass(found.clone(), pass), found);
    }
}
