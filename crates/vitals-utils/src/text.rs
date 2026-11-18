//! Text size and budgets: pure, no I/O.

use crate::finding::Verdict;

/// Lines and chars of a text, the two measures agents' instruction budgets use.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
#[must_use]
pub struct TextSize {
    lines: usize,
    chars: usize,
}

impl TextSize {
    /// Measures `text`. Lines follow [`str::lines`]: a final line without a trailing newline
    /// counts. Chars are Unicode scalar values, not bytes.
    ///
    /// # Examples
    ///
    /// ```
    /// let size = vitals_utils::TextSize::of("# Rules\n- é\n");
    /// assert_eq!((size.lines(), size.chars()), (2, 12));
    /// ```
    pub fn of(text: &str) -> Self {
        Self {
            lines: text.lines().count(),
            chars: text.chars().count(),
        }
    }

    /// Number of lines.
    #[must_use]
    pub const fn lines(&self) -> usize {
        self.lines
    }

    /// Number of chars (Unicode scalar values).
    #[must_use]
    pub const fn chars(&self) -> usize {
        self.chars
    }
}

/// A warn and a fail threshold: a measure above `warn` warns, above `fail` fails.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[must_use]
pub struct Budget {
    warn: usize,
    fail: usize,
}

impl Budget {
    /// A budget that warns above `warn` and fails above `fail`. A `warn` above `fail` is
    /// lowered to `fail`.
    pub const fn new(warn: usize, fail: usize) -> Self {
        Self {
            warn: if warn < fail { warn } else { fail },
            fail,
        }
    }

    /// A budget that fails above `limit` and never warns.
    pub const fn hard(limit: usize) -> Self {
        Self::new(limit, limit)
    }

    /// A budget that warns above `limit` and never fails: a target with a source but no
    /// documented breaking point.
    pub const fn soft(limit: usize) -> Self {
        Self {
            warn: limit,
            fail: usize::MAX,
        }
    }

    /// The warn threshold.
    #[must_use]
    pub const fn warn(&self) -> usize {
        self.warn
    }

    /// The fail threshold.
    #[must_use]
    pub const fn fail(&self) -> usize {
        self.fail
    }

    /// `measure` with its unit and the thresholds, as a finding message.
    ///
    /// # Examples
    ///
    /// ```
    /// use vitals_utils::Budget;
    ///
    /// assert_eq!(Budget::new(200, 500).describe(12, "lines"), "12 lines (warn above 200, fail above 500)");
    /// assert_eq!(Budget::hard(40).describe(41, "chars"), "41 chars (fail above 40)");
    /// assert_eq!(Budget::soft(200).describe(201, "lines"), "201 lines (warn above 200)");
    /// ```
    #[must_use]
    pub fn describe(&self, measure: usize, unit: &str) -> String {
        if self.fail == usize::MAX {
            format!("{measure} {unit} (warn above {})", self.warn)
        } else if self.warn < self.fail {
            format!(
                "{measure} {unit} (warn above {}, fail above {})",
                self.warn, self.fail
            )
        } else {
            format!("{measure} {unit} (fail above {})", self.fail)
        }
    }

    /// The verdict for `measure`.
    ///
    /// # Examples
    ///
    /// ```
    /// use vitals_utils::{Budget, Verdict};
    ///
    /// let lines = Budget::new(200, 500);
    /// assert_eq!(lines.verdict(200), Verdict::Pass);
    /// assert_eq!(lines.verdict(201), Verdict::Warn);
    /// assert_eq!(lines.verdict(501), Verdict::Fail);
    /// ```
    #[must_use]
    pub const fn verdict(&self, measure: usize) -> Verdict {
        if measure > self.fail {
            Verdict::Fail
        } else if measure > self.warn {
            Verdict::Warn
        } else {
            Verdict::Pass
        }
    }
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
#[expect(
    clippy::arithmetic_side_effects,
    reason = "test inputs are far below usize::MAX"
)]
mod tests {
    use super::{Budget, TextSize};
    use crate::finding::Verdict;
    use proptest::prelude::{any, prop_assert_eq, proptest};

    #[test]
    fn empty_text_has_no_lines() {
        assert_eq!(TextSize::of(""), TextSize::default());
    }

    #[test]
    fn hard_budget_never_warns() {
        let chars = Budget::hard(10);
        assert_eq!((chars.warn(), chars.fail()), (10, 10));
        assert_eq!(chars.verdict(10), Verdict::Pass);
        assert_eq!(chars.verdict(11), Verdict::Fail);
    }

    #[test]
    fn warn_above_fail_is_lowered() {
        assert_eq!(Budget::new(9, 5), Budget::hard(5));
    }

    proptest! {
        #[test]
        fn size_adds_across_a_newline_split(head in any::<String>(), tail in any::<String>()) {
            let head = format!("{head}\n");
            let whole = TextSize::of(&format!("{head}{tail}"));
            let (left, right) = (TextSize::of(&head), TextSize::of(&tail));
            prop_assert_eq!(whole.lines(), left.lines() + right.lines());
            prop_assert_eq!(whole.chars(), left.chars() + right.chars());
        }

        #[test]
        fn verdict_is_monotonic(warn in 0_usize..100, extra in 0_usize..100, measure in 0_usize..300) {
            let budget = Budget::new(warn, warn + extra);
            prop_assert_eq!(budget.verdict(measure) <= budget.verdict(measure + 1), true);
        }
    }
}
