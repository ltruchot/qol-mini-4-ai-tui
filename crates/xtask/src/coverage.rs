//! Pure branch-coverage gate over a cargo-llvm-cov JSON summary.

use serde_json::Value;

/// Why the coverage gate failed.
#[derive(Debug, thiserror::Error)]
pub(crate) enum GateError {
    /// The summary is not valid JSON.
    #[error("coverage summary is not valid JSON")]
    Json(#[from] serde_json::Error),
    /// The summary has no branch totals (branch coverage was not enabled).
    #[error("coverage summary has no `data[0].totals.branches`; was `--branch` passed?")]
    MissingBranches,
    /// Branch coverage is under the minimum.
    #[error("branch coverage is {percent:.2}%, below the {min}% minimum")]
    BelowMinimum {
        /// Measured branch coverage, in percent.
        percent: f64,
        /// Required minimum, in percent.
        min: f64,
    },
}

/// Reads `data[0].totals.branches` from a cargo-llvm-cov `--json --summary-only` export and
/// checks it against `min`. Returns the measured percentage when it passes.
///
/// A summary with zero branches fails: it means branch instrumentation did not run.
pub(crate) fn gate(summary: &str, min: f64) -> Result<f64, GateError> {
    let json: Value = serde_json::from_str(summary)?;
    let branches = json.pointer("/data/0/totals/branches");
    let count = branches
        .and_then(|b| b.get("count"))
        .and_then(Value::as_u64);
    let percent = branches
        .and_then(|b| b.get("percent"))
        .and_then(Value::as_f64);
    match (count, percent) {
        (Some(count), Some(percent)) if count > 0 && percent >= min => Ok(percent),
        (Some(count), Some(percent)) if count > 0 => Err(GateError::BelowMinimum { percent, min }),
        _ => Err(GateError::MissingBranches),
    }
}

#[cfg(test)]
mod tests {
    use super::{GateError, gate};

    fn summary(count: u64, percent: f64) -> String {
        format!(
            r#"{{"data":[{{"totals":{{"branches":{{"count":{count},"percent":{percent}}}}}}}]}}"#
        )
    }

    #[test]
    fn passes_at_or_above_the_minimum() {
        assert!((gate(&summary(10, 90.0), 90.0).unwrap() - 90.0).abs() < f64::EPSILON);
        assert!((gate(&summary(10, 100.0), 90.0).unwrap() - 100.0).abs() < f64::EPSILON);
    }

    #[test]
    fn fails_below_the_minimum_with_the_measured_value() {
        let error = gate(&summary(10, 89.5), 90.0).unwrap_err();
        assert_eq!(
            error.to_string(),
            "branch coverage is 89.50%, below the 90% minimum"
        );
    }

    #[test]
    fn zero_branches_means_instrumentation_was_off() {
        assert!(matches!(
            gate(&summary(0, 0.0), 90.0),
            Err(GateError::MissingBranches)
        ));
    }

    #[test]
    fn missing_branch_totals_fail() {
        assert!(matches!(
            gate(r#"{"data":[{"totals":{}}]}"#, 90.0),
            Err(GateError::MissingBranches)
        ));
    }

    #[test]
    fn invalid_json_fails() {
        assert!(matches!(gate("not json", 90.0), Err(GateError::Json(_))));
    }
}
